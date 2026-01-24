import { Link } from "react-router-dom";
import { Play, Clock, Tv, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MappedMatch } from "@/utils/jsonFieldMapper";
import { cn } from "@/lib/utils";

interface DynamicMatchCardProps {
  match: MappedMatch;
  baseUrl: string;
  showRawData?: boolean;
}

const formatTime = (timeStr: string): string => {
  if (!timeStr) return '';
  
  try {
    // Try parsing as ISO date
    const date = new Date(timeStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }
  } catch {
    // Return as-is if can't parse
  }
  
  return timeStr;
};

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'live':
      return 'bg-red-500 text-white animate-pulse';
    case 'upcoming':
      return 'bg-blue-500 text-white';
    case 'ended':
    case 'finished':
    case 'completed':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-primary text-primary-foreground';
  }
};

export const DynamicMatchCard = ({ match, baseUrl, showRawData = false }: DynamicMatchCardProps) => {
  const hasStream = !!match.streamUrl;
  const formattedTime = formatTime(match.startTime);
  
  return (
    <Link to={`${baseUrl}?id=${match.matchId}`}>
      <Card className={cn(
        "group overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
        "bg-card border-border/50 hover:border-primary/50",
        !hasStream && "opacity-60"
      )}>
        {/* Thumbnail */}
        {match.thumbnail && (
          <div className="relative aspect-video overflow-hidden bg-muted">
            <img
              src={match.thumbnail}
              alt={match.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            {/* Status Badge Overlay */}
            <Badge className={cn(
              "absolute top-2 left-2",
              getStatusColor(match.status)
            )}>
              {match.status.toLowerCase() === 'live' && (
                <span className="w-2 h-2 rounded-full bg-white mr-1.5 animate-pulse" />
              )}
              {match.status.toUpperCase()}
            </Badge>
          </div>
        )}
        
        <CardContent className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {match.title}
          </h3>
          
          {/* Meta Info */}
          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            {/* Category */}
            {match.category && match.category !== 'Sports' && (
              <span className="flex items-center gap-1">
                <Tv className="w-3.5 h-3.5" />
                {match.category}
              </span>
            )}
            
            {/* Time */}
            {formattedTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formattedTime}
              </span>
            )}
          </div>
          
          {/* Description */}
          {match.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {match.description}
            </p>
          )}
          
          {/* No thumbnail - show status inline */}
          {!match.thumbnail && (
            <Badge className={cn("w-fit", getStatusColor(match.status))}>
              {match.status.toUpperCase()}
            </Badge>
          )}
          
          {/* Play Button */}
          <div className={cn(
            "flex items-center gap-2 text-sm font-medium",
            hasStream ? "text-primary" : "text-muted-foreground"
          )}>
            <Play className="w-4 h-4" />
            {hasStream ? "Watch Now" : "Stream Unavailable"}
          </div>
          
          {/* Raw Data (Debug mode) */}
          {showRawData && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Raw Data
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded text-[10px] overflow-auto max-h-40">
                {JSON.stringify(match.rawData, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
