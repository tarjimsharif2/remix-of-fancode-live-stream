import { Match } from "@/types/match";
import { MatchBadge } from "./MatchBadge";
import { Button } from "./ui/button";
import { Play } from "lucide-react";

interface MatchCardProps {
  match: Match;
  index: number;
}

export const MatchCard = ({ match, index }: MatchCardProps) => {
  return (
    <div
      className="gradient-card rounded-xl overflow-hidden card-hover opacity-0 animate-fade-in border border-border/50"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Thumbnail */}
      <div className="relative h-48 md:h-56 bg-secondary overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent z-10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-6xl font-bold text-muted-foreground/20">
            {match.team1.charAt(0)} vs {match.team2.charAt(0)}
          </div>
        </div>
        {/* Team logos placeholder */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex justify-between items-end">
          <div className="w-16 h-16 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border">
            <span className="text-xl font-bold text-team">{match.team1.charAt(0)}</span>
          </div>
          <div className="w-16 h-16 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border">
            <span className="text-xl font-bold text-team">{match.team2.charAt(0)}</span>
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
            <span className="text-muted-foreground font-medium">Start:</span> {match.startTime}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="watch" size="watch" className="flex-1">
            <Play className="w-4 h-4" />
            Watch BD
          </Button>
          <Button variant="watch" size="watch" className="flex-1">
            <Play className="w-4 h-4" />
            Watch IN
          </Button>
        </div>
      </div>
    </div>
  );
};
