import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { RefreshCw, Settings, PictureInPicture2, ShieldX } from "lucide-react";
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

// Check if running inside an iframe from allowed domain
const checkIframeAccessAsync = async (allowedDomains: string[]): Promise<{ isAllowed: boolean; reason: string }> => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || 
    hostname === '127.0.0.1' ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('vercel.app');

  if (isDev) {
    return { isAllowed: true, reason: '' };
  }

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
    const isAllowedDomain = allowedDomains.some(domain => 
      parentUrl.hostname === domain || parentUrl.hostname.endsWith('.' + domain)
    );
    if (!isAllowedDomain) {
      return { isAllowed: false, reason: 'Embedding not authorized for this domain.' };
    }
    return { isAllowed: true, reason: '' };
  } catch {
    return { isAllowed: false, reason: 'Unable to verify embed origin.' };
  }
};

const LiveSourceWatch = () => {
  const { slug } = useParams<{ slug: string }>();
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

  // Check iframe access
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIframeAccess({ isAllowed: true, reason: '' });
          setIsCheckingAccess(false);
          return;
        }

        const { data: embedSetting } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "embed_access_enabled")
          .maybeSingle();

        if (!embedSetting || embedSetting.value !== 'true') {
          setIframeAccess({ isAllowed: true, reason: '' });
          setIsCheckingAccess(false);
          return;
        }

        const { data } = await supabase.functions.invoke('get-allowed-domains');
        const domains = data?.domains || [];
        const access = await checkIframeAccessAsync(domains);
        setIframeAccess(access);
      } catch (err) {
        console.error('Error checking access:', err);
        setIframeAccess({ isAllowed: false, reason: 'Unable to verify authorization.' });
      }
      setIsCheckingAccess(false);
    };

    checkAccess();
  }, []);

  // Fetch stream URL
  const fetchStreamUrl = useCallback(async () => {
    if (!matchId || !slug) {
      setError("No match ID or source provided");
      setIsFetchingStream(false);
      setIsLoading(false);
      return;
    }

    setIsFetchingStream(true);
    
    try {
      // Get source URL
      const { data: sourceData, error: sourceError } = await supabase
        .from("json_sources")
        .select("url")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (sourceError || !sourceData) {
        throw new Error("Source not found");
      }

      const { data, error: fnError } = await supabase.functions.invoke('fetch-json-source', {
        body: { url: sourceData.url },
      });
      
      if (fnError) throw fnError;
      
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
      setError("Failed to load stream. Please try again.");
    }
    
    setIsFetchingStream(false);
    setIsLoading(false);
  }, [matchId, slug, region]);

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
    if (!playerContainerRef.current || !streamUrl) return;

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
            startLevel: -1,
            fragLoadingTimeOut: 7000,
            fragLoadingMaxRetry: 3,
          }
        },
        autoPlay: true,
        mute: false,
        height: '100%',
        width: '100%',
        events: {
          onError: () => {
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
            // Extract qualities
            try {
              const playback = player.core?.getCurrentPlayback?.();
              const hls = (playback as any)?._hls || (playback as any)?.hls;
              if (hls && Array.isArray(hls.levels)) {
                const qualityList: QualityLevel[] = hls.levels
                  .map((lvl: any, index: number) => ({
                    id: index,
                    height: lvl.height || 0,
                    label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
                  }))
                  .filter((q: QualityLevel) => q.height > 0)
                  .sort((a: QualityLevel, b: QualityLevel) => b.height - a.height);
                setQualities(qualityList);
              }
            } catch {}
          }
        }
      });

      playerRef.current = player;

      player.on(Clappr.default.Events.PLAYER_ERROR, () => {
        setError('Stream unavailable.');
        setIsLoading(false);
        startAutoRetry();
      });

    } catch (err) {
      console.error('Failed to initialize player:', err);
      setError('Failed to load video player.');
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
      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = levelId;
        setCurrentQuality(levelId);
      }
    } catch {}
  };

  const handleAutoQuality = () => {
    try {
      const playback = playerRef.current?.core?.getCurrentPlayback?.();
      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = -1;
        setCurrentQuality(-1);
      }
    } catch {}
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
    } catch {}
  };

  // Checking access
  if (isCheckingAccess) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Access denied
  if (iframeAccess && !iframeAccess.isAllowed) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Embed Only</h2>
        <p className="text-gray-400">{iframeAccess.reason}</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-6">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-400">{accessDenied}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black">
      {/* Controls */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-50 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-2">
          {isPiPSupported && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white"
              onClick={togglePiP}
            >
              <PictureInPicture2 className={cn("w-5 h-5", isPiPActive && "text-green-400")} />
            </Button>
          )}
        </div>

        {qualities.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white">
                <Settings className="w-5 h-5 mr-1" />
                {currentQuality === -1 ? 'Auto' : qualities.find(q => q.id === currentQuality)?.label || 'Quality'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
              <DropdownMenuItem
                onClick={handleAutoQuality}
                className={cn("text-white", currentQuality === -1 && "bg-white/20")}
              >
                Auto
              </DropdownMenuItem>
              {qualities.map((quality) => (
                <DropdownMenuItem
                  key={quality.id}
                  onClick={() => handleQualityChange(quality.id)}
                  className={cn("text-white", currentQuality === quality.id && "bg-white/20")}
                >
                  {quality.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/70 text-sm">Loading stream...</p>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
          <p className="text-white/70 text-center mb-4">{error}</p>
          <Button
            onClick={() => {
              setRetryCount(prev => prev + 1);
              setError(null);
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
          <p className="text-white/40 text-xs mt-4">
            Auto-retry in {AUTO_RETRY_INTERVAL / 1000}s...
          </p>
        </div>
      )}

      {/* Player */}
      <div
        ref={playerContainerRef}
        className="w-full h-full"
        onClick={() => setShowControls(!showControls)}
      />
    </div>
  );
};

export default LiveSourceWatch;
