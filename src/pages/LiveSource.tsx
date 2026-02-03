import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw, AlertCircle, Search, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DynamicMatchGrid } from "@/components/DynamicMatchGrid";
import { useJsonSourceMatches } from "@/hooks/useJsonSourceMatches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MappedMatch } from "@/utils/jsonFieldMapper";

const LiveSource = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { matches, loading, error, lastUpdated, sourceName, refetch } = useJsonSourceMatches(slug || "");

  // Base URL for watch pages
  const baseWatchUrl = `/live/${slug}/play-in`;

  // Filter matches by search query
  const filteredMatches = matches.filter((match) =>
    match.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (match.category && match.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (match.status && match.status.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {sourceName || "Live Matches"}
              </h1>
              {lastUpdated && (
                <p className="text-sm text-muted-foreground">
                  Updated: {lastUpdated.toLocaleString()}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
              className="w-fit"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Search Input */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search matches..."
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

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* No Results State */}
          {!loading && !error && matches.length > 0 && filteredMatches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Search className="w-16 h-16 text-muted-foreground" />
              <p className="text-muted-foreground text-lg">No matches found for "{searchQuery}"</p>
              <Button onClick={() => setSearchQuery("")} variant="outline">
                <X className="w-4 h-4 mr-2" />
                Clear Search
              </Button>
            </div>
          )}

          {/* Match Grid */}
          {(filteredMatches.length > 0 || loading || matches.length === 0) && (
            <DynamicMatchGrid
              matches={filteredMatches}
              baseUrl={baseWatchUrl}
              loading={loading}
            />
          )}

          {/* Match Count */}
          {!loading && filteredMatches.length > 0 && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {filteredMatches.length} {searchQuery ? `of ${matches.length}` : ""} matches found
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LiveSource;
