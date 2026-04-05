import { useState, useEffect, useCallback } from "react";
import { Radio, ChevronDown, Settings2, Check, Globe, Zap, Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ClapprPlayer } from "./ClapprPlayer";
import { ClapprProxyPlayer } from "./ClapprProxyPlayer";
import { HlsJsPlayer } from "./HlsJsPlayer";
import { IframePlayer } from "./IframePlayer";
import { ShakaPlayer } from "./ShakaPlayer";
import { PlayerType, PLAYER_CONFIGS, getPlayerConfig } from "@/types/playerTypes";
import { StreamLink } from "@/utils/streamExtractor";
import { cn } from "@/lib/utils";

interface UniversalPlayerProps {
  streamLinks: StreamLink[];
  title?: string;
  defaultPlayer?: PlayerType;
  iframeWrapperUrl?: string;
  useProxy?: boolean;
  proxyConfig?: {
    referer?: string;
    origin?: string;
  };
}

// Region colors and icons
const getRegionStyle = (region?: string) => {
  switch (region?.toUpperCase()) {
    case 'BD':
      return { bg: 'bg-green-600', text: 'text-green-100', label: '🇧🇩 BD' };
    case 'IN':
      return { bg: 'bg-orange-600', text: 'text-orange-100', label: '🇮🇳 IN' };
    case 'WW':
      return { bg: 'bg-blue-600', text: 'text-blue-100', label: '🌍 WW' };
    default:
      return null;
  }
};

// Group streams by region
const groupStreamsByRegion = (links: StreamLink[]) => {
  const groups: Record<string, StreamLink[]> = {
    'Primary': [],
    'BD': [],
    'IN': [],
    'WW': [],
    'Other': [],
  };

  links.forEach((link, originalIndex) => {
    const linkWithIndex = { ...link, originalIndex };
    
    if (link.label.toLowerCase().includes('primary') || link.label.toLowerCase().includes('dai')) {
      groups['Primary'].push(linkWithIndex as any);
    } else if (link.region === 'BD') {
      groups['BD'].push(linkWithIndex as any);
    } else if (link.region === 'IN') {
      groups['IN'].push(linkWithIndex as any);
    } else if (link.region === 'WW') {
      groups['WW'].push(linkWithIndex as any);
    } else {
      groups['Other'].push(linkWithIndex as any);
    }
  });

  return groups;
};

