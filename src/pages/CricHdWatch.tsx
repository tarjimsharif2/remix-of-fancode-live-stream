import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CricHdChannel, CricHdResponse } from "@/types/crichd";
import {
  Settings,
  RefreshCw,
  AlertCircle,
  RectangleHorizontal,
  Scan,
  Move,
  PictureInPicture2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface QualityLevel {
  id: number;
  height: number;
  label: string;
}

const AUTO_RETRY_INTERVAL = 10000;
const MAX_AUTO_RETRIES = 3;

const CricHdWatch = () => {
  const [searchParams] = useSearchParams();
  const channelId = searchParams.get("id");

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  const [channel, setChannel] = useState<CricHdChannel | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill' | 'stretch'>(() => {
    const saved = localStorage.getItem('videoDisplayMode');
    return (saved as 'fit' | 'fill' | 'stretch') || 'stretch';
  });

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch channel data by ID
  const fetchChannelData = useCallback(async (): Promise<CricHdChannel | null> => {
    if (!channelId) {
      setError("No channel ID provided");
      return null;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke<CricHdResponse>('fetch-crichd-channels');

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success && data.channels) {
        const foundChannel = data.channels.find(ch => ch.id === channelId);
        if (foundChannel) {
          return foundChannel;
        } else {
          setError("Channel not found");
          return null;
        }
      } else {
        setError(data?.error || "Failed to fetch channels");
        return null;
      }
    } catch (err) {
      console.error("Error fetching channel:", err);
      setError(err instanceof Error ? err.message : "Failed to load channel");
      return null;
    }
  }, [channelId]);

  // Initial channel load
  useEffect(() => {
    const loadChannel = async () => {
      setChannelLoading(true);
      const fetchedChannel = await fetchChannelData();
      if (fetchedChannel) {
        setChannel(fetchedChannel);
      }
      setChannelLoading(false);
    };
    
    loadChannel();
  }, [fetchChannelData]);

  // Build proxy URL for the stream
  const getProxyUrl = useCallback((url: string) => {
    if (!channel) return url;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);
    if (channel.referer) proxyUrl.searchParams.set('referer', channel.referer);
    if (channel.origin) proxyUrl.searchParams.set('origin', channel.origin);
    return proxyUrl.toString();
  }, [channel]);

  const stopAutoRetry = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  const startAutoRetry = useCallback(() => {
    stopAutoRetry();
    retryIntervalRef.current = setInterval(() => {
      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        retryCountRef.current += 1;
        console.log(`Auto-retry attempt ${retryCountRef.current}/${MAX_AUTO_RETRIES}`);
        initPlayer();
      } else {
        stopAutoRetry();
      }
    }, AUTO_RETRY_INTERVAL);
  }, [stopAutoRetry]);

  const initPlayer = useCallback(async () => {
    if (!playerContainerRef.current || !channel?.link) {
      return;
    }

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setQualities([]);
    setCurrentQuality(-1);
    stopAutoRetry();

    const proxiedStreamUrl = getProxyUrl(channel.link);
    console.log('Using proxied stream URL:', proxiedStreamUrl);

    try {
      const Clappr = await import('@clappr/player');
      const HlsjsPlayback = await import('@clappr/hlsjs-playback');

      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }

      setIsPiPSupported('pictureInPictureEnabled' in document && (document as any).pictureInPictureEnabled);

      const player = new Clappr.default.Player({
        parent: playerContainerRef.current,
        source: proxiedStreamUrl,
        plugins: [HlsjsPlayback.default],
        playback: {
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 12,
            maxMaxBufferLength: 30,
            maxBufferSize: 30 * 1000 * 1000,
            maxBufferHole: 0.5,
            startLevel: -1,
            abrEwmaDefaultEstimate: 4000000,
            abrBandWidthFactor: 0.95,
            abrBandWidthUpFactor: 0.7,
            fragLoadingTimeOut: 7000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 400,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
          }
        },
        hlsPlayback: {
          preload: true,
        },
        autoPlay: true,
        mute: false,
        disableVideoTagContextMenu: true,
        disableKeyboardShortcuts: true,
        chromeless: false,
        allowUserInteraction: false,
        clickToPause: false,
        height: '100%',
        width: '100%',
        mediacontrol: {
          seekbar: '#10b981',
          buttons: '#ffffff'
        },
        events: {
          onError: (e: any) => {
            console.error('Clappr error:', e);
            setError('Stream unavailable. Retrying...');
            setIsLoading(false);
            startAutoRetry();
          },
          onPlay: () => {
            setIsLoading(false);
            retryCountRef.current = 0;
            stopAutoRetry();
          },
          onReady: () => {
            setIsLoading(false);
            
            const extractQualities = () => {
              try {
                const playback = player.core?.getCurrentPlayback?.();

                const levels = (playback as any)?.levels;
                if (Array.isArray(levels) && levels.length > 0) {
                  const qualityList: QualityLevel[] = levels
                    .map((lvl: any) => ({
                      id: typeof lvl?.id === 'number' ? lvl.id : lvl?.levelId,
                      height: lvl?.level?.height || lvl?.height || 0,
                      label: lvl?.label || (lvl?.level?.height ? `${lvl.level.height}p` : (lvl?.height ? `${lvl.height}p` : 'Auto')),
                    }))
                    .filter((q: QualityLevel) => typeof q.id === 'number' && q.height > 0)
                    .sort((a: QualityLevel, b: QualityLevel) => b.height - a.height);

                  if (qualityList.length > 0) {
                    setQualities(qualityList);
                    return true;
                  }
                }

                const hls = (playback as any)?._hls || (playback as any)?.hls;
                if (hls && Array.isArray(hls.levels) && hls.levels.length > 0) {
                  const qualityList: QualityLevel[] = hls.levels
                    .map((lvl: any, index: number) => ({
                      id: index,
                      height: lvl.height || 0,
                      label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
                    }))
                    .filter((q: QualityLevel) => q.height > 0)
                    .sort((a: QualityLevel, b: QualityLevel) => b.height - a.height);

                  if (qualityList.length > 0) {
                    setQualities(qualityList);
                    return true;
                  }
                }
              } catch (err) {
                console.log('Could not extract qualities:', err);
              }
              return false;
            };

            const tryExtract = (attempts: number) => {
              if (attempts <= 0) return;
              if (!extractQualities()) {
                setTimeout(() => tryExtract(attempts - 1), 800);
              }
            };
            tryExtract(8);

            const videoElement = player.core?.getCurrentPlayback?.()?.el;
            if (videoElement) {
              videoElement.addEventListener('enterpictureinpicture', () => setIsPiPActive(true));
              videoElement.addEventListener('leavepictureinpicture', () => setIsPiPActive(false));
            }
          }
        }
      });

      playerRef.current = player;

      player.on(Clappr.default.Events.PLAYER_ERROR, () => {
        setError('Stream unavailable. Retrying...');
        setIsLoading(false);
        startAutoRetry();
      });

    } catch (err) {
      console.error('Failed to initialize player:', err);
      setError('Failed to load video player. Please try again.');
      setIsLoading(false);
      startAutoRetry();
    }
  }, [channel, getProxyUrl, stopAutoRetry, startAutoRetry]);

  useEffect(() => {
    if (channel) {
      initPlayer();
    }

    return () => {
      stopAutoRetry();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [channel]);

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (isFullscreen) {
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
      unlockOrientation();
    };
  }, [lockLandscape, unlockOrientation]);

  const handleRetry = async () => {
    retryCountRef.current = 0;
    setIsRefreshing(true);
    setError(null);
    
    const freshChannel = await fetchChannelData();
    
    if (freshChannel) {
      setChannel(freshChannel);
    }
    setIsRefreshing(false);
  };

  const handleQualityChange = (levelId: number) => {
    try {
      const playback = playerRef.current?.core?.getCurrentPlayback?.();

      if ((playback as any)?.setLevel) {
        (playback as any).setLevel(levelId);
        setCurrentQuality(levelId);
        return;
      }

      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = levelId;
        if (typeof hls.nextLevel === 'number') hls.nextLevel = levelId;
        if (typeof hls.loadLevel === 'number') hls.loadLevel = levelId;
        setCurrentQuality(levelId);
      }
    } catch (err) {
      console.error('Quality change error:', err);
    }
  };

  const handleAutoQuality = () => {
    try {
      const playback = playerRef.current?.core?.getCurrentPlayback?.();

      if ((playback as any)?.setLevel) {
        (playback as any).setLevel(-1);
        setCurrentQuality(-1);
        return;
      }

      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = -1;
        if (typeof hls.nextLevel === 'number') hls.nextLevel = -1;
        if (typeof hls.loadLevel === 'number') hls.loadLevel = -1;
        setCurrentQuality(-1);
      }
    } catch (err) {
      console.error('Auto quality error:', err);
    }
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return "Auto";
    const quality = qualities.find((q) => q.id === currentQuality);
    return quality?.label || "Auto";
  };

  const togglePiP = async () => {
    try {
      const videoElement = playerRef.current?.core?.getCurrentPlayback?.()?.el;
      if (!videoElement) return;

      if (isPiPActive) {
        await (document as any).exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

  const handleDisplayModeChange = (mode: 'fit' | 'fill' | 'stretch') => {
    setDisplayMode(mode);
    localStorage.setItem('videoDisplayMode', mode);
    
    // Apply to Clappr container
    if (playerContainerRef.current) {
      const videoEl = playerContainerRef.current.querySelector('video');
      if (videoEl) {
        videoEl.style.objectFit = mode === 'fit' ? 'contain' : mode === 'fill' ? 'cover' : 'fill';
      }
    }
  };

  const getDisplayModeIcon = () => {
    switch (displayMode) {
      case 'fit':
        return <RectangleHorizontal className="w-4 h-4" />;
      case 'fill':
        return <Scan className="w-4 h-4" />;
      case 'stretch':
        return <Move className="w-4 h-4" />;
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Loading channel data
  if (channelLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white">Loading channel...</p>
        </div>
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
      className="fixed inset-0 bg-black"
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Loading state */}
      {(isLoading || isRefreshing) && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white">
              {isRefreshing ? "Refreshing stream..." : "Loading stream..."}
            </p>
            {retryCountRef.current > 0 && (
              <p className="text-gray-400 text-sm">
                Auto-retry {retryCountRef.current}/{MAX_AUTO_RETRIES}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !channelLoading && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl mb-2">{error}</h2>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleRetry} variant="outline" disabled={isRefreshing}>
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Refreshing..." : "Refresh & Retry"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Clappr player container */}
      <div 
        ref={playerContainerRef} 
        className="w-full h-full"
        style={{ 
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Custom controls overlay */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-300 z-20",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h1 className="text-white font-semibold text-lg truncate">
                {channel.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
          <div className="flex items-center justify-end gap-2">
            {/* PiP Button */}
            {isPiPSupported && (
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePiP}
                className="text-white hover:bg-white/20"
              >
                <PictureInPicture2 className={cn("w-5 h-5", isPiPActive && "text-primary")} />
              </Button>
            )}

            {/* Display Mode Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                >
                  {getDisplayModeIcon()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-gray-700">
                <DropdownMenuItem
                  onClick={() => handleDisplayModeChange('fit')}
                  className={cn(
                    "text-white hover:bg-white/20",
                    displayMode === 'fit' && "bg-primary/20"
                  )}
                >
                  <RectangleHorizontal className="w-4 h-4 mr-2" />
                  Fit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDisplayModeChange('fill')}
                  className={cn(
                    "text-white hover:bg-white/20",
                    displayMode === 'fill' && "bg-primary/20"
                  )}
                >
                  <Scan className="w-4 h-4 mr-2" />
                  Fill
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDisplayModeChange('stretch')}
                  className={cn(
                    "text-white hover:bg-white/20",
                    displayMode === 'stretch' && "bg-primary/20"
                  )}
                >
                  <Move className="w-4 h-4 mr-2" />
                  Stretch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Quality Selector */}
            {qualities.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 gap-1"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-xs">{getCurrentQualityLabel()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-black/90 border-gray-700">
                  <DropdownMenuItem
                    onClick={handleAutoQuality}
                    className={cn(
                      "text-white hover:bg-white/20",
                      currentQuality === -1 && "bg-primary/20"
                    )}
                  >
                    Auto
                  </DropdownMenuItem>
                  {qualities.map((quality) => (
                    <DropdownMenuItem
                      key={quality.id}
                      onClick={() => handleQualityChange(quality.id)}
                      className={cn(
                        "text-white hover:bg-white/20",
                        currentQuality === quality.id && "bg-primary/20"
                      )}
                    >
                      {quality.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CricHdWatch;
