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

interface QualityLevel {
  id: number;
  label: string;
  height: number;
}

const AUTO_RETRY_INTERVAL = 10000;
const ALLOWED_DOMAINS = ['cricfoots.com', 'eplayhd.com', 'localhost', '127.0.0.1'];

// Check if current page is embedded in an allowed domain
const checkDomainAccess = (): { allowed: boolean; reason: string } => {
  try {
    // Check if we're in an iframe
    const isInIframe = window.self !== window.top;
    
    // Get current hostname
    const currentHost = window.location.hostname;
    
    // Allow localhost for development
    if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
      return { allowed: true, reason: 'Development mode' };
    }

    // If not in iframe, check if we're on allowed domain directly
    if (!isInIframe) {
      const isAllowedDirect = ALLOWED_DOMAINS.some(domain => 
        currentHost === domain || currentHost.endsWith('.' + domain)
      );
      if (isAllowedDirect) {
        return { allowed: true, reason: 'Direct access on allowed domain' };
      }
      return { allowed: false, reason: 'Direct access not allowed. Must be embedded on authorized websites.' };
    }

    // If in iframe, try to check parent origin
    try {
      const parentHost = window.parent.location.hostname;
      const isAllowedParent = ALLOWED_DOMAINS.some(domain => 
        parentHost === domain || parentHost.endsWith('.' + domain)
      );
      if (isAllowedParent) {
        return { allowed: true, reason: 'Embedded on allowed domain' };
      }
      return { allowed: false, reason: `Embedding not authorized from ${parentHost}` };
    } catch {
      // Cross-origin iframe - check referrer as fallback
      const referrer = document.referrer;
      if (referrer) {
        try {
          const referrerHost = new URL(referrer).hostname;
          const isAllowedReferrer = ALLOWED_DOMAINS.some(domain => 
            referrerHost === domain || referrerHost.endsWith('.' + domain)
          );
          if (isAllowedReferrer) {
            return { allowed: true, reason: 'Valid referrer from allowed domain' };
          }
          return { allowed: false, reason: `Referrer ${referrerHost} not authorized` };
        } catch {
          return { allowed: false, reason: 'Invalid referrer' };
        }
      }
      return { allowed: false, reason: 'No referrer - embedding not authorized' };
    }
  } catch {
    return { allowed: false, reason: 'Security check failed' };
  }
};

const Watch = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const region: 'BD' | 'IN' = location.pathname.includes('play-bd') ? 'BD' : 'IN';
  const streamUrl = searchParams.get('url') || '';
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);

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
    // Security check - verify domain access
    const accessCheck = checkDomainAccess();
    if (!accessCheck.allowed) {
      setAccessDenied(accessCheck.reason);
      setIsLoading(false);
      return;
    }

    if (!playerContainerRef.current || !streamUrl) {
      setError("No stream URL provided");
      setIsLoading(false);
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
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
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
            setError(`Stream unavailable. Geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}.`);
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
            
            // Extract quality levels from HLS playback
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
                    // Sort by height descending
                    qualityList.sort((a, b) => b.height - a.height);
                    setQualities(qualityList);
                  }
                }
              } catch (err) {
                console.log('Could not extract qualities:', err);
              }
            }, 1000);

            // Setup PiP listeners
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
        setError(`Stream unavailable. Geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}.`);
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

  useEffect(() => {
    if (retryCount > 0) {
      initPlayer();
    }
  }, [retryCount]);

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
    initPlayer();

    return () => {
      stopAutoRetry();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [initPlayer, stopAutoRetry]);

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
    initPlayer();
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return 'Auto';
    const quality = qualities.find(q => q.id === currentQuality);
    return quality?.label || 'Auto';
  };

  // Access denied screen
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
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/70 text-sm">Connecting to {region} stream...</p>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10 bg-black">
          <div className="bg-destructive/20 rounded-full p-4 mb-4">
            <Globe className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-white font-medium mb-2">Stream Unavailable</p>
          <p className="text-white/60 text-sm mb-4 max-w-md">
            This stream may be geo-restricted or currently offline.
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
      {!isLoading && !error && (
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
          (isLoading || error) && "invisible"
        )}
      />
    </div>
  );
};

export default Watch;