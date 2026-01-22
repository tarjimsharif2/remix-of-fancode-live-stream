import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Globe, RefreshCw, Settings, PictureInPicture2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface QualityLevel {
  id: number;
  label: string;
  height: number;
}

const AUTO_RETRY_INTERVAL = 10000;

// Check if running inside an iframe from allowed domain (async version that fetches from DB)
const checkIframeAccessAsync = async (allowedDomains: string[]): Promise<{ isAllowed: boolean; reason: string }> => {
  const isInIframe = window.self !== window.top;
  
  if (!isInIframe) {
    return { isAllowed: false, reason: 'This player can only be accessed via embed.' };
  }

  const isDev = window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('lovableproject.com') ||
    window.location.hostname.includes('lovable.app') ||
    window.location.hostname.includes('vercel.app');

  if (isDev) {
    return { isAllowed: true, reason: '' };
  }

  try {
    const parentOrigin = document.referrer;
    
    if (!parentOrigin) {
      return { isAllowed: false, reason: 'Unable to verify parent origin.' };
    }

    const parentUrl = new URL(parentOrigin);
    const parentHostname = parentUrl.hostname;

    const isAllowedDomain = allowedDomains.some(domain => 
      parentHostname === domain || parentHostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return { isAllowed: false, reason: 'Embedding not authorized for this domain.' };
    }

    return { isAllowed: true, reason: '' };
  } catch {
    const referrer = document.referrer;
    if (referrer) {
      try {
        const refUrl = new URL(referrer);
        const isAllowed = allowedDomains.some(domain => 
          refUrl.hostname === domain || refUrl.hostname.endsWith('.' + domain)
        );
        if (isAllowed) {
          return { isAllowed: true, reason: '' };
        }
      } catch {
        // Invalid referrer URL
      }
    }
    return { isAllowed: false, reason: 'Unable to verify embed origin.' };
  }
};

