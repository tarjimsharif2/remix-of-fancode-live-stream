import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";
import { CustomChannel } from "@/types/customChannel";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Settings2,
  RefreshCw,
  AlertCircle,
  RectangleHorizontal,
  Scan,
  Move,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PlayerType, PLAYER_CONFIGS, getPlayerConfig } from "@/types/playerTypes";
import { ClapprPlayer } from "@/components/players/ClapprPlayer";
import { ClapprProxyPlayer } from "@/components/players/ClapprProxyPlayer";
import { HlsJsPlayer } from "@/components/players/HlsJsPlayer";
import { IframePlayer } from "@/components/players/IframePlayer";

interface QualityLevel {
  id: number;
  height: number;
  label: string;
}

const MyPlayWatch = () => {
  const [searchParams] = useSearchParams();
  const channelId = searchParams.get("id");

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_AUTO_RETRIES = 2;
  const lastProxyUrlRef = useRef<string | null>(null);
  const triedDirectFallbackRef = useRef(false);

  const [channel, setChannel] = useState<CustomChannel | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamMode, setStreamMode] = useState<'proxy' | 'direct'>('proxy');
  const [playerType, setPlayerType] = useState<PlayerType>('hlsjs');
  const [playerKey, setPlayerKey] = useState(0);
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill' | 'stretch'>(() => {
    const saved = localStorage.getItem('videoDisplayMode');
    return (saved as 'fit' | 'fill' | 'stretch') || 'stretch';
  });

  // Fetch channel data by ID
  const fetchChannelData = useCallback(async (): Promise<CustomChannel | null> => {
    if (!channelId) {
      setError("No channel ID provided");
      return null;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('custom_channels')
        .select('*')
        .eq('id', channelId)
        .eq('is_active', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError("Channel not found");
        } else {
          throw new Error(fetchError.message);
        }
        return null;
      }

      return data as CustomChannel;
    } catch (err) {
      console.error("Error fetching channel:", err);
      setError(err instanceof Error ? err.message : "Failed to load channel");
      return null;
    }
  }, [channelId]);
  // Initial channel load
  useEffect(() => {
    const loadChannel = async () => {
      triedDirectFallbackRef.current = false;
      setStreamMode('proxy');
      setChannelLoading(true);
      const fetchedChannel = await fetchChannelData();
      if (fetchedChannel) {
        setChannel(fetchedChannel);
        if (fetchedChannel.player_type) {
          setPlayerType(fetchedChannel.player_type as PlayerType);
        }
      }
      setChannelLoading(false);
    };

    loadChannel();
  }, [fetchChannelData]);

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

  // Build proxy URL for the stream with custom headers
  const getProxyUrl = useCallback((url: string) => {
    if (!channel) return url;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);

    // Add custom headers
    if (channel.custom_referer) proxyUrl.searchParams.set('referer', channel.custom_referer);
    if (channel.custom_origin) proxyUrl.searchParams.set('origin', channel.custom_origin);
    if (channel.custom_user_agent) proxyUrl.searchParams.set('user_agent', channel.custom_user_agent);
    if (channel.custom_cookie) proxyUrl.searchParams.set('cookie', channel.custom_cookie);

    // Add any extra custom headers as JSON
    if (channel.custom_headers && Object.keys(channel.custom_headers).length > 0) {
      proxyUrl.searchParams.set('custom_headers', JSON.stringify(channel.custom_headers));
    }

    return proxyUrl.toString();
  }, [channel]);

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
      const proxied = getProxyUrl(url);
      lastProxyUrlRef.current = proxied;
      return proxied;
    }
    if (streamMode === 'direct') return url;
    const proxied = getProxyUrl(url);
    lastProxyUrlRef.current = proxied;
    return proxied;
  }, [getProxyUrl, streamMode, isHttpUrl]);

  // Auto-refresh channel and retry stream on errors
  const refreshAndRetry = useCallback(async () => {
    if (retryCountRef.current >= MAX_AUTO_RETRIES) {
      console.log('Max auto-retries reached, showing error');
      setError("Stream unavailable. Please try again later.");
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    retryCountRef.current += 1;
    console.log(`Auto-retry attempt ${retryCountRef.current}/${MAX_AUTO_RETRIES}`);

    setIsRefreshing(true);
    setError(null);

    const freshChannel = await fetchChannelData();

    if (freshChannel) {
      console.log('Got fresh channel data, retrying stream...');
      setChannel(freshChannel);
      setIsRefreshing(false);
    } else {
      setError("Failed to refresh channel data");
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchChannelData]);

  // Codes that indicate proxy couldn't reach the host; direct might work from client.
  const PROXY_UNREACHABLE_CODES = new Set(['DNS_ERROR', 'SSL_ERROR', 'CONNECTION_REFUSED', 'TIMEOUT']);

  // If proxy cannot reach the upstream (DNS/SSL/etc), automatically try direct playback once.
  // But never switch to direct for HTTP URLs (mixed content would fail)
  const switchToDirectMode = useCallback(() => {
    if (triedDirectFallbackRef.current) return false;
    // Don't switch to direct for HTTP URLs - browser will block mixed content
    if (channel?.stream_url && isHttpUrl(channel.stream_url)) {
      console.log('HTTP stream detected, cannot use direct mode (mixed content)');
      return false;
    }
    console.log('Switching to direct stream mode (proxy unreachable)');
    triedDirectFallbackRef.current = true;
    setStreamMode('direct');
    setError(null);
    setIsLoading(true);
    return true;
  }, [channel?.stream_url, isHttpUrl]);

  // Pre-check proxy URL before initializing player
  const checkProxyAndPlay = useCallback(async (url: string): Promise<{ canUseProxy: boolean; errorCode?: string }> => {
    if (streamMode === 'direct') return { canUseProxy: false };
    
    const proxyUrl = getProxyUrl(url);
    lastProxyUrlRef.current = proxyUrl;
    
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

  const initPlayer = useCallback(async () => {
    if (!channel?.stream_url || !videoRef.current) return;

    setIsLoading(true);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // If using proxy mode, pre-check if proxy can reach the stream
    if (streamMode === 'proxy') {
      const { canUseProxy, errorCode } = await checkProxyAndPlay(channel.stream_url);
      if (!canUseProxy && errorCode) {
        console.log(`Proxy failed with ${errorCode}, switching to direct mode`);
        if (switchToDirectMode()) {
          return; // Will re-init with direct mode via useEffect
        }
      }
    }

    const video = videoRef.current;
    if (!video) return;
    
    const streamUrlToPlay = getStreamUrl(channel.stream_url);
    console.log('Using stream URL:', streamUrlToPlay, '(mode:', streamMode, ')');

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
      hls.loadSource(streamUrlToPlay);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        retryCountRef.current = 0;
        setIsLoading(false);
        video.muted = false;
        video.play().catch(console.error);
        setIsPlaying(true);

        if (hls.levels && hls.levels.length > 0) {
          const qualityList: QualityLevel[] = hls.levels
            .map((lvl, index) => ({
              id: index,
              height: lvl.height || 0,
              label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
            }))
            .filter((q) => q.height > 0)
            .sort((a, b) => b.height - a.height);

          setQualities(qualityList);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data);

          const isNetworkError = data.type === Hls.ErrorTypes.NETWORK_ERROR;
          const isManifestError =
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;

          // If proxy mode and network error, try switching to direct
          if ((isNetworkError || isManifestError) && streamMode === 'proxy') {
            if (switchToDirectMode()) {
              return; // Will re-init via useEffect
            }
          }

          if ((isNetworkError || isManifestError) && retryCountRef.current < MAX_AUTO_RETRIES) {
            console.log('Network/manifest error detected, auto-refreshing...');
            refreshAndRetry();
          } else {
            setError("Stream error. Please try again.");
            setIsLoading(false);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrlToPlay;
      video.addEventListener("loadedmetadata", () => {
        retryCountRef.current = 0;
        setIsLoading(false);
        video.muted = false;
        video.play().catch(console.error);
        setIsPlaying(true);
      });
      video.addEventListener("error", () => {
        // If proxy mode and error, try switching to direct
        if (streamMode === 'proxy') {
          if (switchToDirectMode()) {
            return;
          }
        }

        if (retryCountRef.current < MAX_AUTO_RETRIES) {
          console.log('Video error detected, auto-refreshing...');
          refreshAndRetry();
        } else {
          setError("Stream error. Please try again.");
          setIsLoading(false);
        }
      });
    } else {
      setError("HLS not supported in this browser");
      setIsLoading(false);
    }
  }, [channel, getStreamUrl, checkProxyAndPlay, switchToDirectMode, refreshAndRetry, streamMode]);

  useEffect(() => {
    if (channel) {
      initPlayer();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      unlockOrientation();
    };
  }, [channel, initPlayer, unlockOrientation]);

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

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [lockLandscape, unlockOrientation]);

  const handleRetry = async () => {
    retryCountRef.current = 0;
    triedDirectFallbackRef.current = false;
    setStreamMode('proxy');
    setIsRefreshing(true);
    setError(null);

    const freshChannel = await fetchChannelData();

    if (freshChannel) {
      setChannel(freshChannel);
    }
    setIsRefreshing(false);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
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
    const quality = qualities.find((q) => q.id === currentQuality);
    return quality?.label || "Auto";
  };

  const handleDisplayModeChange = (mode: 'fit' | 'fill' | 'stretch') => {
    setDisplayMode(mode);
    localStorage.setItem('videoDisplayMode', mode);
  };

  const getDisplayModeClass = () => {
    switch (displayMode) {
      case 'fit': return 'object-contain';
      case 'fill': return 'object-cover';
      case 'stretch': return 'object-fill';
      default: return 'object-fill';
    }
  };

  const getDisplayModeIcon = () => {
    switch (displayMode) {
      case 'fit': return <RectangleHorizontal className="w-4 h-4" />;
      case 'fill': return <Scan className="w-4 h-4" />;
      case 'stretch': return <Move className="w-4 h-4" />;
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  if (channelLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!channelId || !channel) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl mb-2">{error || "Invalid Channel"}</h2>
          <p className="text-gray-400 mb-4">Channel not found or invalid ID</p>
          <Button onClick={() => window.history.back()} variant="outline">
            Back to Channels
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Loading state - minimal spinner only */}
      {(isLoading || isRefreshing) && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && !channelLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center text-white max-w-md px-4">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl mb-2">{error}</h2>
            {streamMode === 'direct' && (
              <p className="text-yellow-400 text-sm mb-2">
                Note: This stream may require specific network access or region.
              </p>
            )}
            <p className="text-gray-400 text-sm mb-4">
              The stream server may be temporarily unavailable or unreachable from your location.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleRetry} variant="outline" disabled={isRefreshing}>
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Refreshing..." : "Refresh & Retry"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video player */}
      <video
        ref={videoRef}
        className={cn("w-full h-full", getDisplayModeClass())}
        playsInline
        muted={isMuted}
        autoPlay
      />

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg truncate">
              {channel.name}
            </h1>
          </div>
        </div>

        {/* Center play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="ghost"
            size="lg"
            className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </Button>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={togglePlay}>
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white" />
            )}
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleMute}>
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </Button>

          <div className="flex-1" />

          {/* Display Mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {getDisplayModeIcon()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
              <DropdownMenuItem
                onClick={() => handleDisplayModeChange('fit')}
                className={cn("text-white", displayMode === 'fit' && "bg-white/20")}
              >
                <RectangleHorizontal className="w-4 h-4 mr-2" />
                Fit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDisplayModeChange('fill')}
                className={cn("text-white", displayMode === 'fill' && "bg-white/20")}
              >
                <Scan className="w-4 h-4 mr-2" />
                Fill
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDisplayModeChange('stretch')}
                className={cn("text-white", displayMode === 'stretch' && "bg-white/20")}
              >
                <Move className="w-4 h-4 mr-2" />
                Stretch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quality selector */}
          {qualities.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white gap-2">
                  <Settings className="w-4 h-4" />
                  {getCurrentQualityLabel()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
                <DropdownMenuItem
                  onClick={handleAutoQuality}
                  className={cn("text-white", currentQuality === -1 && "bg-white/20")}
                >
                  Auto
                </DropdownMenuItem>
                {qualities.map((q) => (
                  <DropdownMenuItem
                    key={q.id}
                    onClick={() => handleQualityChange(q.id)}
                    className={cn("text-white", currentQuality === q.id && "bg-white/20")}
                  >
                    {q.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-white" />
            ) : (
              <Maximize className="w-5 h-5 text-white" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MyPlayWatch;
