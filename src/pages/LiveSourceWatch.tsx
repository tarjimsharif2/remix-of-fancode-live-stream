import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClapprPlayer } from "@/components/players/ClapprPlayer";
import { HlsJsPlayer } from "@/components/players/HlsJsPlayer";
import { IframePlayer } from "@/components/players/IframePlayer";
import { PlayerType } from "@/types/playerTypes";
import { getLinkConfig, LinkConfig } from "@/types/jsonSource";
import { extractStreamLinks, StreamLink } from "@/utils/streamExtractor";

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

// Token refresh interval - 20 minutes (tokens typically expire in 30-60 mins)
const TOKEN_REFRESH_INTERVAL = 20 * 60 * 1000;

const LiveSourceWatch = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('id') || '';
  const linkNumber = parseInt(searchParams.get('link') || '1', 10); // 1-based link number

  // Refs for auto-refresh
  const tokenRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTokenRefreshRef = useRef<number>(0);
  const currentStreamDataRef = useRef<{ url: string; link: StreamLink | null }>({ url: '', link: null });
  const sourceUrlRef = useRef<string>('');
  const hlsPlayerRef = useRef<any>(null);

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
  const [playerKey, setPlayerKey] = useState(0);
  const [tokenStatus, setTokenStatus] = useState<'fresh' | 'refreshing' | 'stale'>('fresh');

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

  // Geo-restricted domains that should NEVER be proxied (must load directly in user's browser)
  const GEO_RESTRICTED_DOMAINS = ['aynascope.net', 'aynaott', 'toffeelive.com'];
  
  // Check if URL is from a geo-restricted domain
  const isGeoRestricted = useCallback((url: string): boolean => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return GEO_RESTRICTED_DOMAINS.some(domain => hostname.includes(domain));
    } catch {
      return false;
    }
  }, []);

  // Build stream URL from link data
  const buildStreamUrl = useCallback((selectedLink: StreamLink, linkConfigs: Record<string, unknown>, finalPlayerType: PlayerType): string => {
    let streamUrl = selectedLink.url;
    const linkConfig = getLinkConfig(linkConfigs, linkNumber);
    
    // NEVER proxy geo-restricted streams - they must load directly in user's browser
    if (isGeoRestricted(streamUrl)) {
      console.log('[GeoRestricted] Skipping proxy for:', streamUrl);
      return streamUrl; // Return raw URL for direct browser playback
    }
    
    // For iframe player, skip proxying - let the browser handle it directly
    if (finalPlayerType === 'iframe') {
      console.log('[Iframe Player] Skipping proxy, using direct URL');
      // Apply prefix if configured
      if (linkConfig.prefix) {
        return linkConfig.prefix + encodeURIComponent(selectedLink.url);
      }
      return streamUrl;
    }
    
    // Check if URL needs proxying (has headers or is m3u8)
    const needsProxy = selectedLink.referer || selectedLink.origin || 
      selectedLink.cookie || selectedLink.userAgent ||
      (streamUrl.includes('.m3u8') && !streamUrl.includes('youtube') && 
       !streamUrl.startsWith(import.meta.env.VITE_SUPABASE_URL));
    
    if (needsProxy) {
      // Route through stream-proxy for HLS streams
      const proxyBaseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy`;
      const proxyParams = new URLSearchParams();
      proxyParams.set('url', streamUrl);
      if (selectedLink.referer) proxyParams.set('referer', selectedLink.referer);
      if (selectedLink.origin) proxyParams.set('origin', selectedLink.origin);
      if (selectedLink.userAgent) proxyParams.set('userAgent', selectedLink.userAgent);
      if (selectedLink.cookie) proxyParams.set('cookie', selectedLink.cookie);
      streamUrl = `${proxyBaseUrl}?${proxyParams.toString()}`;
    } else if (linkConfig.prefix) {
      // Apply configured prefix if no auto-proxy needed
      streamUrl = linkConfig.prefix + encodeURIComponent(selectedLink.url);
    }
    
    return streamUrl;
  }, [linkNumber, isGeoRestricted]);

  // Fetch stream URL using link number
  const fetchStream = useCallback(async (silent: boolean = false) => {
    if (!matchId || !slug) {
      if (!silent) {
        setError("No match ID provided");
        setIsLoading(false);
      }
      return null;
    }

    if (!silent) {
      setIsLoading(true);
    }
    
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

      // Store source URL for refresh
      sourceUrlRef.current = sourceData.url;

      // Store link configs from source
      const linkConfigs = (sourceData.link_prefixes as Record<string, unknown>) || {};
      if (!silent) {
        setSourceLinkPrefixes(linkConfigs);
      }

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
        
        // If no match by ID, try index-based
        if (!match && !isNaN(parseInt(matchId, 10))) {
          const index = parseInt(matchId, 10);
          if (index >= 0 && index < data.matches.length) {
            match = data.matches[index];
          }
        }
        
        if (match) {
          if (!silent) {
            setMatchTitle(match.title || match.name || match.channel_name || 'Live Match');
          }
          const links = extractStreamLinks(match);
          
          // Use link number (1-based) to select the stream
          const linkIndex = Math.max(0, Math.min(linkNumber - 1, links.length - 1));
          
          if (links.length > 0 && links[linkIndex]) {
            const selectedLink = links[linkIndex];
            
            // Determine player type first (needed for buildStreamUrl)
            const linkConfig = getLinkConfig(linkConfigs, linkNumber);
            const finalPlayerType = linkConfig.player || defaultPlayerType;
            
            // Build URL with player type info (to decide on proxying)
            const streamUrl = buildStreamUrl(selectedLink, linkConfigs, finalPlayerType);
            
            // Store for comparison on refresh
            currentStreamDataRef.current = { url: selectedLink.url, link: selectedLink };
            
            if (!silent) {
              setPlayerType(finalPlayerType);
              
              console.log('Final stream URL:', streamUrl);
              setCurrentStreamUrl(streamUrl);
              setIsLoading(false);
              lastTokenRefreshRef.current = Date.now();
            }
            
            return { streamUrl, selectedLink, linkConfigs };
          }
        }
        
        if (!silent) {
          setError("Stream unavailable");
        }
      } else {
        if (!silent) {
          setError("Failed to load");
        }
      }
    } catch (err: any) {
      console.error("Error:", err);
      if (!silent) {
        setError("Failed to load stream");
      }
    }
    
    if (!silent) {
      setIsLoading(false);
    }
    return null;
  }, [matchId, slug, linkNumber, defaultPlayerType, buildStreamUrl]);

  // Silent token refresh - updates stream without interrupting playback
  const silentTokenRefresh = useCallback(async () => {
    const now = Date.now();
    // Prevent rapid refreshes (minimum 5 min between refreshes)
    if (now - lastTokenRefreshRef.current < 5 * 60 * 1000) {
      console.log('[Token Refresh] Skipped - too recent');
      return;
    }

    console.log(`[Token Refresh] Fetching fresh data at ${new Date().toLocaleTimeString()}`);
    setTokenStatus('refreshing');
    
    try {
      const result = await fetchStream(true);
      
      if (result) {
        const { streamUrl, selectedLink } = result;
        const oldUrl = currentStreamDataRef.current.url;
        
        // Check if URL actually changed (new token)
        if (selectedLink.url !== oldUrl) {
          console.log('[Token Refresh] New token received, updating stream seamlessly...');
          
          // Update refs
          currentStreamDataRef.current = { url: selectedLink.url, link: selectedLink };
          lastTokenRefreshRef.current = now;
          
          // For HLS.js player, try to update source without full reload
          if (playerType === 'hlsjs' && hlsPlayerRef.current) {
            // HlsJsPlayer will handle the source change via prop update
            setCurrentStreamUrl(streamUrl);
          } else {
            // For other players, update URL and trigger re-render with new key
            setCurrentStreamUrl(streamUrl);
            setPlayerKey(prev => prev + 1);
          }
          
          setTokenStatus('fresh');
          console.log('[Token Refresh] Stream updated successfully');
        } else {
          console.log('[Token Refresh] Token unchanged');
          setTokenStatus('fresh');
        }
      }
    } catch (err) {
      console.error('[Token Refresh] Failed:', err);
      setTokenStatus('stale');
    }
  }, [fetchStream, playerType]);

  // Initial fetch
  useEffect(() => {
    if (iframeAccess?.isAllowed) {
      fetchStream();
    }
  }, [fetchStream, iframeAccess]);

  // Auto token refresh interval
  useEffect(() => {
    if (!currentStreamUrl || isLoading || error) {
      return;
    }

    console.log(`[Auto Refresh] Starting token refresh interval (every ${TOKEN_REFRESH_INTERVAL / 60000} minutes)`);
    
    tokenRefreshIntervalRef.current = setInterval(() => {
      silentTokenRefresh();
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
        tokenRefreshIntervalRef.current = null;
      }
    };
  }, [currentStreamUrl, isLoading, error, silentTokenRefresh]);

  // Render player based on type
  const renderPlayer = () => {
    if (!currentStreamUrl) return null;

    const key = `player-${playerKey}`;
    
    switch (playerType) {
      case 'clappr':
        return <ClapprPlayer key={key} streamUrl={currentStreamUrl} />;
      case 'hlsjs':
        return <HlsJsPlayer key={key} streamUrl={currentStreamUrl} title={matchTitle} />;
      case 'iframe':
        return <IframePlayer key={key} streamUrl={currentStreamUrl} wrapperUrl={iframeWrapperUrl} title={matchTitle} />;
      case 'native':
        return <video key={key} src={currentStreamUrl} className="w-full h-full" controls autoPlay playsInline />;
      default:
        return <ClapprPlayer key={key} streamUrl={currentStreamUrl} />;
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