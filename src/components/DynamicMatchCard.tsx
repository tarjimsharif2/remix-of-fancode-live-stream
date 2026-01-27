import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Clock, Tv, Radio, Copy, ExternalLink, ChevronDown, ChevronUp, Check, Globe, Zap } from "lucide-react";
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

const getRegionStyle = (region?: string) => {
  switch (region?.toUpperCase()) {
    case 'BD':
      return { bg: 'bg-green-600', text: 'text-green-100', icon: '🇧🇩' };
    case 'IN':
      return { bg: 'bg-orange-600', text: 'text-orange-100', icon: '🇮🇳' };
    case 'WW':
      return { bg: 'bg-blue-600', text: 'text-blue-100', icon: '🌍' };
    default:
      return null;
  }
};

interface StreamLinkItemProps {
  link: StreamLink;
  baseUrl: string;
  matchId: string;
  index: number;
}

const StreamLinkItem = ({ link, baseUrl, matchId, index }: StreamLinkItemProps) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const regionStyle = getRegionStyle(link.region);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate with stream URL encoded
    navigate(`${baseUrl}?id=${matchId}&stream=${encodeURIComponent(link.url)}`);
  };

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast({
        title: "URL Copied!",
        description: "M3U8 link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy URL",
        variant: "destructive",
      });
    }
  };

  const isPrimary = link.label.toLowerCase().includes('primary');
  const isDAI = link.label.toLowerCase().includes('dai');

  return (
    <div 
      className={cn(
        "flex items-center justify-between gap-2 p-2.5 rounded-lg",
        "bg-muted/50 hover:bg-muted transition-colors",
        "border border-transparent hover:border-border"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isPrimary ? (
          <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        ) : isDAI ? (
          <Globe className="w-4 h-4 text-blue-400 flex-shrink-0" />
        ) : (
          <Radio className="w-4 h-4 text-green-500 flex-shrink-0" />
        )}
        <span className="text-sm font-medium truncate">{link.label}</span>
        {regionStyle && (
          <Badge className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", regionStyle.bg, regionStyle.text)}>
            {regionStyle.icon} {link.region}
          </Badge>
        )}
        {link.quality && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
            {link.quality}
          </Badge>
        )}
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Copy URL Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyUrl}
          className="h-8 w-8 p-0 hover:bg-primary/20"
          title="Copy M3U8 URL"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        
        {/* Play Button */}
        <Button
          variant="default"
          size="sm"
          onClick={handlePlay}
          className="h-8 px-3 gap-1.5"
        >
          <Play className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Play</span>
        </Button>
      </div>
    </div>
  );
};

export const DynamicMatchCard = ({ match, baseUrl, showRawData = false }: DynamicMatchCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const streamCount = match.streamLinks?.length || 0;
  const hasStream = streamCount > 0;
  const formattedTime = formatTime(match.startTime);
  
  const handleCardClick = () => {
    if (hasStream) {
      setExpanded(!expanded);
    }
  };

  return (
    <Card 
      className={cn(
        "group overflow-hidden transition-all duration-300",
        "bg-card border-border/50",
        hasStream && "hover:border-primary/50 cursor-pointer",
        expanded && "ring-2 ring-primary/30",
        !hasStream && "opacity-70"
      )}
      onClick={handleCardClick}
    >
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
            <Badge className="absolute top-2 right-2 bg-green-600/90 text-white backdrop-blur-sm">
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
        
        {/* Expand/Collapse Button */}
        {hasStream && (
          <div className={cn(
            "flex items-center justify-between pt-2 border-t border-border/50",
            "text-sm font-medium text-primary"
          )}>
            <span className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              {expanded ? "Hide Streams" : "Select Stream"}
            </span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        )}

        {/* Stream Links - Expanded View */}
        {expanded && hasStream && (
          <div 
            className="space-y-2 pt-2 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {match.streamLinks.map((link, index) => (
              <StreamLinkItem
                key={index}
                link={link}
                baseUrl={baseUrl}
                matchId={match.matchId}
                index={index}
              />
            ))}
          </div>
        )}

        {/* No Stream Message */}
        {!hasStream && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Play className="w-4 h-4" />
            Stream Unavailable
          </div>
        )}
        
        {/* Raw Data (Debug mode) */}
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
