import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ShieldX, RefreshCw, Settings2, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClapprPlayer } from "@/components/players/ClapprPlayer";
import { HlsJsPlayer } from "@/components/players/HlsJsPlayer";
import { IframePlayer } from "@/components/players/IframePlayer";
import { PlayerType, PLAYER_CONFIGS, getPlayerConfig } from "@/types/playerTypes";
import { extractStreamLinks } from "@/utils/streamExtractor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Check if running inside an iframe from allowed domain
const checkIframeAccessAsync = async (allowedDomains: string[]): Promise<{ isAllowed: boolean; reason: string }> => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || 
    hostname === '127.0.0.1' ||
    hostname.includes('lovableproject.com') ||
    hostname.includes('lovable.app') ||
    hostname.includes('vercel.app');

  if (isDev) return { isAllowed: true, reason: '' };

  const isSelfAllowed = allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );
  if (isSelfAllowed) return { isAllowed: true, reason: '' };

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
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('id') || '';
  const streamUrl = searchParams.get('stream') || '';

  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>('');
  const [matchTitle, setMatchTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeAccess, setIframeAccess] = useState<{ isAllowed: boolean; reason: string } | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [playerType, setPlayerType] = useState<PlayerType>('clappr');
  const [iframeWrapperUrl, setIframeWrapperUrl] = useState<string>('');
  const [showControls, setShowControls] = useState(true);
  const [playerKey, setPlayerKey] = useState(0);

  // Check iframe access and load settings
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIframeAccess({ isAllowed: true, reason: '' });
          setIsCheckingAccess(false);
        } else {
          const { data: embedSetting } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "embed_access_enabled")
            .maybeSingle();

          if (!embedSetting || embedSetting.value !== 'true') {
            setIframeAccess({ isAllowed: true, reason: '' });
          } else {
            const { data } = await supabase.functions.invoke('get-allowed-domains');
            const domains = data?.domains || [];
            const access = await checkIframeAccessAsync(domains);
            setIframeAccess(access);
          }
          setIsCheckingAccess(false);
        }

        // Load player settings
        const { data: playerSetting } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "default_player")
          .maybeSingle();

        if (playerSetting?.value) {
          setPlayerType(playerSetting.value as PlayerType);
        }

        const { data: wrapperSetting } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "iframe_wrapper_url")
          .maybeSingle();

        if (wrapperSetting?.value) {
          setIframeWrapperUrl(wrapperSetting.value);
        }
      } catch (err) {
        console.error('Error during init:', err);
        setIframeAccess({ isAllowed: false, reason: 'Unable to verify authorization.' });
        setIsCheckingAccess(false);
      }
    };

    init();
  }, []);

  // Fetch stream URL - either from query param or from source
  const fetchStream = useCallback(async () => {
    // If stream URL is provided directly in query params, use it
    if (streamUrl) {
      setCurrentStreamUrl(decodeURIComponent(streamUrl));
      setMatchTitle('Live Stream');
      setIsLoading(false);
      return;
    }

    // Otherwise fetch from source (fallback/legacy behavior)
    if (!matchId || !slug) {
      setError("No stream URL or match ID provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
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
        const match = data.matches.find((m: any) => 
          m.match_id?.toString() === matchId || m.id?.toString() === matchId
        );
        
        if (match) {
          setMatchTitle(match.title || match.name || match.match_title || 'Live Match');
          
          const links = extractStreamLinks(match);
          
          if (links.length > 0) {
            setCurrentStreamUrl(links[0].url);
            setIsLoading(false);
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
    
    setIsLoading(false);
  }, [matchId, slug, streamUrl]);

  useEffect(() => {
    if (iframeAccess?.isAllowed) {
      fetchStream();
    }
  }, [fetchStream, iframeAccess]);

  // Auto-hide controls
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls]);

  const handleRetry = () => {
    setPlayerKey(prev => prev + 1);
  };

  const renderPlayer = () => {
    if (!currentStreamUrl) return null;

    switch (playerType) {
      case 'clappr':
        return <ClapprPlayer key={playerKey} streamUrl={currentStreamUrl} />;
      case 'hlsjs':
        return <HlsJsPlayer key={playerKey} streamUrl={currentStreamUrl} title={matchTitle} />;
      case 'iframe':
        return <IframePlayer key={playerKey} streamUrl={currentStreamUrl} wrapperUrl={iframeWrapperUrl} title={matchTitle} />;
      case 'native':
        return <video key={playerKey} src={currentStreamUrl} className="w-full h-full" controls autoPlay playsInline />;
      default:
        return <ClapprPlayer key={playerKey} streamUrl={currentStreamUrl} />;
    }
  };

  // Loading states
  if (isCheckingAccess) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-center p-6">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Error</h2>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 w-screen h-screen bg-black"
      onMouseMove={() => setShowControls(true)}
      onTouchStart={() => setShowControls(true)}
    >
      {/* Player */}
      {renderPlayer()}

      {/* Minimal Control Bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-50 p-2 sm:p-3",
          "bg-gradient-to-b from-black/70 to-transparent",
          "transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Retry Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="bg-white/10 hover:bg-white/20 text-white border-0 h-9 w-9 p-0 rounded-lg backdrop-blur-sm"
            title="Retry stream"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Player Type Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-0 h-9 px-3 rounded-lg backdrop-blur-sm gap-2"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">{getPlayerConfig(playerType).label}</span>
                <ChevronDown className="w-4 h-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-56 bg-zinc-900/95 backdrop-blur-lg border-white/10 shadow-2xl"
              sideOffset={8}
            >
              <DropdownMenuLabel className="text-white/60 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Player Engine
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              {PLAYER_CONFIGS.map((config) => (
                <DropdownMenuItem
                  key={config.type}
                  onClick={() => setPlayerType(config.type)}
                  className={cn(
                    "text-white cursor-pointer rounded-md mx-1 my-0.5",
                    "focus:bg-white/10 hover:bg-white/10",
                    playerType === config.type && "bg-primary/20"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                      <span>{config.icon}</span>
                      {config.label}
                    </span>
                    <span className="text-xs text-white/50">{config.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default LiveSourceWatch;