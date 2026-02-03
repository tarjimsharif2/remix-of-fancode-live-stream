import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { M3uPlaylist, M3uChannel } from "@/types/m3uPlaylist";
import { Button } from "@/components/ui/button";
import { 
  AlertCircle, 
  ArrowLeft, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings,
  RectangleHorizontal,
  Scan,
  Move 
} from "lucide-react";
import { cn } from "@/lib/utils";
import Hls from "hls.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QualityLevel {
  id: number;
  height: number;
  label: string;
}

function parseM3u(content: string): M3uChannel[] {
  const lines = content.split('\n');
  const channels: M3uChannel[] = [];
  let currentChannel: Partial<M3uChannel> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#EXTINF:')) {
      const nameMatch = trimmedLine.match(/,(.+)$/);
      const logoMatch = trimmedLine.match(/tvg-logo="([^"]+)"/);
      const groupMatch = trimmedLine.match(/group-title="([^"]+)"/);
      
      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        logo: logoMatch ? logoMatch[1] : undefined,
        group: groupMatch ? groupMatch[1] : undefined,
      };
    } else if (trimmedLine && !trimmedLine.startsWith('#') && currentChannel.name) {
      currentChannel.url = trimmedLine;
      channels.push(currentChannel as M3uChannel);
      currentChannel = {};
    }
  }

  return channels;
}

