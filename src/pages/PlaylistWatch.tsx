import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useM3uChannels } from "@/hooks/useM3uChannels";
import { M3uChannel } from "@/types/m3uPlaylist";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PlaylistWatch = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const channelIndex = parseInt(searchParams.get("index") || "0", 10);

  const { playlist, channels, loading, error, refetch } = useM3uChannels(slug || null);
  const [currentChannel, setCurrentChannel] = useState<M3uChannel | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (channels.length > 0 && channelIndex >= 0 && channelIndex < channels.length) {
      setCurrentChannel(channels[channelIndex]);
    }
  }, [channels, channelIndex]);

  const getProxyUrl = useCallback((url: string) => {
    if (!url) return '';
    
    const proxyUrl = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);
    
    return proxyUrl.toString();
  }, []);

  const handleClose = () => {
    navigate(`/playlist/${slug}`);
  };

  const handleRetry = async () => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      await refetch();
    }
  };

  const handlePrevChannel = () => {
    if (channelIndex > 0) {
      navigate(`/playlist/${slug}/watch?index=${channelIndex - 1}`);
    }
  };

  const handleNextChannel = () => {
    if (channelIndex < channels.length - 1) {
      navigate(`/playlist/${slug}/watch?index=${channelIndex + 1}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading channel...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !currentChannel) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <AlertCircle className="w-16 h-16 text-destructive" />
            <p className="text-destructive">{error || 'Channel not found'}</p>
            <div className="flex gap-2">
              <Button onClick={handleClose} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Playlist
              </Button>
              <Button onClick={handleRetry} variant="outline" disabled={retryCount >= maxRetries}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry ({maxRetries - retryCount} left)
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const streamUrl = getProxyUrl(currentChannel.url);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {currentChannel.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {playlist?.name} • Channel {channelIndex + 1} of {channels.length}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevChannel}
              disabled={channelIndex === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextChannel}
              disabled={channelIndex === channels.length - 1}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="aspect-video w-full max-w-5xl mx-auto">
          <VideoPlayer
            streamUrl={streamUrl}
            matchName={currentChannel.name}
            onClose={handleClose}
          />
        </div>

        {/* Channel list sidebar */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Other Channels</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {channels.map((ch, idx) => (
              <button
                key={`${ch.url}-${idx}`}
                onClick={() => navigate(`/playlist/${slug}/watch?index=${idx}`)}
                className={cn(
                  "p-2 rounded-lg text-xs text-left truncate transition-colors",
                  idx === channelIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:border-primary"
                )}
              >
                {ch.name}
              </button>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PlaylistWatch;
