import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClapprPlayer } from "@/components/players/ClapprPlayer";
import { HlsJsPlayer } from "@/components/players/HlsJsPlayer";
import { IframePlayer } from "@/components/players/IframePlayer";
import { PlayerType } from "@/types/playerTypes";
import { getLinkConfig, LinkConfig } from "@/types/jsonSource";
import { extractStreamLinks } from "@/utils/streamExtractor";

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
  const linkNumber = parseInt(searchParams.get('link') || '1', 10); // 1-based link number

  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>('');
  const [matchTitle, setMatchTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeAccess, setIframeAccess] = useState<{ isAllowed: boolean; reason: string } | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [playerType, setPlayerType] = useState<PlayerType>('clappr');
  const [defaultPlayerType, setDefaultPlayerType] = useState<PlayerType>('clappr');
  const [iframeWrapperUrl, setIframeWrapperUrl] = useState<string>('');
  const [sourceLinkPrefixes, setSourceLinkPrefixes] = useState<Record<string, unknown>>({});

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

        // Load source-specific default player first, then fall back to global
        if (slug) {
          const { data: sourceData } = await supabase
            .from("json_sources")
            .select("default_player")
            .eq("slug", slug)
            .maybeSingle();

          if (sourceData?.default_player) {
            setDefaultPlayerType(sourceData.default_player as PlayerType);
            setPlayerType(sourceData.default_player as PlayerType);
          } else {
            // Fallback to global setting
            const { data: playerSetting } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "default_player")
              .maybeSingle();

            if (playerSetting?.value) {
              setDefaultPlayerType(playerSetting.value as PlayerType);
              setPlayerType(playerSetting.value as PlayerType);
            }
          }
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
  }, [slug]);

  // Fetch stream URL using link number
  const fetchStream = useCallback(async () => {
    if (!matchId || !slug) {
      setError("No match ID provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Fetch source with link_prefixes
      const { data: sourceData, error: sourceError } = await supabase
        .from("json_sources")
        .select("url, link_prefixes")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (sourceError || !sourceData) {
        throw new Error("Source not found");
      }

      // Store link configs from source (handles both legacy string and new LinkConfig format)
      const linkConfigs = (sourceData.link_prefixes as Record<string, unknown>) || {};
      setSourceLinkPrefixes(linkConfigs);

      const { data, error: fnError } = await supabase.functions.invoke('fetch-json-source', {
        body: { url: sourceData.url },
      });
      
      if (fnError) throw fnError;
      
      if (data?.success && data.matches) {
        // Flexible matching: check various ID fields and index-based matching
        let match = data.matches.find((m: any) => 
          m.match_id?.toString() === matchId || 
          m.id?.toString() === matchId ||
          m.channel_id?.toString() === matchId ||
          m.stream_id?.toString() === matchId
        );
        
        // If no match by ID, try index-based (matchId could be array index)
        if (!match && !isNaN(parseInt(matchId, 10))) {
          const index = parseInt(matchId, 10);
          if (index >= 0 && index < data.matches.length) {
            match = data.matches[index];
          }
        }
        
        if (match) {
          setMatchTitle(match.title || match.name || match.channel_name || 'Live Match');
          const links = extractStreamLinks(match);
          
          console.log('Match found:', match);
          console.log('Extracted links:', links);
          
          // Use link number (1-based) to select the stream
          const linkIndex = Math.max(0, Math.min(linkNumber - 1, links.length - 1));
          
          if (links.length > 0 && links[linkIndex]) {
            const selectedLink = links[linkIndex];
            let streamUrl = selectedLink.url;
            
            // Get link-specific config (prefix + player)
            const linkConfig = getLinkConfig(linkConfigs, linkNumber);
            
            // If link has referer/origin, use stream-proxy automatically
            if (selectedLink.referer || selectedLink.origin) {
              const proxyBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy`;
              const proxyParams = new URLSearchParams();
              proxyParams.set('url', streamUrl);
              if (selectedLink.referer) proxyParams.set('referer', selectedLink.referer);
              if (selectedLink.origin) proxyParams.set('origin', selectedLink.origin);
              if (selectedLink.userAgent) proxyParams.set('userAgent', selectedLink.userAgent);
              streamUrl = `${proxyBaseUrl}?${proxyParams.toString()}`;
            } else if (linkConfig.prefix) {
              // Apply configured prefix if no auto-proxy needed
              streamUrl = linkConfig.prefix + encodeURIComponent(selectedLink.url);
            }
            
            // Apply link-specific player if configured, otherwise use source default
            if (linkConfig.player) {
              setPlayerType(linkConfig.player);
            } else {
              setPlayerType(defaultPlayerType);
            }
            
            console.log('Final stream URL:', streamUrl);
            setCurrentStreamUrl(streamUrl);
            setIsLoading(false);
            return;
          }
        }
        setError("Stream unavailable");
      } else {
        setError("Failed to load");
      }
    } catch (err: any) {
      console.error("Error:", err);
      setError("Failed to load stream");
    }
    
    setIsLoading(false);
  }, [matchId, slug, linkNumber, defaultPlayerType]);

  useEffect(() => {
    if (iframeAccess?.isAllowed) {
      fetchStream();
    }
  }, [fetchStream, iframeAccess]);

  // Render player based on type
  const renderPlayer = () => {
    if (!currentStreamUrl) return null;

    switch (playerType) {
      case 'clappr':
        return <ClapprPlayer streamUrl={currentStreamUrl} />;
      case 'hlsjs':
        return <HlsJsPlayer streamUrl={currentStreamUrl} title={matchTitle} />;
      case 'iframe':
        return <IframePlayer streamUrl={currentStreamUrl} wrapperUrl={iframeWrapperUrl} title={matchTitle} />;
      case 'native':
        return <video src={currentStreamUrl} className="w-full h-full" controls autoPlay playsInline />;
      default:
        return <ClapprPlayer streamUrl={currentStreamUrl} />;
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

  // Clean player - no overlays, no controls
  return (
    <div className="fixed inset-0 w-screen h-screen bg-black">
      {renderPlayer()}
    </div>
  );
};

export default LiveSourceWatch;