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
import { ClapprPlayer } from "@/components/players/ClapprPlayer";

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

type PlayerEngine = 'hlsjs' | 'clappr';

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

  const [playlist, setPlaylist] = useState<M3uPlaylist | null>(null);
  const [channels, setChannels] = useState<M3uChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<M3uChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playerEngine, setPlayerEngine] = useState<PlayerEngine>('hlsjs');
  const [playerKey, setPlayerKey] = useState(0);

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
  const fetchFreshData = useCallback(async (): Promise<{ playlist: M3uPlaylist | null; channels: M3uChannel[] }> => {
    if (!slug) return { playlist: null, channels: [] };

    try {
      const { data, error: fnError } = await supabase.functions.invoke<{
        playlist: M3uPlaylist;
        channels: M3uChannel[];
      }>('fetch-m3u-playlist', {
        body: { slug, cacheBust: Date.now() },
      });

      if (fnError) throw new Error(fnError.message);
      if (!data?.playlist) throw new Error('Playlist not found');

      const parsedChannels = Array.isArray(data.channels) ? data.channels : [];
      return { playlist: data.playlist, channels: parsedChannels };
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
    
    // Extract origin from stream URL to use as referer
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

  // Check if the URL is from aynascope.net - these have IP restrictions and must play directly
  const isAynascopeUrl = useCallback((url: string) => {
    try {
      return new URL(url).hostname.includes('aynascope.net');
    } catch {
      return false;
    }
  }, []);

  const getStreamUrl = useCallback((url: string) => {
    // aynascope.net streams have IP restrictions - play directly without proxy
    if (isAynascopeUrl(url)) {
      console.log('AynaOTT stream detected, playing directly (no proxy):', url);
      return url;
    }
    // Always use proxy for HLS streams to handle CORS and tokens
    if (url.includes('.m3u8') || isHttpUrl(url)) {
      return getProxyUrl(url);
    }
    return url;
  }, [getProxyUrl, isHttpUrl, isAynascopeUrl]);

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
      const { channels: freshChannels } = await fetchFreshData();

      if (freshChannels && freshChannels.length > 0) {
        const channel = freshChannels[channelIndex];
        if (channel) {
          setChannels(freshChannels);
          setCurrentChannel(channel);
          setPlayerKey(prev => prev + 1);
        }
      }
    } catch (err) {
      setError("Failed to refresh channel data");
      setLoading(false);
    }
    setIsRefreshing(false);
  }, [fetchFreshData, channelIndex]);

  const initPlayer = useCallback(async () => {
    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch fresh data
      const { playlist: fetchedPlaylist, channels: freshChannels } = await fetchFreshData();
      
      if (!fetchedPlaylist) {
        throw new Error('Playlist not found');
      }
      
      if (!freshChannels || freshChannels.length === 0) {
        throw new Error('No channels found in playlist');
      }

      setPlaylist(fetchedPlaylist);
      setChannels(freshChannels);
      
      // Set player engine from playlist settings
      const defaultPlayer = fetchedPlaylist.default_player || 'hlsjs';
      if (defaultPlayer === 'clappr') {
        setPlayerEngine('clappr');
      } else {
        setPlayerEngine('hlsjs');
      }

      const channel = freshChannels[channelIndex];
      if (!channel) {
        throw new Error('Channel not found');
      }

      setCurrentChannel(channel);
      console.log('Playing channel:', channel.name, 'URL:', channel.url);
      setLoading(false);
    } catch (err) {
      console.error('Error initializing player:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stream');
      setLoading(false);
    }
  }, [fetchFreshData, channelIndex]);

  // Initialize HLS.js when channel is ready and video element is available
  useEffect(() => {
    if (!currentChannel || playerEngine !== 'hlsjs' || loading) return;
    
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = getStreamUrl(currentChannel.url);
    console.log('Initializing HLS with:', streamUrl);

    if (Hls.isSupported()) {
      const isAyna = isAynascopeUrl(currentChannel.url);
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
        // For aynascope.net direct streams, set custom headers
        ...(isAyna ? {
          xhrSetup: (xhr: XMLHttpRequest) => {
            // Browser won't let us set Origin/Referer, but we can try
            // The key is that the request comes from user's IP directly
          },
        } : {}),
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        retryCountRef.current = 0;
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
          
          if (retryCountRef.current < MAX_AUTO_RETRIES) {
            console.log('Fatal error detected, auto-refreshing...');
            refreshAndRetry();
          } else {
            setError("Stream error. Please try again.");
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        retryCountRef.current = 0;
        video.muted = false;
        video.play().then(() => setIsPlaying(true)).catch(console.error);
      });
      video.addEventListener('error', () => {
        if (retryCountRef.current < MAX_AUTO_RETRIES) {
          console.log('Video error detected, auto-refreshing...');
          refreshAndRetry();
        } else {
          setError("Stream error. Please try again.");
        }
      });
    } else {
      setError("HLS not supported in this browser");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentChannel, playerEngine, loading, getStreamUrl, refreshAndRetry, playerKey]);

  // Initialize player on mount and channel change
  useEffect(() => {
    retryCountRef.current = 0;
    setCurrentChannel(null);
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      unlockOrientation();
    };
  }, [channelIndex, slug]);

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
    setPlayerKey(prev => prev + 1);
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

  const handlePlayerEngineChange = (engine: PlayerEngine) => {
    setPlayerEngine(engine);
    setPlayerKey(prev => prev + 1);
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Video Container */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-black flex items-center justify-center overflow-hidden"
      >
        {/* Player */}
        {playerEngine === 'clappr' && currentChannel ? (
          <ClapprPlayer 
            key={playerKey} 
            streamUrl={getStreamUrl(currentChannel.url)} 
          />
        ) : (
          <video
            ref={videoRef}
            className={cn("w-full h-full", getDisplayModeClass())}
            playsInline
            autoPlay
            onClick={togglePlay}
          />
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-40">
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <p className="text-white/90">{error}</p>
              <Button onClick={handleRetry} variant="outline" size="sm">
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div
          className={cn(
            "absolute inset-0 z-30 flex flex-col justify-between pointer-events-none transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Top Bar */}
          <div className="bg-gradient-to-b from-black/80 to-transparent p-3 pointer-events-auto">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-medium truncate">
                  {currentChannel?.name || "Loading..."}
                </h2>
                {currentChannel?.group && (
                  <p className="text-white/60 text-sm truncate">{currentChannel.group}</p>
                )}
              </div>
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
          </div>

          {/* Bottom Bar */}
          <div className="bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-auto">
            <div className="flex items-center justify-between">
              {/* Left Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevChannel}
                  disabled={channelIndex === 0}
                  className="text-white hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                
                {playerEngine === 'hlsjs' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleNextChannel}
                  disabled={channelIndex >= channels.length - 1}
                  className="text-white hover:bg-white/20 disabled:opacity-30"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>

              {/* Center Info */}
              <div className="text-white/60 text-sm">
                {channelIndex + 1} / {channels.length || '...'}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1">
                {playerEngine === 'hlsjs' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                )}

                {/* Settings Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                    >
                      <Settings className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-zinc-900/95 border-white/10">
                    {/* Player Engine */}
                    <div className="px-2 py-1.5 text-xs text-white/50 font-medium">Player</div>
                    <DropdownMenuItem
                      onClick={() => handlePlayerEngineChange('hlsjs')}
                      className={cn("text-white", playerEngine === 'hlsjs' && "bg-primary/20")}
                    >
                      HLS.js {playerEngine === 'hlsjs' && '✓'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handlePlayerEngineChange('clappr')}
                      className={cn("text-white", playerEngine === 'clappr' && "bg-primary/20")}
                    >
                      Clappr {playerEngine === 'clappr' && '✓'}
                    </DropdownMenuItem>

                    {playerEngine === 'hlsjs' && qualityLevels.length > 0 && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <div className="px-2 py-1.5 text-xs text-white/50 font-medium">
                          Quality ({getCurrentQualityLabel()})
                        </div>
                        <DropdownMenuItem
                          onClick={handleAutoQuality}
                          className={cn("text-white", currentQuality === -1 && "bg-primary/20")}
                        >
                          Auto {currentQuality === -1 && '✓'}
                        </DropdownMenuItem>
                        {qualityLevels.map((q) => (
                          <DropdownMenuItem
                            key={q.id}
                            onClick={() => handleQualityChange(q.id)}
                            className={cn("text-white", currentQuality === q.id && "bg-primary/20")}
                          >
                            {q.label} {currentQuality === q.id && '✓'}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}

                    {playerEngine === 'hlsjs' && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <div className="px-2 py-1.5 text-xs text-white/50 font-medium">Display</div>
                        <DropdownMenuItem
                          onClick={() => handleDisplayModeChange('fit')}
                          className={cn("text-white gap-2", displayMode === 'fit' && "bg-primary/20")}
                        >
                          <Scan className="w-4 h-4" /> Fit {displayMode === 'fit' && '✓'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDisplayModeChange('fill')}
                          className={cn("text-white gap-2", displayMode === 'fill' && "bg-primary/20")}
                        >
                          <RectangleHorizontal className="w-4 h-4" /> Fill {displayMode === 'fill' && '✓'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDisplayModeChange('stretch')}
                          className={cn("text-white gap-2", displayMode === 'stretch' && "bg-primary/20")}
                        >
                          <Move className="w-4 h-4" /> Stretch {displayMode === 'stretch' && '✓'}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

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
