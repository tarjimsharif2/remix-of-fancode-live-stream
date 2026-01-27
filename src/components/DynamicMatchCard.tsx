import { Link } from "react-router-dom";
import { Play, Clock, Tv, Radio } from "lucide-react";
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
  const statusLower = status.toLowerCase();
  if (statusLower === 'live' || statusLower === 'started') {
    return 'bg-red-500 text-white animate-pulse';
  }
  if (statusLower === 'upcoming' || statusLower === 'not_started') {
    return 'bg-blue-500 text-white';
  }
  if (statusLower === 'ended' || statusLower === 'finished' || statusLower === 'completed') {
    return 'bg-gray-500 text-white';
  }
  return 'bg-primary text-primary-foreground';
};

const getStatusDisplay = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'started') return 'LIVE';
  if (statusLower === 'not_started') return 'UPCOMING';
  return status.toUpperCase();
};

export const DynamicMatchCard = ({ match, baseUrl, showRawData = false }: DynamicMatchCardProps) => {
  const streamCount = match.streamLinks?.length || 0;
  const hasStream = streamCount > 0;
  const formattedTime = formatTime(match.startTime);
  
  return (
    <Link to={`${baseUrl}?id=${match.matchId}`}>
      <Card className={cn(
        "group overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
        "bg-card border-border/50 hover:border-primary/50",
        !hasStream && "opacity-70"
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
              {(match.status.toLowerCase() === 'live' || match.status.toLowerCase() === 'started') && (
                <span className="w-2 h-2 rounded-full bg-white mr-1.5 animate-pulse" />
              )}
              {getStatusDisplay(match.status)}
            </Badge>
            
            {/* Stream Count Badge */}
            {hasStream && (
              <Badge className="absolute top-2 right-2 bg-green-600 text-white">
                <Radio className="w-3 h-3 mr-1" />
                {streamCount} Link{streamCount > 1 ? 's' : ''}
              </Badge>
            )}
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
          
          {/* Stream Links Preview */}
          {hasStream && match.streamLinks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {match.streamLinks.slice(0, 4).map((link, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0.5"
                >
                  {link.label}
                </Badge>
              ))}
              {match.streamLinks.length > 4 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                  +{match.streamLinks.length - 4} more
                </Badge>
              )}
            </div>
          )}
          
          {/* Description */}
          {match.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {match.description}
            </p>
          )}
          
          {/* No thumbnail - show status inline */}
          {!match.thumbnail && (
            <div className="flex gap-2">
              <Badge className={cn("w-fit", getStatusColor(match.status))}>
                {getStatusDisplay(match.status)}
              </Badge>
              {hasStream && (
                <Badge className="bg-green-600 text-white">
                  <Radio className="w-3 h-3 mr-1" />
                  {streamCount} Link{streamCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
          
          {/* Play Button */}
          <div className={cn(
            "flex items-center gap-2 text-sm font-medium",
            hasStream ? "text-primary" : "text-muted-foreground"
          )}>
            <Play className="w-4 h-4" />
            {hasStream ? `Watch Now` : "Stream Unavailable"}
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
