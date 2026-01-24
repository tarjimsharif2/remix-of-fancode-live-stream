import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UniversalPlayer } from "@/components/players/UniversalPlayer";
import { PlayerType } from "@/types/playerTypes";
import { StreamLink, extractStreamLinks } from "@/utils/streamExtractor";

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

  const [streamLinks, setStreamLinks] = useState<StreamLink[]>([]);
  const [matchTitle, setMatchTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeAccess, setIframeAccess] = useState<{ isAllowed: boolean; reason: string } | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [defaultPlayer, setDefaultPlayer] = useState<PlayerType>('clappr');
  const [iframeWrapperUrl, setIframeWrapperUrl] = useState<string>('');

  // Check iframe access and load settings
  useEffect(() => {
    const init = async () => {
      try {
        // Check auth
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIframeAccess({ isAllowed: true, reason: '' });
          setIsCheckingAccess(false);
        } else {
          // Check embed setting
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
          setDefaultPlayer(playerSetting.value as PlayerType);
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

  // Fetch stream URLs
  const fetchStream = useCallback(async () => {
    if (!matchId || !slug) {
      setError("No match ID or source provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
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
        const match = data.matches.find((m: any) => 
          m.match_id?.toString() === matchId || m.id?.toString() === matchId
        );
        
        if (match) {
          setMatchTitle(match.title || match.name || match.match_title || 'Live Match');
          
          // Extract all stream links
          const links = extractStreamLinks(match);
          
          if (links.length > 0) {
            setStreamLinks(links);
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
  }, [matchId, slug]);

  useEffect(() => {
    if (iframeAccess?.isAllowed) {
      fetchStream();
    }
  }, [fetchStream, iframeAccess]);

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

  // Loading
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error
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
    <div className="fixed inset-0 w-screen h-screen bg-black">
      <UniversalPlayer
        streamLinks={streamLinks}
        title={matchTitle}
        defaultPlayer={defaultPlayer}
        iframeWrapperUrl={iframeWrapperUrl}
      />
    </div>
  );
};

export default LiveSourceWatch;