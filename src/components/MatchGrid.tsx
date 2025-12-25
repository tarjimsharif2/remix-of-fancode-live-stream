import { Match } from "@/types/match";
import { MatchCard } from "./MatchCard";

interface MatchGridProps {
  matches: Match[];
}

export const MatchGrid = ({ matches }: MatchGridProps) => {
  const liveMatches = matches.filter((m) => m.status === "live");
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");

  return (
    <div className="container mx-auto py-8 px-4 space-y-10">
      {liveMatches.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-muted-foreground mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
            Live Now
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {liveMatches.map((match, index) => (
              <MatchCard key={match.id} match={match} index={index} />
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
              <MatchCard key={match.id} match={match} index={index + liveMatches.length} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
