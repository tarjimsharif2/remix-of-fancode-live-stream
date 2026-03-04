import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  RefreshCw,
  AlertCircle,
  RectangleHorizontal,
  Scan,
  Move,
} from "lucide-react";
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
  height: number;
  label: string;
}

interface HlsJsPlayerProps {
  streamUrl: string;
  title?: string;
  onError?: (error: string) => void;
  onReady?: () => void;
  useProxy?: boolean;
  proxyConfig?: {
    referer?: string;
    origin?: string;
  };
}

export const HlsJsPlayer = ({
  streamUrl,
  title = "Live Stream",
  onError,
  onReady,
  useProxy = false,
  proxyConfig,
}: HlsJsPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_AUTO_RETRIES = 2;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [displayMode, setDisplayMode] = useState<'fit' | 'fill' | 'stretch'>(() => {
    const saved = localStorage.getItem('videoDisplayMode');
    return (saved as 'fit' | 'fill' | 'stretch') || 'stretch';
  });

  const getProxyUrl = useCallback((url: string) => {
    if (!useProxy) return url;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);
    if (proxyConfig?.referer) proxyUrl.searchParams.set('referer', proxyConfig.referer);
    if (proxyConfig?.origin) proxyUrl.searchParams.set('origin', proxyConfig.origin);
    return proxyUrl.toString();
  }, [useProxy, proxyConfig]);

  const initPlayer = useCallback(() => {
    if (!streamUrl || !videoRef.current) return;

    setIsLoading(true);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const finalUrl = getProxyUrl(streamUrl);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 5,
        maxMaxBufferLength: 15,
        maxBufferSize: 0,
        maxBufferHole: 0.5,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        liveDurationInfinity: true,
        startLevel: 0,
        capLevelToPlayerSize: true,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 8000,
        fragLoadingTimeOut: 10000,
        startFragPrefetch: true,
        testBandwidth: false,
        abrEwmaDefaultEstimate: 500000,
      });

      hlsRef.current = hls;
      hls.loadSource(finalUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        retryCountRef.current = 0;
        setIsLoading(false);
        video.muted = false;
        video.play().catch(console.error);
        setIsPlaying(true);
        onReady?.();

        if (hls.levels && hls.levels.length > 0) {
          const qualityList: QualityLevel[] = hls.levels
            .map((lvl, index) => ({
              id: index,
              height: lvl.height || 0,
              label: lvl.height ? `${lvl.height}p` : `${Math.round((lvl.bitrate || 0) / 1000)}kbps`,
            }))
            .filter((q) => q.height > 0)
            .sort((a, b) => b.height - a.height);
          setQualities(qualityList);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          const errMsg = "Stream error. Please try again.";
          setError(errMsg);
          onError?.(errMsg);
          setIsLoading(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = finalUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        video.play().catch(console.error);
        setIsPlaying(true);
        onReady?.();
      });
      video.addEventListener("error", () => {
        const errMsg = "Stream error.";
        setError(errMsg);
        onError?.(errMsg);
        setIsLoading(false);
      });
    } else {
      setError("HLS not supported");
      setIsLoading(false);
    }
  }, [streamUrl, getProxyUrl, onError, onReady]);

  useEffect(() => {
    if (streamUrl) {
      initPlayer();
    }
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, initPlayer]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const handleQualityChange = (levelId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
      setCurrentQuality(levelId);
    }
  };

  const handleAutoQuality = () => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = -1;
      setCurrentQuality(-1);
    }
  };

  const handleDisplayModeChange = (mode: 'fit' | 'fill' | 'stretch') => {
    setDisplayMode(mode);
    localStorage.setItem('videoDisplayMode', mode);
  };

  const getDisplayModeClass = () => {
    switch (displayMode) {
      case 'fit': return 'object-contain';
      case 'fill': return 'object-cover';
      case 'stretch': return 'object-fill';
      default: return 'object-fill';
    }
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black"
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none bg-black">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin" />
            <div className="absolute inset-2 border-4 border-transparent border-b-primary/60 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
          </div>
          <p className="text-white/60 text-sm animate-pulse">Connecting...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl mb-2">{error}</h2>
            <Button onClick={initPlayer} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        className={cn("w-full h-full", getDisplayModeClass())}
        playsInline
        muted={isMuted}
        autoPlay
      />

      {/* Controls */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg line-clamp-1">{title}</h1>
          </div>
          <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full animate-pulse">
            LIVE
          </span>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white">
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white">
            {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </Button>

          <div className="flex-1" />

          {/* Display Mode */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white">
                {displayMode === 'fit' ? <RectangleHorizontal className="w-5 h-5" /> :
                 displayMode === 'fill' ? <Scan className="w-5 h-5" /> : <Move className="w-5 h-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
              <DropdownMenuItem onClick={() => handleDisplayModeChange('fit')} className={cn("text-white", displayMode === 'fit' && "bg-white/20")}>
                <RectangleHorizontal className="w-4 h-4 mr-2" /> Fit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDisplayModeChange('fill')} className={cn("text-white", displayMode === 'fill' && "bg-white/20")}>
                <Scan className="w-4 h-4 mr-2" /> Fill
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDisplayModeChange('stretch')} className={cn("text-white", displayMode === 'stretch' && "bg-white/20")}>
                <Move className="w-4 h-4 mr-2" /> Stretch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quality */}
          {qualities.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-black/90 border-white/10">
                <DropdownMenuItem onClick={handleAutoQuality} className={cn("text-white", currentQuality === -1 && "bg-white/20")}>
                  Auto
                </DropdownMenuItem>
                {qualities.map((q) => (
                  <DropdownMenuItem key={q.id} onClick={() => handleQualityChange(q.id)} className={cn("text-white", currentQuality === q.id && "bg-white/20")}>
                    {q.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};
