import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useM3uChannels } from "@/hooks/useM3uChannels";
import { M3uChannel } from "@/types/m3uPlaylist";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, Play, Tv, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const Playlist = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { playlist, channels, loading, error, refetch } = useM3uChannels(slug || null);

  const handleWatch = (channel: M3uChannel, index: number) => {
    navigate(`/playlist/${slug}/watch?index=${index}`);
  };

  // Group channels by group
  const groupedChannels = channels.reduce((acc, channel) => {
    const group = channel.group || 'Other';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(channel);
    return acc;
  }, {} as Record<string, M3uChannel[]>);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Tv className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {playlist?.name || 'Playlist'}
              </h1>
              {playlist?.description && (
                <p className="text-sm text-muted-foreground">{playlist.description}</p>
              )}
            </div>
          </div>
          <Button
            onClick={refetch}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-muted-foreground">Loading channels...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="w-16 h-16 text-destructive" />
            <p className="text-destructive">{error}</p>
            <Button onClick={refetch} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {!loading && !error && channels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Tv className="w-16 h-16 text-muted-foreground" />
            <p className="text-muted-foreground text-lg">No channels available</p>
          </div>
        )}

        {!loading && !error && channels.length > 0 && (
          <div className="space-y-8">
            {Object.entries(groupedChannels).map(([group, groupChannels]) => (
              <div key={group}>
                <h2 className="text-lg font-semibold text-foreground mb-4 capitalize border-b border-border pb-2">
                  {group}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {groupChannels.map((channel, idx) => {
                    const globalIndex = channels.findIndex(c => c.url === channel.url);
                    return (
                      <div
                        key={`${channel.url}-${idx}`}
                        className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-colors cursor-pointer group"
                        onClick={() => handleWatch(channel, globalIndex)}
                      >
                        <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                          {channel.logo ? (
                            <img
                              src={channel.logo}
                              alt={channel.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={cn(
                            "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5",
                            channel.logo ? "hidden" : ""
                          )}>
                            <Tv className="w-10 h-10 text-primary/50" />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-10 h-10 text-white" />
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium text-foreground text-sm truncate">
                            {channel.name}
                          </h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Playlist;
