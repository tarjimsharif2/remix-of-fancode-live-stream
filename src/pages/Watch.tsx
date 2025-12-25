import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
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
  // Check if we're in an iframe
  const isInIframe = window.self !== window.top;
  
  if (!isInIframe) {
    return { isAllowed: false, reason: 'This player can only be accessed via embed.' };
  }

  // Always allow dev/preview domains
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

    // Check if parent domain is allowed
    const isAllowedDomain = allowedDomains.some(domain => 
      parentHostname === domain || parentHostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return { isAllowed: false, reason: 'Embedding not authorized for this domain.' };
    }

    return { isAllowed: true, reason: '' };
  } catch {
    // Cross-origin error - check referrer as fallback
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

const Watch = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const region: 'BD' | 'IN' = location.pathname.includes('play-bd') ? 'BD' : 'IN';
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

  // Check iframe access on mount - fetch allowed domains from database
  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Fetch allowed domains from edge function
        const { data, error: fnError } = await supabase.functions.invoke('get-allowed-domains');
        
        if (fnError) {
          console.error('Failed to fetch allowed domains:', fnError);
          // Fallback: allow in dev mode, deny otherwise
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

  // Fetch stream URL from match data
  const fetchStreamUrl = useCallback(async () => {
    if (!matchId) {
      setError("No match ID provided");
      setIsFetchingStream(false);
      setIsLoading(false);
      return;
    }

    setIsFetchingStream(true);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-matches');
      
      // Handle unauthorized domain error from server
      if (fnError) {
        if (fnError.message?.includes('Unauthorized') || fnError.message?.includes('403')) {
          setAccessDenied('This stream is only available on authorized websites.');
          setIsFetchingStream(false);
          setIsLoading(false);
          return;
        }
        throw new Error(fnError.message);
      }
      
      // Check for server-side auth error
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
            const url = region === 'BD' 
              ? inLink.replace('in-mc-fdlive', 'bd-mc-fdlive')
              : inLink;
            setStreamUrl(url);
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
      // Check if it's a 403/auth error
      if (err?.status === 403 || err?.message?.includes('Unauthorized')) {
        setAccessDenied('This stream is only available on authorized websites.');
      } else {
        setError("Failed to load stream. Please try again.");
      }
    }
    
    setIsFetchingStream(false);
    setIsLoading(false);
  }, [matchId, region]);

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
            // Faster startup: reduce initial buffer requirements
            maxBufferLength: 10,
            maxMaxBufferLength: 30,
            maxBufferSize: 30 * 1000 * 1000,
            maxBufferHole: 0.5,
            // Fast start settings
            startLevel: -1, // Auto-select best starting quality
            abrEwmaDefaultEstimate: 5000000, // Assume 5Mbps initially
            abrBandWidthFactor: 0.95,
            abrBandWidthUpFactor: 0.7,
            // Reduce fragment loading time
            fragLoadingTimeOut: 8000,
            fragLoadingMaxRetry: 3,
            fragLoadingRetryDelay: 500,
            // Start playing earlier
            liveSyncDurationCount: 2,
            liveMaxLatencyDurationCount: 4,
          }
        },
        autoPlay: true,
        mute: false,
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
            
            setTimeout(() => {
              try {
                const playback = player.core?.getCurrentPlayback?.();
                if (playback && playback.hls) {
                  const hls = playback.hls;
                  const levels = hls.levels || [];
                  if (levels.length > 0) {
                    const qualityList: QualityLevel[] = levels.map((level: any, index: number) => ({
                      id: index,
                      height: level.height || 0,
                      label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
                    }));
                    qualityList.sort((a, b) => b.height - a.height);
                    setQualities(qualityList);
                  }
                }
              } catch (err) {
                console.log('Could not extract qualities:', err);
              }
            }, 1000);

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
  }, [streamUrl, region, stopAutoRetry, startAutoRetry]);

  // Initialize player when stream URL is available
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
      if (playback && playback.hls) {
        playback.hls.currentLevel = levelId;
        setCurrentQuality(levelId);
      }
    } catch (err) {
      console.error('Quality change error:', err);
    }
  };

  const handleAutoQuality = () => {
    try {
      const playback = playerRef.current?.core?.getCurrentPlayback?.();
      if (playback && playback.hls) {
        playback.hls.currentLevel = -1;
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

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);
    timeout = setTimeout(() => setShowControls(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const handleRetry = () => {
    setRetryCount(0);
    if (!streamUrl) {
      fetchStreamUrl();
    } else {
      initPlayer();
    }
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return 'Auto';
    const quality = qualities.find(q => q.id === currentQuality);
    return quality?.label || 'Auto';
  };

  // Show loading while checking access
  if (isCheckingAccess) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check iframe access first
  if (iframeAccess && !iframeAccess.isAllowed) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <div className="bg-destructive/20 rounded-full p-4 mb-4">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>
        <p className="text-white font-bold text-xl mb-2">Embed Only</p>
        <p className="text-white/60 text-sm max-w-md mb-4">
          {iframeAccess.reason}
        </p>
        <p className="text-white/40 text-xs">
          This player is only available when embedded on authorized websites.
        </p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-black flex flex-col items-center justify-center text-center p-6">
        <div className="bg-destructive/20 rounded-full p-4 mb-4">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>
        <p className="text-white font-bold text-xl mb-2">Access Denied</p>
        <p className="text-white/60 text-sm max-w-md mb-4">
          {accessDenied}
        </p>
        <p className="text-white/40 text-xs">
          This stream is only available on authorized websites.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
      {(isLoading || isFetchingStream) && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-white/80 text-sm font-medium">
            {isFetchingStream ? 'Loading...' : 'Connecting...'}
          </p>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10 bg-black">
          <div className="bg-amber-500/20 rounded-full p-4 mb-4">
            <Globe className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-white font-medium mb-2">The match has not started yet</p>
          <p className="text-white/60 text-sm mb-4 max-w-md">
            Please wait for the match to begin or check back later.
          </p>
          <div className="flex items-center gap-2 text-white/40 text-xs mb-6">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Auto-retrying... (Attempt {retryCount + 1})</span>
          </div>
          <Button onClick={handleRetry} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Now
          </Button>
        </div>
      ) : null}

      {/* Top Controls */}
      {!isLoading && !isFetchingStream && !error && (
        <div 
          className={cn(
            "absolute top-4 right-4 z-20 flex gap-2 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {isPiPSupported && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={togglePiP}
              className={cn(
                "bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-sm",
                isPiPActive && "bg-primary/30"
              )}
            >
              <PictureInPicture2 className="w-4 h-4" />
            </Button>
          )}

          {qualities.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-sm"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {getCurrentQualityLabel()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black border-white/20 z-50">
                <DropdownMenuItem 
                  onClick={handleAutoQuality}
                  className={cn(
                    "text-white hover:bg-white/10 cursor-pointer focus:bg-white/10 focus:text-white",
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
                      "text-white hover:bg-white/10 cursor-pointer focus:bg-white/10 focus:text-white",
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
      )}

      {/* Clappr Player Container */}
      <div 
        ref={playerContainerRef} 
        className={cn(
          "w-full h-full",
          (isLoading || isFetchingStream || error) && "invisible"
        )}
      />
    </div>
  );
};

export default Watch;