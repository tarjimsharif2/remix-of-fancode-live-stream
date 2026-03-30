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
// Fallback if app_settings row is missing
const DEFAULT_WORLDWIDE_WRAPPER_URL = "https://tv.eplayhd.fun/play.php?c=";

const IFRAME_LOAD_TIMEOUT_MS = 9000;
const LOADING_OVERLAY_GRACE_MS = 350;

// Check if running inside an iframe from allowed domain (async version that fetches from DB)
const checkIframeAccessAsync = async (allowedDomains: string[]): Promise<{ isAllowed: boolean; reason: string }> => {
  // Always allow dev/preview domains FIRST - before iframe check
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || 
    hostname === '127.0.0.1' ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('vercel.app');

  if (isDev) {
    return { isAllowed: true, reason: '' };
  }

  // Allow direct access from self-origin (if current hostname is in allowed domains)
  const isSelfAllowed = allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );
  if (isSelfAllowed) {
    return { isAllowed: true, reason: '' };
  }

  const isInIframe = window.self !== window.top;
  
  if (!isInIframe) {
    return { isAllowed: false, reason: 'This player can only be accessed via embed.' };
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
  const retryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
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
  const [isAdminSession, setIsAdminSession] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [wrapperUrl, setWrapperUrl] = useState<string>(DEFAULT_WORLDWIDE_WRAPPER_URL);

  const iframeLoadTimeoutRef = useRef<number | null>(null);
  const loadingOverlayTimerRef = useRef<number | null>(null);

  // Check iframe access on mount
  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Admin logged-in users should never get the upstream "Embed Only" block.
        // For them we bypass the embed wrapper and use an in-app player.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsAdminSession(true);
          setIframeAccess({ isAllowed: true, reason: '' });
          setIsCheckingAccess(false);
          return;
        }

        // If global embed access is OFF, allow direct access
        const { data: embedSetting, error: embedSettingError } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "embed_access_enabled")
          .maybeSingle();

        const embedAccessEnabled = !embedSettingError && embedSetting?.value === 'true';

        if (!embedAccessEnabled) {
          setIframeAccess({ isAllowed: true, reason: '' });
          setIsCheckingAccess(false);
          return;
        }

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

  // Loading overlay grace (avoid flicker)
  useEffect(() => {
    if (loadingOverlayTimerRef.current) {
      window.clearTimeout(loadingOverlayTimerRef.current);
      loadingOverlayTimerRef.current = null;
    }

    if (isLoading && !error) {
      loadingOverlayTimerRef.current = window.setTimeout(() => {
        setShowLoadingOverlay(true);
      }, LOADING_OVERLAY_GRACE_MS);
    } else {
      setShowLoadingOverlay(false);
    }

    return () => {
      if (loadingOverlayTimerRef.current) {
        window.clearTimeout(loadingOverlayTimerRef.current);
        loadingOverlayTimerRef.current = null;
      }
    };
  }, [isLoading, error]);

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
      // Fetch worldwide settings (proxy, base server, wrapper)
      const [proxyResult, baseServerResult, wrapperResult] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "worldwide_proxy_url").single(),
        supabase.from("app_settings").select("value").eq("key", "worldwide_base_server").single(),
        supabase.from("app_settings").select("value").eq("key", "worldwide_wrapper_url").single(),
      ]);

      const proxyUrl = proxyResult.data?.value || '';
      const baseServer = baseServerResult.data?.value === 'IN' ? 'IN' : 'BD';
      const fetchedWrapper = wrapperResult.data?.value || DEFAULT_WORLDWIDE_WRAPPER_URL;
      setWrapperUrl(fetchedWrapper);

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

  // Iframe load watchdog (non-admin only)
  useEffect(() => {
    if (!streamUrl || isAdminSession) return;

    if (isLoading && !error) {
      if (iframeLoadTimeoutRef.current) {
        window.clearTimeout(iframeLoadTimeoutRef.current);
        iframeLoadTimeoutRef.current = null;
      }

      iframeLoadTimeoutRef.current = window.setTimeout(() => {
        setError('Player is taking too long to load. Retrying...');
        setIsLoading(false);
        startAutoRetry();
        iframeLoadTimeoutRef.current = null;
      }, IFRAME_LOAD_TIMEOUT_MS);
    }

    return () => {
      if (iframeLoadTimeoutRef.current) {
        window.clearTimeout(iframeLoadTimeoutRef.current);
        iframeLoadTimeoutRef.current = null;
      }
    };
  }, [streamUrl, isAdminSession, isLoading, error, startAutoRetry]);

  const buildEmbedUrl = useCallback(
    (rawProxyUrl: string) => {
      // Important: the wrapper page is same-origin with the proxy, so it avoids CORS.
      // rawProxyUrl example: https://tv.eplayhd.fun/proxy.php?link=https://.../index.m3u8
      // NOTE: The upstream play.php expects the URL in the same unencoded format used on tv.eplayhd.fun.
      // Example:
      //   https://tv.eplayhd.fun/play.php?c=https://tv.eplayhd.fun/proxy.php?link=https://.../index.m3u8
      return `${wrapperUrl}${rawProxyUrl}`;
    },
    [wrapperUrl]
  );

  useEffect(() => {
    if (streamUrl && !isFetchingStream) {
      // Using iframe wrapper for non-admin; for admin we'll initialize in-app player.
      setIsLoading(true);
      setError(null);
      stopAutoRetry();
    }
  }, [streamUrl, isFetchingStream, stopAutoRetry]);

  useEffect(() => {
    if (retryCount > 0) {
      // Force iframe reload via changing query.
      setIsLoading(true);
      setError(null);
    }
  }, [retryCount]);

  useEffect(() => {
    return () => {
      stopAutoRetry();

      if (iframeLoadTimeoutRef.current) {
        window.clearTimeout(iframeLoadTimeoutRef.current);
        iframeLoadTimeoutRef.current = null;
      }
    };
  }, [stopAutoRetry]);

  // Admin-only in-app player (avoids upstream embed restrictions)
  const initAdminPlayer = useCallback(async () => {
    if (!isAdminSession || !playerContainerRef.current || !streamUrl) return;

    try {
      // Cleanup
      if (playerRef.current) {
        playerRef.current.destroy?.();
        playerRef.current = null;
      }
      playerContainerRef.current.innerHTML = '';

      setIsLoading(true);
      setError(null);
      setQualities([]);
      setCurrentQuality(-1);
      stopAutoRetry();

      const Clappr = await import('@clappr/player');
      const HlsjsPlayback = await import('@clappr/hlsjs-playback');

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
            maxBufferHole: 0.5,
            startLevel: -1,
            fragLoadingTimeOut: 8000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 400,
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
          },
        },
        autoPlay: true,
        mute: false,
        height: '100%',
        width: '100%',
      });

      playerRef.current = player;

      const extractQualities = () => {
        try {
          const playback = player.core?.getCurrentPlayback?.();
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
        } catch {
          // ignore
        }
        return false;
      };

      // Give the manifest a moment to load
      window.setTimeout(() => {
        extractQualities();
        setIsLoading(false);
      }, 700);

      player.on(Clappr.default.Events.PLAYER_ERROR, () => {
        setError('The match has not started yet or the stream is unavailable.');
        setIsLoading(false);
        startAutoRetry();
      });
    } catch (err) {
      console.error('Failed to initialize admin player:', err);
      setError('Failed to load video player. Please try again.');
      setIsLoading(false);
      startAutoRetry();
    }
  }, [isAdminSession, streamUrl, stopAutoRetry, startAutoRetry]);

  useEffect(() => {
    if (streamUrl && !isFetchingStream && isAdminSession) {
      initAdminPlayer();
    }
  }, [streamUrl, isFetchingStream, isAdminSession, initAdminPlayer]);

  const handleQualityChange = (levelId: number) => {
    try {
      if (!isAdminSession) {
        // Quality switching is handled inside the embedded player page.
        setCurrentQuality(levelId);
        return;
      }

      const playback = playerRef.current?.core?.getCurrentPlayback?.();
      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = levelId;
        if (typeof hls.nextLevel === 'number') hls.nextLevel = levelId;
        if (typeof hls.loadLevel === 'number') hls.loadLevel = levelId;
      }
      setCurrentQuality(levelId);
    } catch (err) {
      console.error('Quality change error:', err);
    }
  };

  const handleAutoQuality = () => {
    try {
      if (!isAdminSession) {
        setCurrentQuality(-1);
        return;
      }
      const playback = playerRef.current?.core?.getCurrentPlayback?.();
      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = -1;
        if (typeof hls.nextLevel === 'number') hls.nextLevel = -1;
        if (typeof hls.loadLevel === 'number') hls.loadLevel = -1;
      }
      setCurrentQuality(-1);
    } catch (err) {
      console.error('Auto quality error:', err);
    }
  };

  const togglePiP = async () => {
    try {
      // PiP control isn't reliable via cross-origin iframe; keep disabled.
      return;
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
      {/* Player */}
      <div ref={playerContainerRef} className="w-full h-full">
        {streamUrl && !isAdminSession ? (
          <iframe
            title="Worldwide Player"
            className="w-full h-full border-0"
            key={`${streamUrl}::${retryCount}`}
            src={`${buildEmbedUrl(streamUrl)}&t=${retryCount}`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => {
              setIsLoading(false);
              setError(null);
              stopAutoRetry();

              if (iframeLoadTimeoutRef.current) {
                window.clearTimeout(iframeLoadTimeoutRef.current);
                iframeLoadTimeoutRef.current = null;
              }
            }}
            onError={() => {
              setError('The match has not started yet or the stream is unavailable.');
              setIsLoading(false);
              startAutoRetry();

              if (iframeLoadTimeoutRef.current) {
                window.clearTimeout(iframeLoadTimeoutRef.current);
                iframeLoadTimeoutRef.current = null;
              }
            }}
          />
        ) : null}
      </div>

      {/* Loading indicator */}
      {showLoadingOverlay && !error && (
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
