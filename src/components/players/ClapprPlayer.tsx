import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, Settings, PictureInPicture2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface QualityLevel {
  id: number;
  label: string;
  height: number;
}

interface ClapprPlayerProps {
  streamUrl: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  autoRetry?: boolean;
}

const AUTO_RETRY_INTERVAL = 10000;

export const ClapprPlayer = ({ 
  streamUrl, 
  onError, 
  onReady,
  autoRetry = true 
}: ClapprPlayerProps) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const stopAutoRetry = useCallback(() => {
    if (retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
    }
  }, []);

  const startAutoRetry = useCallback(() => {
    if (!autoRetry) return;
    stopAutoRetry();
    retryIntervalRef.current = setInterval(() => {
      setRetryCount(prev => prev + 1);
    }, AUTO_RETRY_INTERVAL);
  }, [stopAutoRetry, autoRetry]);

  const initPlayer = useCallback(async () => {
    if (!playerContainerRef.current || !streamUrl) return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setQualities([]);
    setCurrentQuality(-1);
    stopAutoRetry();

    try {
      const Clappr = await import('@clappr/player');
      const HlsjsPlayback = await import('@clappr/hlsjs-playback');

      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }

      setIsPiPSupported('pictureInPictureEnabled' in document && (document as any).pictureInPictureEnabled);

      const player = new Clappr.default.Player({
        parent: playerContainerRef.current,
        source: streamUrl,
        plugins: [HlsjsPlayback.default],
        playback: {
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 12,
            maxMaxBufferLength: 30,
            startLevel: -1,
            fragLoadingTimeOut: 7000,
            fragLoadingMaxRetry: 3,
          }
        },
        autoPlay: true,
        mute: false,
        height: '100%',
        width: '100%',
        events: {
          onError: () => {
            const errMsg = 'The match has not started yet or the stream is unavailable.';
            setError(errMsg);
            onError?.(errMsg);
            setIsLoading(false);
            startAutoRetry();
          },
          onPlay: () => {
            setIsLoading(false);
            setRetryCount(0);
            stopAutoRetry();
            onReady?.();
          },
          onReady: () => {
            setIsLoading(false);
            try {
              const playback = player.core?.getCurrentPlayback?.();
              const hls = (playback as any)?._hls || (playback as any)?.hls;
              if (hls && Array.isArray(hls.levels)) {
                const qualityList: QualityLevel[] = hls.levels
                  .map((lvl: any, index: number) => ({
                    id: index,
                    height: lvl.height || 0,
                    label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
                  }))
                  .filter((q: QualityLevel) => q.height > 0)
                  .sort((a: QualityLevel, b: QualityLevel) => b.height - a.height);
                setQualities(qualityList);
              }
            } catch {}
          }
        }
      });

      playerRef.current = player;

      player.on(Clappr.default.Events.PLAYER_ERROR, () => {
        setError('Stream unavailable.');
        setIsLoading(false);
        startAutoRetry();
      });

    } catch (err) {
      console.error('Failed to initialize Clappr:', err);
      setError('Failed to load video player.');
      setIsLoading(false);
      startAutoRetry();
    }
  }, [streamUrl, stopAutoRetry, startAutoRetry, onError, onReady]);

  useEffect(() => {
    if (streamUrl) {
      initPlayer();
    }
    return () => {
      stopAutoRetry();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamUrl, initPlayer, stopAutoRetry]);

  useEffect(() => {
    if (retryCount > 0) {
      initPlayer();
    }
  }, [retryCount]);

  const handleQualityChange = (levelId: number) => {
    try {
      const playback = playerRef.current?.core?.getCurrentPlayback?.();
      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = levelId;
        setCurrentQuality(levelId);
      }
    } catch {}
  };

  const handleAutoQuality = () => {
    try {
      const playback = playerRef.current?.core?.getCurrentPlayback?.();
      const hls = (playback as any)?._hls || (playback as any)?.hls;
      if (hls) {
        hls.currentLevel = -1;
        setCurrentQuality(-1);
      }
    } catch {}
  };

  const togglePiP = async () => {
    try {
      const videoElement = playerRef.current?.core?.getCurrentPlayback?.()?.el;
      if (!videoElement) return;
      if (isPiPActive) {
        await (document as any).exitPictureInPicture();
      } else {
        await videoElement.requestPictureInPicture();
      }
      setIsPiPActive(!isPiPActive);
    } catch {}
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* Controls */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-50 p-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-2">
          {isPiPSupported && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white"
              onClick={togglePiP}
            >
              <PictureInPicture2 className={cn("w-5 h-5", isPiPActive && "text-green-400")} />
            </Button>
          )}
        </div>

        {qualities.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white">
                <Settings className="w-5 h-5 mr-1" />
                {currentQuality === -1 ? 'Auto' : qualities.find(q => q.id === currentQuality)?.label || 'Quality'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/20">
              <DropdownMenuItem
                onClick={handleAutoQuality}
                className={cn("text-white", currentQuality === -1 && "bg-white/20")}
              >
                Auto
              </DropdownMenuItem>
              {qualities.map((quality) => (
                <DropdownMenuItem
                  key={quality.id}
                  onClick={() => handleQualityChange(quality.id)}
                  className={cn("text-white", currentQuality === quality.id && "bg-white/20")}
                >
                  {quality.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/70 text-sm">Loading stream...</p>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-40">
          <p className="text-white/70 text-center mb-4">{error}</p>
          <Button
            onClick={() => {
              setRetryCount(prev => prev + 1);
              setError(null);
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
          {autoRetry && (
            <p className="text-white/40 text-xs mt-4">
              Auto-retry in {AUTO_RETRY_INTERVAL / 1000}s...
            </p>
          )}
        </div>
      )}

      {/* Player */}
      <div
        ref={playerContainerRef}
        className="w-full h-full"
        onClick={() => setShowControls(!showControls)}
      />
    </div>
  );
};
