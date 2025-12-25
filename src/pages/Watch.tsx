import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Globe, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

const Watch = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Determine region from URL path
  const region: 'BD' | 'IN' = location.pathname.includes('play-bd') ? 'BD' : 'IN';
  
  // Get the full stream URL from query parameter
  const streamUrl = searchParams.get('url') || '';
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showControls, setShowControls] = useState(true);

  const initPlayer = useCallback(async () => {
    if (!playerContainerRef.current || !streamUrl) {
      setError("No stream URL provided");
      setIsLoading(false);
      return;
    }

    // Cleanup previous player
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setQualities([]);
    setCurrentQuality(-1);

    try {
      const Hls = (await import('hls.js')).default;
      
      // Clear container and create video element
      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }
      
      const video = document.createElement('video');
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'contain';
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      playerContainerRef.current?.appendChild(video);

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_event: any, data: any) => {
          setIsLoading(false);
          
          // Extract quality levels
          const levels: QualityLevel[] = data.levels.map((level: any, index: number) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
            label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
          }));
          
          // Sort by height descending
          levels.sort((a, b) => b.height - a.height);
          setQualities(levels);
          
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data);
            setError(`Stream unavailable. This stream may be geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}.`);
            setIsLoading(false);
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          video.play().catch(() => {});
        });
        video.addEventListener('error', () => {
          setError(`Stream unavailable. This stream may be geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}.`);
          setIsLoading(false);
        });
      } else {
        setError('HLS playback is not supported in this browser.');
        setIsLoading(false);
      }

    } catch (err) {
      console.error('Failed to initialize player:', err);
      setError('Failed to load video player. Please try again.');
      setIsLoading(false);
    }
  }, [streamUrl, region]);

  const handleQualityChange = (levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentQuality(levelIndex);
    }
  };

  const handleAutoQuality = () => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = -1; // Auto
      setCurrentQuality(-1);
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initPlayer]);

  // Hide controls after 3 seconds of inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);
    
    // Initial timeout
    timeout = setTimeout(() => setShowControls(false), 3000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  const handleRetry = () => {
    initPlayer();
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return 'Auto';
    const quality = qualities.find(q => q.index === currentQuality);
    return quality?.label || 'Auto';
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/70 text-sm">Connecting to {region} stream...</p>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10 bg-black">
          <div className="bg-destructive/20 rounded-full p-4 mb-4">
            <Globe className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-white font-medium mb-2">Stream Unavailable</p>
          <p className="text-white/60 text-sm mb-6 max-w-md">
            This stream may be geo-restricted or currently offline.
          </p>
          <Button onClick={handleRetry} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : null}

      {/* Quality Selector */}
      {!isLoading && !error && qualities.length > 0 && (
        <div 
          className={cn(
            "absolute top-4 right-4 z-20 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                {getCurrentQualityLabel()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/20 backdrop-blur-sm">
              <DropdownMenuItem 
                onClick={handleAutoQuality}
                className={cn(
                  "text-white hover:bg-white/10 cursor-pointer",
                  currentQuality === -1 && "bg-primary/20"
                )}
              >
                Auto
              </DropdownMenuItem>
              {qualities.map((quality) => (
                <DropdownMenuItem
                  key={quality.index}
                  onClick={() => handleQualityChange(quality.index)}
                  className={cn(
                    "text-white hover:bg-white/10 cursor-pointer",
                    currentQuality === quality.index && "bg-primary/20"
                  )}
                >
                  {quality.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Video Player Container - Fullscreen */}
      <div 
        ref={playerContainerRef} 
        className={cn(
          "w-full h-full",
          (isLoading || error) && "invisible"
        )}
      />
    </div>
  );
};

export default Watch;