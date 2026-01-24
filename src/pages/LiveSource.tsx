import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DynamicMatchGrid } from "@/components/DynamicMatchGrid";
import { useJsonSourceMatches } from "@/hooks/useJsonSourceMatches";
import { Button } from "@/components/ui/button";
import { MappedMatch } from "@/utils/jsonFieldMapper";

const LiveSource = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { matches, loading, error, lastUpdated, sourceName, refetch } = useJsonSourceMatches(slug || "");

  // Base URL for watch pages
  const baseWatchUrl = `/live/${slug}/play-in`;

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

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Match Grid */}
          <DynamicMatchGrid
            matches={matches}
            baseUrl={baseWatchUrl}
            loading={loading}
          />

          {/* Match Count */}
          {!loading && matches.length > 0 && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {matches.length} matches found
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LiveSource;
