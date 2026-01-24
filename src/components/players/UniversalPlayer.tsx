import { useState, useEffect } from "react";
import { Radio, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ClapprPlayer } from "./ClapprPlayer";
import { HlsJsPlayer } from "./HlsJsPlayer";
import { IframePlayer } from "./IframePlayer";
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
  const [showSelector, setShowSelector] = useState(true);

  const currentStream = streamLinks[currentStreamIndex];

  useEffect(() => {
    // Auto-hide selector after 5 seconds
    const timer = setTimeout(() => setShowSelector(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!currentStream || streamLinks.length === 0) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <p className="text-white/70">No stream available</p>
      </div>
    );
  }

  const renderPlayer = () => {
    switch (playerType) {
      case 'clappr':
        return <ClapprPlayer streamUrl={currentStream.url} />;
      case 'hlsjs':
        return (
          <HlsJsPlayer
            streamUrl={currentStream.url}
            title={title}
            useProxy={useProxy}
            proxyConfig={proxyConfig}
          />
        );
      case 'iframe':
        return (
          <IframePlayer
            streamUrl={currentStream.url}
            wrapperUrl={iframeWrapperUrl}
            title={title}
          />
        );
      case 'native':
        return (
          <video
            src={currentStream.url}
            className="w-full h-full"
            controls
            autoPlay
            playsInline
          />
        );
      default:
        return <ClapprPlayer streamUrl={currentStream.url} />;
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black"
      onMouseMove={() => setShowSelector(true)}
      onTouchStart={() => setShowSelector(true)}
    >
      {/* Player */}
      {renderPlayer()}

      {/* Stream & Player Selector */}
      <div
        className={cn(
          "absolute top-2 left-2 z-50 flex items-center gap-2 transition-opacity duration-300",
          showSelector ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Stream Selector (if multiple) */}
        {streamLinks.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="bg-black/70 hover:bg-black/90 text-white border-0"
              >
                <Radio className="w-4 h-4 mr-2" />
                {currentStream.label}
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-black/95 border-white/20">
              <DropdownMenuLabel className="text-white/60">Select Stream</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              {streamLinks.map((link, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => setCurrentStreamIndex(index)}
                  className={cn(
                    "text-white cursor-pointer",
                    currentStreamIndex === index && "bg-white/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{link.label}</span>
                    {link.region && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        {link.region}
                      </span>
                    )}
                    {link.quality && (
                      <span className="text-xs text-white/50">{link.quality}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Player Type Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="bg-black/70 hover:bg-black/90 text-white border-0"
            >
              <span className="mr-1">{getPlayerConfig(playerType).icon}</span>
              {getPlayerConfig(playerType).label}
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-black/95 border-white/20">
            <DropdownMenuLabel className="text-white/60">Select Player</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {PLAYER_CONFIGS.map((config) => (
              <DropdownMenuItem
                key={config.type}
                onClick={() => setPlayerType(config.type)}
                className={cn(
                  "text-white cursor-pointer",
                  playerType === config.type && "bg-white/20"
                )}
              >
                <div className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <span>{config.icon}</span>
                    {config.label}
                  </span>
                  <span className="text-xs text-white/50">{config.description}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