export const UniversalPlayer = ({
  streamLinks,
  title = "Live Stream",
  defaultPlayer = 'clappr',
  iframeWrapperUrl,
  useProxy = false,
  proxyConfig,
}: UniversalPlayerProps) => {
  const [currentStreamIndex, setCurrentStreamIndex] = useState(0);
  const [playerType, setPlayerType] = useState<PlayerType>(defaultPlayer);
  const [showControls, setShowControls] = useState(true);
  const [playerKey, setPlayerKey] = useState(0);

  const currentStream = streamLinks[currentStreamIndex];
  const groupedStreams = groupStreamsByRegion(streamLinks);

  // Hide controls after inactivity
  useEffect(() => {
    if (!showControls) return;
    const timer = setTimeout(() => setShowControls(false), 4000);
    return () => clearTimeout(timer);
  }, [showControls]);

  const handleShowControls = useCallback(() => {
    setShowControls(true);
  }, []);

  const handleStreamChange = (index: number) => {
    setCurrentStreamIndex(index);
    setPlayerKey(prev => prev + 1); // Force player reload
  };

  const handleRetry = () => {
    setPlayerKey(prev => prev + 1);
  };

  if (!currentStream || streamLinks.length === 0) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <Radio className="w-12 h-12 text-white/30 mx-auto mb-3" />
          <p className="text-white/70">No stream available</p>
        </div>
      </div>
    );
  }

  const renderPlayer = () => {
    switch (playerType) {
      case 'clappr':
        return <ClapprPlayer key={playerKey} streamUrl={currentStream.url} />;
      case 'clappr-proxy':
        return (
          <ClapprProxyPlayer
            key={playerKey}
            streamUrl={currentStream.url}
            referer={proxyConfig?.referer}
            origin={proxyConfig?.origin}
          />
        );
      case 'hlsjs':
        return (
          <HlsJsPlayer
            key={playerKey}
            streamUrl={currentStream.url}
            title={title}
            useProxy={useProxy}
            proxyConfig={proxyConfig}
          />
        );
      case 'iframe':
        return (
          <IframePlayer
            key={playerKey}
            streamUrl={currentStream.url}
            wrapperUrl={iframeWrapperUrl}
            title={title}
          />
        );
      case 'shaka':
        return <ShakaPlayer key={playerKey} streamUrl={currentStream.url} title={title} />;
      case 'native':
        return (
          <video
            key={playerKey}
            src={currentStream.url}
            className="w-full h-full"
            controls
            autoPlay
            playsInline
          />
        );
      default:
        return <ClapprPlayer key={playerKey} streamUrl={currentStream.url} />;
    }
  };

  const regionStyle = getRegionStyle(currentStream.region);

  return (
    <div 
      className="relative w-full h-full bg-black"
      onMouseMove={handleShowControls}
      onTouchStart={handleShowControls}
      onClick={handleShowControls}
    >
      {/* Player */}
      {renderPlayer()}

      {/* Top Control Bar */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-50 p-2 sm:p-3",
          "bg-gradient-to-b from-black/80 via-black/40 to-transparent",
          "transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left: Stream Selector */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {streamLinks.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "bg-white/10 hover:bg-white/20 text-white border-0 backdrop-blur-sm",
                      "h-9 px-3 rounded-lg gap-2 max-w-[200px]"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Radio className="w-4 h-4 flex-shrink-0 text-green-400" />
                      <span className="truncate text-sm font-medium">
                        {currentStream.label}
                      </span>
                      {regionStyle && (
                        <Badge className={cn("text-[10px] px-1.5 py-0", regionStyle.bg, regionStyle.text)}>
                          {regionStyle.label}
                        </Badge>
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 flex-shrink-0 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-64 bg-zinc-900/95 backdrop-blur-lg border-white/10 shadow-2xl"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="text-white/60 flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    Select Stream ({streamLinks.length} available)
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/10" />
                  
                  {/* Grouped Streams */}
                  {Object.entries(groupedStreams).map(([group, links]) => {
                    if (links.length === 0) return null;
                    
                    const groupIcon = group === 'Primary' ? <Zap className="w-3 h-3" /> :
                                     group === 'BD' ? <span>🇧🇩</span> :
                                     group === 'IN' ? <span>🇮🇳</span> :
                                     group === 'WW' ? <Globe className="w-3 h-3" /> : null;
                    
                    return (
                      <DropdownMenuGroup key={group}>
                        {group !== 'Other' && (
                          <DropdownMenuLabel className="text-white/40 text-xs flex items-center gap-1.5 py-1">
                            {groupIcon}
                            {group === 'Primary' ? 'Primary Sources' :
                             group === 'BD' ? 'Bangladesh' :
                             group === 'IN' ? 'India' :
                             group === 'WW' ? 'Worldwide' : group}
                          </DropdownMenuLabel>
                        )}
                        {links.map((link: any) => {
                          const isSelected = currentStreamIndex === link.originalIndex;
                          const linkRegionStyle = getRegionStyle(link.region);
                          
                          return (
                            <DropdownMenuItem
                              key={link.originalIndex}
                              onClick={() => handleStreamChange(link.originalIndex)}
                              className={cn(
                                "text-white cursor-pointer rounded-md mx-1 my-0.5",
                                "focus:bg-white/10 hover:bg-white/10",
                                isSelected && "bg-primary/20 text-primary"
                              )}
                            >
                              <div className="flex items-center justify-between w-full gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {isSelected ? (
                                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                                  ) : (
                                    <Play className="w-4 h-4 opacity-40 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{link.label.replace(` (${link.region})`, '')}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {link.quality && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-white/20 text-white/60">
                                      {link.quality}
                                    </Badge>
                                  )}
                                  {linkRegionStyle && (
                                    <Badge className={cn("text-[10px] px-1.5 py-0", linkRegionStyle.bg, linkRegionStyle.text)}>
                                      {link.region}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuGroup>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 h-9">
                <Radio className="w-4 h-4 text-green-400" />
                <span className="text-sm text-white font-medium truncate">{currentStream.label}</span>
              </div>
            )}

            {/* Retry Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="bg-white/10 hover:bg-white/20 text-white border-0 h-9 w-9 p-0 rounded-lg backdrop-blur-sm"
              title="Retry stream"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Right: Player Type Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-0 h-9 px-3 rounded-lg backdrop-blur-sm gap-2"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">{getPlayerConfig(playerType).label}</span>
                <ChevronDown className="w-4 h-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-56 bg-zinc-900/95 backdrop-blur-lg border-white/10 shadow-2xl"
              sideOffset={8}
            >
              <DropdownMenuLabel className="text-white/60 flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Player Engine
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              {PLAYER_CONFIGS.map((config) => {
                const isSelected = playerType === config.type;
                return (
                  <DropdownMenuItem
                    key={config.type}
                    onClick={() => setPlayerType(config.type)}
                    className={cn(
                      "text-white cursor-pointer rounded-md mx-1 my-0.5",
                      "focus:bg-white/10 hover:bg-white/10",
                      isSelected && "bg-primary/20"
                    )}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      ) : (
                        <span className="w-4 h-4 flex items-center justify-center opacity-60">{config.icon}</span>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className={cn("font-medium", isSelected && "text-primary")}>{config.label}</span>
                        <span className="text-xs text-white/50 truncate">{config.description}</span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title Bar (optional) */}
        {title && (
          <div className="mt-2 px-1">
            <h3 className="text-white/90 text-sm font-medium truncate">{title}</h3>
          </div>
        )}
      </div>

      {/* Stream Count Badge (always visible) */}
      {streamLinks.length > 1 && (
        <div 
          className={cn(
            "absolute bottom-3 right-3 z-40 transition-opacity duration-300",
            showControls ? "opacity-0" : "opacity-100"
          )}
        >
          <Badge className="bg-black/60 text-white/80 backdrop-blur-sm border-0">
            <Radio className="w-3 h-3 mr-1.5 text-green-400" />
            {currentStreamIndex + 1}/{streamLinks.length}
          </Badge>
        </div>
      )}
    </div>
  );
};
