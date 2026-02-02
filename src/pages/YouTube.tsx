import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useYouTubeStreams } from "@/hooks/useYouTubeStreams";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Youtube, Play, RefreshCw, Tv } from "lucide-react";

const YouTube = () => {
  const navigate = useNavigate();
  const { streams, loading, error, refetch } = useYouTubeStreams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(streams.map((s) => s.category || "general"));
    return Array.from(cats).sort();
  }, [streams]);

  // Filter streams
  const filteredStreams = useMemo(() => {
    return streams.filter((stream) => {
      const matchesSearch = stream.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || stream.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [streams, searchQuery, selectedCategory]);

  const handleStreamClick = (streamId: string) => {
    navigate(`/youtube/watch/${streamId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Youtube className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">YouTube Live</h1>
              <p className="text-sm text-muted-foreground">
                {streams.length} live streams available
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search streams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="icon" onClick={refetch}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="capitalize"
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading streams...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refetch}>Try Again</Button>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="text-center py-20">
            <Tv className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "No streams match your search" : "No YouTube streams available"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStreams.map((stream) => (
              <Card
                key={stream.id}
                className="group cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                onClick={() => handleStreamClick(stream.id)}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-muted">
                    {stream.logo_url ? (
                      <img
                        src={stream.logo_url}
                        alt={stream.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/20 to-red-600/30">
                        <Youtube className="w-12 h-12 text-red-500" />
                      </div>
                    )}
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </div>
                    </div>

                    {/* Live badge */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">
                        LIVE
                      </span>
                    </div>

                    {/* Cached indicator */}
                    {stream.cached_m3u8 && (
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-green-500/80 text-white">
                          ✓ Ready
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3">
                    <h3 className="font-medium truncate">{stream.name}</h3>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {stream.category}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default YouTube;
