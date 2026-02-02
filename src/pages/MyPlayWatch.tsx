import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CustomChannel } from "@/types/customChannel";
import { ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClapprPlayer } from "@/components/players/ClapprPlayer";
import { HlsJsPlayer } from "@/components/players/HlsJsPlayer";
import { IframePlayer } from "@/components/players/IframePlayer";
import { PlayerType } from "@/types/playerTypes";
import { cn } from "@/lib/utils";

const MyPlayWatch = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const channelId = searchParams.get("id");

  const [channel, setChannel] = useState<CustomChannel | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<PlayerType>('clappr');
  const [playerKey, setPlayerKey] = useState(0);
  const [iframeWrapperUrl, setIframeWrapperUrl] = useState<string>('');
  const [showControls, setShowControls] = useState(true);

  // Fetch channel data and settings
  const fetchData = useCallback(async () => {
    if (!channelId) {
      setError("No channel ID provided");
      setChannelLoading(false);
      return;
    }

    try {
      const [channelRes, wrapperRes] = await Promise.all([
        supabase
          .from('custom_channels')
          .select('*')
          .eq('id', channelId)
          .eq('is_active', true)
          .single(),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'myplay_wrapper_url')
          .maybeSingle()
      ]);

      if (channelRes.error) {
        if (channelRes.error.code === 'PGRST116') {
          setError("Channel not found");
        } else {
          throw new Error(channelRes.error.message);
        }
        return;
      }

      const channelData = channelRes.data as CustomChannel;
      setChannel(channelData);
      setPlayerType(channelData.player_type || 'clappr');
      
      if (wrapperRes.data?.value) {
        setIframeWrapperUrl(wrapperRes.data.value);
      }
    } catch (err) {
      console.error("Error fetching channel:", err);
      setError(err instanceof Error ? err.message : "Failed to load channel");
    } finally {
      setChannelLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls]);

  const handleShowControls = useCallback(() => {
    setShowControls(true);
  }, []);

  const handleRetry = () => {
    setPlayerKey(prev => prev + 1);
  };

  const getProxyUrl = useCallback((url: string) => {
    if (!channel) return url;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);

    if (channel.custom_referer) proxyUrl.searchParams.set('referer', channel.custom_referer);
    if (channel.custom_origin) proxyUrl.searchParams.set('origin', channel.custom_origin);
    if (channel.custom_user_agent) proxyUrl.searchParams.set('user_agent', channel.custom_user_agent);
    if (channel.custom_cookie) proxyUrl.searchParams.set('cookie', channel.custom_cookie);

    if (channel.custom_headers && Object.keys(channel.custom_headers).length > 0) {
      proxyUrl.searchParams.set('custom_headers', JSON.stringify(channel.custom_headers));
    }

    return proxyUrl.toString();
  }, [channel]);

  const needsProxy = channel && (
    channel.custom_referer || 
    channel.custom_origin || 
    channel.custom_user_agent || 
    channel.custom_cookie ||
    (channel.custom_headers && Object.keys(channel.custom_headers).length > 0)
  );

  const streamUrl = channel ? (needsProxy ? getProxyUrl(channel.stream_url) : channel.stream_url) : '';

  const renderPlayer = () => {
    if (!channel || !streamUrl) return null;

    switch (playerType) {
      case 'clappr':
        return <ClapprPlayer key={playerKey} streamUrl={streamUrl} />;
      case 'hlsjs':
        return (
          <HlsJsPlayer
            key={playerKey}
            streamUrl={streamUrl}
            title={channel.name}
            useProxy={false}
          />
        );
      case 'iframe':
        return (
          <IframePlayer
            key={playerKey}
            streamUrl={channel.stream_url}
            wrapperUrl={iframeWrapperUrl}
            title={channel.name}
          />
        );
      case 'native':
        return (
          <video
            key={playerKey}
            src={streamUrl}
            className="w-full h-full object-contain bg-black"
            controls
            autoPlay
            playsInline
          />
        );
      default:
        return <ClapprPlayer key={playerKey} streamUrl={streamUrl} />;
    }
  };

  if (channelLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-4">
        <AlertCircle className="w-16 h-16 text-destructive" />
        <p className="text-white text-lg text-center">{error || "Channel not available"}</p>
        <Button onClick={() => navigate('/myplay')} variant="secondary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Channels
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black"
      onMouseMove={handleShowControls}
      onTouchStart={handleShowControls}
    >
      <div className="w-full h-full">
        {renderPlayer()}
      </div>

      {/* Top Control Bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-50 p-3",
          "bg-gradient-to-b from-black/80 via-black/40 to-transparent",
          "transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/myplay')}
              className="bg-white/10 hover:bg-white/20 text-white border-0 h-9 w-9 p-0 rounded-lg backdrop-blur-sm flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-white font-medium text-sm truncate">{channel.name}</h1>
              {channel.category && (
                <p className="text-white/50 text-xs capitalize">{channel.category}</p>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="bg-white/10 hover:bg-white/20 text-white border-0 h-9 w-9 p-0 rounded-lg backdrop-blur-sm"
            title="Retry stream"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MyPlayWatch;
