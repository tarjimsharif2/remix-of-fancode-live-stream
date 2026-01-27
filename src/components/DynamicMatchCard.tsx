import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Clock, Tv, Radio, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MappedMatch } from "@/utils/jsonFieldMapper";
import { StreamLink } from "@/utils/streamExtractor";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface DynamicMatchCardProps {
  match: MappedMatch;
  baseUrl: string;
  showRawData?: boolean;
}

const formatTime = (timeStr: string): string => {
  if (!timeStr) return '';
  
  try {
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
    // Return as-is
  }
  
  return timeStr;
};

const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  if (statusLower === 'live' || statusLower === 'started') {
    return 'bg-red-500 text-white';
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

const getRegionBadgeStyle = (region?: string): string => {
  switch (region?.toUpperCase()) {
    case 'BD':
      return 'bg-green-600 hover:bg-green-700 text-white';
    case 'IN':
      return 'bg-orange-600 hover:bg-orange-700 text-white';
    case 'WW':
      return 'bg-blue-600 hover:bg-blue-700 text-white';
    default:
      return 'bg-zinc-700 hover:bg-zinc-600 text-white';
  }
};

interface StreamBadgeProps {
  link: StreamLink;
  baseUrl: string;
  matchId: string;
  linkNumber: number; // 1-based index
}

const StreamBadge = ({ link, baseUrl, matchId, linkNumber }: StreamBadgeProps) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handlePlay = () => {
    // Use simple link number instead of full URL
    navigate(`${baseUrl}?id=${matchId}&link=${linkNumber}`);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast({ title: "URL Copied!", description: `Link ${linkNumber}: ${link.label}` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy Failed", variant: "destructive" });
    }
  };

  return (
    <div className="inline-flex items-center gap-0.5 group">
      <Badge
        className={cn(
          "cursor-pointer transition-all text-xs px-2.5 py-1 rounded-l-md rounded-r-none font-medium",
          getRegionBadgeStyle(link.region)
        )}
        onClick={handlePlay}
      >
        {linkNumber}. {link.label}
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className={cn(
          "h-6 w-6 p-0 rounded-l-none rounded-r-md",
          "bg-zinc-800 hover:bg-zinc-700 text-white/70 hover:text-white"
        )}
        title="Copy M3U8 URL"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  );
};

export const DynamicMatchCard = ({ match, baseUrl, showRawData = false }: DynamicMatchCardProps) => {
  const navigate = useNavigate();
  const streamCount = match.streamLinks?.length || 0;
  const hasStream = streamCount > 0;
  const formattedTime = formatTime(match.startTime);
  const isLive = match.status.toLowerCase() === 'live' || match.status.toLowerCase() === 'started';
  
  // Play first available stream (link=1)
  const handleWatchNow = () => {
    if (hasStream) {
      navigate(`${baseUrl}?id=${match.matchId}&link=1`);
    }
  };

  return (
    <Card className={cn(
      "group overflow-hidden transition-all duration-300",
      "bg-card border-border/50 hover:border-primary/30",
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
          {/* Status Badge */}
          <Badge className={cn(
            "absolute top-2 left-2",
            getStatusColor(match.status),
            isLive && "animate-pulse"
          )}>
            {isLive && <span className="w-2 h-2 rounded-full bg-white mr-1.5" />}
            {getStatusDisplay(match.status)}
          </Badge>
          
          {/* Stream Count */}
          {hasStream && (
            <Badge className="absolute top-2 right-2 bg-green-600/90 text-white backdrop-blur-sm">
              <Radio className="w-3 h-3 mr-1" />
              {streamCount} Link{streamCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      )}
      
      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-foreground line-clamp-2">
          {match.title}
        </h3>
        
        {/* Meta Info */}
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          {match.category && match.category !== 'Sports' && (
            <span className="flex items-center gap-1">
              <Tv className="w-3.5 h-3.5" />
              {match.category}
            </span>
          )}
          
          {formattedTime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formattedTime}
            </span>
          )}
        </div>

        {/* No thumbnail - show status inline */}
        {!match.thumbnail && (
          <div className="flex gap-2">
            <Badge className={cn("w-fit", getStatusColor(match.status), isLive && "animate-pulse")}>
              {isLive && <span className="w-2 h-2 rounded-full bg-white mr-1.5" />}
              {getStatusDisplay(match.status)}
            </Badge>
            {hasStream && (
              <Badge className="bg-green-600 text-white">
                <Radio className="w-3 h-3 mr-1" />
                {streamCount}
              </Badge>
            )}
          </div>
        )}
        
        {/* Stream Link Badges - FanCode Style */}
        {hasStream && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {match.streamLinks.slice(0, 5).map((link, index) => (
              <StreamBadge
                key={index}
                link={link}
                baseUrl={baseUrl}
                matchId={match.matchId}
                linkNumber={index + 1}
              />
            ))}
            {match.streamLinks.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{match.streamLinks.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* Watch Now Button */}
        {hasStream && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleWatchNow}
            className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 p-0 h-auto"
          >
            <Play className="w-4 h-4 mr-2" />
            Watch Now
          </Button>
        )}

        {/* No Stream Message */}
        {!hasStream && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Play className="w-4 h-4" />
            Stream Unavailable
          </div>
        )}
        
        {/* Raw Data (Debug) */}
        {showRawData && (
          <details className="text-xs" onClick={(e) => e.stopPropagation()}>
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
  );
};
