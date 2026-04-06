import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCustomChannels } from "@/hooks/useCustomChannels";
import { CustomChannel } from "@/types/customChannel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, AlertCircle, Play, Tv, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MyPlay = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { channels, loading, error, refetch } = useCustomChannels();
  const navigate = useNavigate();

  const handleWatch = (channel: CustomChannel) => {
    navigate(`/myplay/watch?id=${channel.slug}`);
  };

  // Filter channels by search query
  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (channel.category && channel.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group filtered channels by category
  const groupedChannels = filteredChannels.reduce((acc, channel) => {
    const category = channel.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(channel);
    return acc;
  }, {} as Record<string, CustomChannel[]>);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tv className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">MyPlay Channels</h1>
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

        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          )}
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
            <p className="text-muted-foreground text-sm">Add channels from the Admin Panel</p>
          </div>
        )}

        {!loading && !error && channels.length > 0 && filteredChannels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Search className="w-16 h-16 text-muted-foreground" />
            <p className="text-muted-foreground text-lg">No channels found for "{searchQuery}"</p>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              <X className="w-4 h-4 mr-2" />
              Clear Search
            </Button>
          </div>
        )}

        {!loading && !error && filteredChannels.length > 0 && (
          <div className="space-y-8">
            {Object.entries(groupedChannels).map(([category, categoryChannels]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-foreground mb-4 capitalize border-b border-border pb-2">
                  {category}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {categoryChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-colors cursor-pointer group"
                      onClick={() => handleWatch(channel)}
                    >
                      <div className="aspect-video bg-muted flex items-center justify-center relative overflow-hidden">
                        {channel.logo_url ? (
                          <img
                            src={channel.logo_url}
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
                          channel.logo_url ? "hidden" : ""
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
                  ))}
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

export default MyPlay;