const WatchWorldwide = () => {
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('id') || '';
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingStream, setIsFetchingStream] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [iframeAccess, setIframeAccess] = useState<{ isAllowed: boolean; reason: string } | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  // Check iframe access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-allowed-domains');
        
        if (fnError) {
          console.error('Failed to fetch allowed domains:', fnError);
          const isDev = window.location.hostname.includes('localhost') || 
            window.location.hostname.includes('lovableproject.com') ||
            window.location.hostname.includes('lovable.app') ||
            window.location.hostname.includes('vercel.app');
          setIframeAccess({ isAllowed: isDev, reason: isDev ? '' : 'Unable to verify authorization.' });
        } else {
          const domains = data?.domains || [];
          const access = await checkIframeAccessAsync(domains);
          setIframeAccess(access);
        }
      } catch (err) {
        console.error('Error checking access:', err);
        setIframeAccess({ isAllowed: false, reason: 'Unable to verify authorization.' });
      }
      setIsCheckingAccess(false);
    };

    checkAccess();
  }, []);

  // Fetch stream URL with Worldwide proxy
  const fetchStreamUrl = useCallback(async () => {
    if (!matchId) {
      setError("No match ID provided");
      setIsFetchingStream(false);
      setIsLoading(false);
      return;
    }

    setIsFetchingStream(true);
    
    try {
      // Fetch worldwide settings
      const [proxyResult, baseServerResult] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "worldwide_proxy_url").single(),
        supabase.from("app_settings").select("value").eq("key", "worldwide_base_server").single(),
      ]);

      const proxyUrl = proxyResult.data?.value || '';
      const baseServer = baseServerResult.data?.value === 'IN' ? 'IN' : 'BD';

      if (!proxyUrl) {
        setError("Worldwide proxy not configured");
        setIsFetchingStream(false);
        setIsLoading(false);
        return;
      }

      // Fetch matches
      const { data, error: fnError } = await supabase.functions.invoke('fetch-matches');
      
      if (fnError) {
        if (fnError.message?.includes('Unauthorized') || fnError.message?.includes('403')) {
          setAccessDenied('This stream is only available on authorized websites.');
          setIsFetchingStream(false);
          setIsLoading(false);
          return;
        }
        throw new Error(fnError.message);
      }
      
      if (data?.error === 'Unauthorized domain') {
        setAccessDenied('This stream is only available on authorized websites.');
        setIsFetchingStream(false);
        setIsLoading(false);
        return;
      }
      
      if (data?.success && data.matches) {
        const match = data.matches.find((m: any) => m.match_id?.toString() === matchId);
        
        if (match) {
          const inLink = match.adfree_url || match.dai_url;
          if (inLink) {
            // Get base URL based on configured server
            const baseUrl = baseServer === 'BD' 
              ? inLink.replace('in-mc-fdlive', 'bd-mc-fdlive')
              : inLink;
            
            // Apply proxy prefix (raw URL, no encoding - the proxy expects a plain URL)
            const worldwideUrl = proxyUrl + baseUrl;
            setStreamUrl(worldwideUrl);
            setIsFetchingStream(false);
            return;
          }
        }
        setError("Match not found or stream unavailable");
      } else {
        setError("Failed to fetch match data");
      }
    } catch (err: any) {
      console.error("Error fetching stream:", err);
      if (err?.status === 403 || err?.message?.includes('Unauthorized')) {
        setAccessDenied('This stream is only available on authorized websites.');
      } else {
        setError("Failed to load stream. Please try again.");
      }
    }
    
    setIsFetchingStream(false);
    setIsLoading(false);
  }, [matchId]);

  useEffect(() => {
    fetchStreamUrl();
  }, [fetchStreamUrl]);

  const stopAutoRetry = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  const startAutoRetry = useCallback(() => {
    stopAutoRetry();
    retryIntervalRef.current = setInterval(() => {
      setRetryCount(prev => prev + 1);
    }, AUTO_RETRY_INTERVAL);
  }, [stopAutoRetry]);

  const initPlayer = useCallback(async () => {
    if (!playerContainerRef.current || !streamUrl) {
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

    try {
      const Clappr = await import('@clappr/player');
      const HlsjsPlayback = await import('@clappr/hlsjs-playback');

      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }

      setIsPiPSupported('pictureInPictureEnabled' in document && (document as any).pictureInPictureEnabled);

      const player = new Clappr.default.Player({
        parent: playerContainerRef.current,
        source: streamUrl,
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
            setError('The match has not started yet or the stream is unavailable.');
            setIsLoading(false);
            startAutoRetry();
          },
          onPlay: () => {
            setIsLoading(false);
            setRetryCount(0);
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
        setError('The match has not started yet or the stream is unavailable.');
        setIsLoading(false);
        startAutoRetry();
      });

    } catch (err) {
      console.error('Failed to initialize player:', err);
      setError('Failed to load video player. Please try again.');
      setIsLoading(false);
      startAutoRetry();
    }
  }, [streamUrl, stopAutoRetry, startAutoRetry]);

  useEffect(() => {
    if (streamUrl && !isFetchingStream) {
      initPlayer();
    }
  }, [streamUrl, isFetchingStream, initPlayer]);

  useEffect(() => {
    if (retryCount > 0) {
      initPlayer();
    }
  }, [retryCount]);

  useEffect(() => {
    return () => {
      stopAutoRetry();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [stopAutoRetry]);

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

  const lockLandscape = async () => {
    try {
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (err) {
      // Orientation lock not supported
    }
  };

  const unlockOrientation = () => {
    try {
      if (screen.orientation && (screen.orientation as any).unlock) {
        (screen.orientation as any).unlock();
      }
    } catch (err) {
      // Orientation unlock not supported
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (isFullscreen) {
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
  }, []);

  // Checking access
  if (isCheckingAccess) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Access denied (iframe check failed)
  if (iframeAccess && !iframeAccess.isAllowed) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center p-6">
          <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">{iframeAccess.reason}</p>
        </div>
      </div>
    );
  }

  // Access denied (server-side auth failed)
  if (accessDenied) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center p-6">
          <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">{accessDenied}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-screen bg-black relative overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Player container */}
      <div ref={playerContainerRef} className="w-full h-full" />

      {/* Loading indicator */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white/80 text-sm">Loading Worldwide stream...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-center p-6 max-w-md">
            <p className="text-white/80 text-lg mb-4">{error}</p>
            <div className="flex items-center justify-center gap-2 text-primary text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Auto-retrying...</span>
            </div>
          </div>
        </div>
      )}

      {/* Control overlay */}
      {showControls && !error && !isLoading && (
        <div className={cn(
          "absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-30 transition-opacity duration-300"
        )}>
          {/* Left: Title */}
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-white text-sm font-medium">Worldwide</span>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* PiP button */}
            {isPiPSupported && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={togglePiP}
              >
                <PictureInPicture2 className={cn("w-4 h-4", isPiPActive && "text-primary")} />
              </Button>
            )}

            {/* Quality dropdown */}
            {qualities.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
                  <DropdownMenuItem
                    onClick={handleAutoQuality}
                    className={cn(
                      "text-white hover:bg-white/10 cursor-pointer",
                      currentQuality === -1 && "text-primary"
                    )}
                  >
                    Auto
                  </DropdownMenuItem>
                  {qualities.map((quality) => (
                    <DropdownMenuItem
                      key={quality.id}
                      onClick={() => handleQualityChange(quality.id)}
                      className={cn(
                        "text-white hover:bg-white/10 cursor-pointer",
                        currentQuality === quality.id && "text-primary"
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
      )}
    </div>
  );
};

export default WatchWorldwide;
