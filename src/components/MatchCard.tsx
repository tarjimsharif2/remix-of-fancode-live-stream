import { Match } from "@/types/match";
import { MatchBadge } from "./MatchBadge";
import { Button } from "./ui/button";
import { Play } from "lucide-react";

interface MatchCardProps {
  match: Match;
  index: number;
  onWatch: (match: Match, region: 'BD' | 'IN') => void;
}

export const MatchCard = ({ match, index, onWatch }: MatchCardProps) => {
  return (
    <div
      className="gradient-card rounded-xl overflow-hidden card-hover opacity-0 animate-fade-in border border-border/50"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Thumbnail */}
      <div className="relative h-48 md:h-56 bg-secondary overflow-hidden">
        {match.thumbnail ? (
          <img
            src={match.thumbnail}
            alt={`${match.team1} vs ${match.team2}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent z-10" />
        
        {/* Team logos */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-between items-end">
          <div className="w-14 h-14 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border overflow-hidden">
            <span className="text-lg font-bold text-team">{match.team1.charAt(0)}</span>
          </div>
          <div className="w-14 h-14 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border overflow-hidden">
            <span className="text-lg font-bold text-team">{match.team2.charAt(0)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <MatchBadge status={match.status} />
        
        <h3 className="text-xl md:text-2xl font-bold text-team leading-tight">
          {match.team1} vs {match.team2}
        </h3>

        <div className="space-y-1.5 text-sm">
          <p className="text-foreground">
            <span className="text-muted-foreground font-medium">Event:</span> {match.event}
          </p>
          <p className="text-foreground">
            <span className="text-muted-foreground font-medium">Status:</span> {match.startTime}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="watch"
            size="watch"
            className="flex-1"
            onClick={() => onWatch(match, 'BD')}
            disabled={!match.matchId}
          >
            <Play className="w-4 h-4" />
            Watch BD
          </Button>
          <Button
            variant="watch"
            size="watch"
            className="flex-1"
            onClick={() => onWatch(match, 'IN')}
            disabled={!match.matchId}
          >
            <Play className="w-4 h-4" />
            Watch IN
          </Button>
        </div>
      </div>
    </div>
  );
};