const PlaylistWatch = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const channelIndex = parseInt(searchParams.get("index") || "0", 10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_AUTO_RETRIES = 2;
  const triedDirectFallbackRef = useRef(false);

  const [playlist, setPlaylist] = useState<M3uPlaylist | null>(null);
  const [channels, setChannels] = useState<M3uChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<M3uChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamMode, setStreamMode] = useState<'proxy' | 'direct'>('proxy');

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill' | 'stretch'>(() => {
    const saved = localStorage.getItem('playlist-display-mode');
    return (saved as 'fit' | 'fill' | 'stretch') || 'stretch';
  });

  // Fetch fresh M3U content each time (via backend to avoid CORS + ensure freshness)
  const fetchFreshData = useCallback(async (): Promise<M3uChannel[] | null> => {
    if (!slug) return null;

    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        playlist: M3uPlaylist;
        channels: M3uChannel[];
      }>('fetch-m3u-playlist', {
        body: { slug, cacheBust: Date.now() },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.playlist) throw new Error('Playlist not found');

      setPlaylist(data.playlist);
      const parsedChannels = Array.isArray(data.channels) ? data.channels : [];
      setChannels(parsedChannels);
      return parsedChannels;
    } catch (err) {
      console.error('Error fetching M3U data:', err);
      throw err;
    }
  }, [slug]);

  const getProxyUrl = useCallback((url: string) => {
    if (!url) return '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);
    
    // Extract origin from stream URL to use as referer (helps with token-protected streams)
    try {
      const streamOrigin = new URL(url).origin;
      proxyUrl.searchParams.set('referer', streamOrigin + '/');
      proxyUrl.searchParams.set('origin', streamOrigin);
    } catch (e) {
      console.log('Could not extract origin from URL:', url);
    }
    
    return proxyUrl.toString();
  }, []);

  // Check if URL is HTTP (non-secure) - must always use proxy for mixed content
  const isHttpUrl = useCallback((url: string) => {
    try {
      return new URL(url).protocol === 'http:';
    } catch {
      return false;
    }
  }, []);

  const getStreamUrl = useCallback((url: string) => {
    // HTTP URLs must always go through proxy (mixed content blocking)
    if (isHttpUrl(url)) {
      return getProxyUrl(url);
    }
    if (streamMode === 'direct') return url;
    return getProxyUrl(url);
  }, [getProxyUrl, streamMode, isHttpUrl]);

  const lockLandscape = useCallback(async () => {
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (err) {
      console.log('Could not lock orientation:', err);
    }
  }, []);

  const unlockOrientation = useCallback(() => {
    try {
      if (screen.orientation && 'unlock' in screen.orientation) {
        screen.orientation.unlock();
      }
    } catch (err) {
      console.log('Could not unlock orientation:', err);
    }
  }, []);

  // Switch to direct mode if proxy fails
  const switchToDirectMode = useCallback((streamUrl: string) => {
    if (triedDirectFallbackRef.current) return false;
    // Don't switch to direct for HTTP URLs - browser will block mixed content
    if (isHttpUrl(streamUrl)) {
      console.log('HTTP stream detected, cannot use direct mode (mixed content)');
      return false;
    }
    console.log('Switching to direct stream mode (proxy unreachable)');
    triedDirectFallbackRef.current = true;
    setStreamMode('direct');
    setError(null);
    setLoading(true);
    return true;
  }, [isHttpUrl]);

  // Codes that indicate proxy couldn't reach the host
  const PROXY_UNREACHABLE_CODES = new Set(['DNS_ERROR', 'SSL_ERROR', 'CONNECTION_REFUSED', 'TIMEOUT']);

  // Pre-check proxy URL before initializing player
  const checkProxyAndPlay = useCallback(async (url: string): Promise<{ canUseProxy: boolean; errorCode?: string }> => {
    if (streamMode === 'direct') return { canUseProxy: false };
    
    const proxyUrl = getProxyUrl(url);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(proxyUrl, { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      const ct = res.headers.get('content-type') || '';
      
      // If response is JSON, it's an error from the proxy
      if (ct.includes('application/json')) {
        const body = await res.json();
        const code = body?.code || '';
        console.log('Proxy returned error:', code, body?.error);
        
        if (PROXY_UNREACHABLE_CODES.has(code)) {
          return { canUseProxy: false, errorCode: code };
        }
      }
      
      return { canUseProxy: true };
    } catch (e) {
      console.log('Proxy check failed:', e);
      return { canUseProxy: false, errorCode: 'FETCH_ERROR' };
    }
  }, [getProxyUrl, streamMode]);

  // Auto-refresh channel and retry stream on errors
  const refreshAndRetry = useCallback(async () => {
    if (retryCountRef.current >= MAX_AUTO_RETRIES) {
      console.log('Max auto-retries reached, showing error');
      setError("Stream unavailable. Please try again later.");
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    retryCountRef.current += 1;
    console.log(`Auto-retry attempt ${retryCountRef.current}/${MAX_AUTO_RETRIES}`);

    setIsRefreshing(true);
    setError(null);

    try {
      const freshChannels = await fetchFreshData();

      if (freshChannels && freshChannels.length > 0) {
        const channel = freshChannels[channelIndex];
        if (channel) {
          setCurrentChannel(channel);
        }
      }
    } catch (err) {
      setError("Failed to refresh channel data");
      setLoading(false);
    }
    setIsRefreshing(false);
  }, [fetchFreshData, channelIndex]);

  const initPlayer = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch fresh data each time
      const freshChannels = await fetchFreshData();
      if (!freshChannels || freshChannels.length === 0) {
        throw new Error('No channels found in playlist');
      }

      const channel = freshChannels[channelIndex];
      if (!channel) {
        throw new Error('Channel not found');
      }

      setCurrentChannel(channel);
      console.log('Playing channel:', channel.name, 'URL:', channel.url);

      // If using proxy mode, pre-check if proxy can reach the stream
      if (streamMode === 'proxy') {
        const { canUseProxy, errorCode } = await checkProxyAndPlay(channel.url);
        if (!canUseProxy && errorCode) {
          console.log(`Proxy failed with ${errorCode}, switching to direct mode`);
          if (switchToDirectMode(channel.url)) {
            return; // Will re-init with direct mode via useEffect
          }
        }
      }

      const streamUrl = getStreamUrl(channel.url);
      console.log('Using stream URL:', streamUrl, '(mode:', streamMode, ')');

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 10,
          maxMaxBufferLength: 30,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 4,
          liveDurationInfinity: true,
          startLevel: -1,
          capLevelToPlayerSize: false,
        });

        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          retryCountRef.current = 0;
          setLoading(false);
          video.muted = false;
          video.play().then(() => setIsPlaying(true)).catch(console.error);

          // Extract quality levels
          if (data.levels && data.levels.length > 0) {
            const levels: QualityLevel[] = data.levels
              .map((level, index) => ({
                id: index,
                height: level.height || 0,
                label: level.height ? `${level.height}p` : `${Math.round((level.bitrate || 0) / 1000)}kbps`,
              }))
              .filter((q) => q.height > 0)
              .sort((a, b) => b.height - a.height);
            
            setQualityLevels(levels);
          }
          setCurrentQuality(-1);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("HLS fatal error:", data);

            const isNetworkError = data.type === Hls.ErrorTypes.NETWORK_ERROR;
            const isManifestError =
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;

            // If proxy mode and network error, try switching to direct
            if ((isNetworkError || isManifestError) && streamMode === 'proxy' && currentChannel) {
              if (switchToDirectMode(currentChannel.url)) {
                return; // Will re-init via useEffect
              }
            }

            if ((isNetworkError || isManifestError) && retryCountRef.current < MAX_AUTO_RETRIES) {
              console.log('Network/manifest error detected, auto-refreshing...');
              refreshAndRetry();
            } else {
              setError("Stream error. Please try again.");
              setLoading(false);
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          retryCountRef.current = 0;
          setLoading(false);
          video.muted = false;
          video.play().then(() => setIsPlaying(true)).catch(console.error);
        });
        video.addEventListener('error', () => {
          // If proxy mode and error, try switching to direct
          if (streamMode === 'proxy' && currentChannel) {
            if (switchToDirectMode(currentChannel.url)) {
              return;
            }
          }

          if (retryCountRef.current < MAX_AUTO_RETRIES) {
            console.log('Video error detected, auto-refreshing...');
            refreshAndRetry();
          } else {
            setError("Stream error. Please try again.");
            setLoading(false);
          }
        });
      } else {
        setError("HLS not supported in this browser");
        setLoading(false);
      }
    } catch (err) {
      console.error('Error initializing player:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stream');
      setLoading(false);
    }
  }, [fetchFreshData, channelIndex, getStreamUrl, checkProxyAndPlay, switchToDirectMode, refreshAndRetry, streamMode, currentChannel]);

  // Initialize player on mount and channel change
  useEffect(() => {
    triedDirectFallbackRef.current = false;
    setStreamMode('proxy');
    retryCountRef.current = 0;
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      unlockOrientation();
    };
  }, [channelIndex, slug]);

  // Re-init when stream mode changes
  useEffect(() => {
    if (currentChannel && streamMode === 'direct') {
      initPlayer();
    }
  }, [streamMode]);

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      if (isNowFullscreen) {
        lockLandscape();
      } else {
        unlockOrientation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [lockLandscape, unlockOrientation]);

  // Controls visibility
  useEffect(() => {
    const resetControlsTimeout = () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(true);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', resetControlsTimeout);
      container.addEventListener('touchstart', resetControlsTimeout);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', resetControlsTimeout);
        container.removeEventListener('touchstart', resetControlsTimeout);
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying]);

  // Save display mode
  useEffect(() => {
    localStorage.setItem('playlist-display-mode', displayMode);
  }, [displayMode]);

  const handleClose = () => navigate(`/playlist/${slug}`);
  
  const handleRetry = async () => {
    retryCountRef.current = 0;
    triedDirectFallbackRef.current = false;
    setStreamMode('proxy');
    setIsRefreshing(true);
    setError(null);

    try {
      await initPlayer();
    } catch (err) {
      console.error('Retry failed:', err);
    }
    setIsRefreshing(false);
  };

  const handlePrevChannel = () => {
    if (channelIndex > 0) {
      navigate(`/playlist/${slug}/watch?index=${channelIndex - 1}`);
    }
  };

  const handleNextChannel = () => {
    if (channelIndex < channels.length - 1) {
      navigate(`/playlist/${slug}/watch?index=${channelIndex + 1}`);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleQualityChange = (levelId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
      hlsRef.current.nextLevel = levelId;
      hlsRef.current.loadLevel = levelId;
      setCurrentQuality(levelId);
    }
  };

  const handleAutoQuality = () => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = -1;
      hlsRef.current.nextLevel = -1;
      hlsRef.current.loadLevel = -1;
      setCurrentQuality(-1);
    }
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return "Auto";
    const quality = qualityLevels.find((q) => q.id === currentQuality);
    return quality?.label || "Auto";
  };

  const handleDisplayModeChange = (mode: 'fit' | 'fill' | 'stretch') => {
    setDisplayMode(mode);
  };

  const getDisplayModeClass = () => {
    switch (displayMode) {
      case 'fit': return 'object-contain';
      case 'fill': return 'object-cover';
      case 'stretch': return 'object-fill';
      default: return 'object-fill';
    }
  };

  // Loading state (no current channel yet)
  if (loading && !currentChannel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white/80">Loading channel...</p>
        </div>
      </div>
    );
  }

  // Error state (no current channel)
  if (error && !currentChannel) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-16 h-16 text-destructive" />
          <p className="text-white">{error}</p>
          <div className="flex gap-2">
            <Button onClick={handleClose} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleRetry} variant="outline" disabled={isRefreshing}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div
        ref={containerRef}
        className={cn(
          "relative bg-black overflow-hidden",
          // Always full-page like MyPlay (mobile-first)
          "h-[100svh] w-full"
        )}
      >
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-white/80">Connecting to stream...</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-20">
              <div className="flex flex-col items-center gap-4 text-center p-6">
                <AlertCircle className="w-12 h-12 text-destructive" />
                <p className="text-white">{error}</p>
                <Button onClick={handleRetry} variant="outline" disabled={isRefreshing}>
                  <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                  Retry
                </Button>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            className={cn("w-full h-full bg-black", getDisplayModeClass())}
            playsInline
            onClick={togglePlay}
          />

          {/* Controls overlay */}
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-300 z-10",
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/20">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <h2 className="text-white font-semibold">{currentChannel?.name}</h2>
                    <p className="text-white/60 text-sm">{playlist?.name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevChannel}
                    disabled={channelIndex === 0}
                    className="text-white hover:bg-white/20 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextChannel}
                    disabled={channels.length === 0 || channelIndex === channels.length - 1}
                    className="text-white hover:bg-white/20 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRetry}
                    disabled={isRefreshing}
                    className="text-white hover:bg-white/20"
                  >
                    <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Display Mode */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                        {displayMode === 'fit' && <RectangleHorizontal className="w-5 h-5" />}
                        {displayMode === 'fill' && <Scan className="w-5 h-5" />}
                        {displayMode === 'stretch' && <Move className="w-5 h-5" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDisplayModeChange('fit')}>
                        <RectangleHorizontal className="w-4 h-4 mr-2" />
                        Fit {displayMode === 'fit' && '✓'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDisplayModeChange('fill')}>
                        <Scan className="w-4 h-4 mr-2" />
                        Fill {displayMode === 'fill' && '✓'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDisplayModeChange('stretch')}>
                        <Move className="w-4 h-4 mr-2" />
                        Stretch {displayMode === 'stretch' && '✓'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Quality selector */}
                  {qualityLevels.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-1">
                          <Settings className="w-4 h-4" />
                          {getCurrentQualityLabel()}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleAutoQuality}>
                          Auto {currentQuality === -1 && '✓'}
                        </DropdownMenuItem>
                        {qualityLevels.map((q) => (
                          <DropdownMenuItem key={q.id} onClick={() => handleQualityChange(q.id)}>
                            {q.label} {currentQuality === q.id && '✓'}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-white/20"
                  >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default PlaylistWatch;
