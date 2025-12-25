import { Match } from "@/types/match";
import { MatchCard } from "./MatchCard";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface MatchGridProps {
  matches: Match[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
  onWatch: (match: Match) => void;
  onRefresh: () => void;
}

export const MatchGrid = ({ matches, loading, error, lastUpdated, onWatch, onRefresh }: MatchGridProps) => {
  const liveMatches = matches.filter((m) => m.status === "live");
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");

  if (loading) {
    return (
      <div className="container mx-auto py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading matches from Fancode...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-20 flex flex-col items-center justify-center text-center px-4">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="container mx-auto py-20 flex flex-col items-center justify-center text-center px-4">
        <p className="text-muted-foreground mb-4">No live matches available at the moment.</p>
        <Button onClick={onRefresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-10">
      {/* Last updated info */}
      {lastUpdated && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
          <Button onClick={onRefresh} variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      {liveMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-muted-foreground mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
            Live Now ({liveMatches.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveMatches.map((match, index) => (
              <MatchCard key={match.id} match={match} index={index} onWatch={onWatch} />
            ))}
          </div>
        </section>
      )}

      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-muted-foreground mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-upcoming" />
            Upcoming Matches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingMatches.map((match, index) => (
              <MatchCard key={match.id} match={match} index={index + liveMatches.length} onWatch={onWatch} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
