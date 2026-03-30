import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, Maximize2, Minimize2, Volume2, VolumeX, Play, Pause, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  streamUrl: string;
  matchName: string;
  onClose: () => void;
}

export const VideoPlayer = ({ streamUrl, matchName, onClose }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const initPlayer = () => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    // Cleanup previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setError(null);

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

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(console.error);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Stream link may have expired
            setError("Stream unavailable. The live stream link may have expired. Try refreshing or watch on Fancode directly.");
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // Try to recover from media errors
            hls.recoverMediaError();
          } else {
            setError("Failed to load stream. Please try again.");
          }
          setIsLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        video.play().then(() => setIsPlaying(true)).catch(console.error);
      });
      video.addEventListener('error', () => {
        setError("Stream unavailable. The live stream link may have expired.");
        setIsLoading(false);
      });
    } else {
      setError("HLS streaming not supported in this browser");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [streamUrl, retryCount]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  const openFancode = () => {
    window.open('https://www.fancode.com', '_blank');
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className={cn(
          "relative w-full max-w-5xl bg-card rounded-xl overflow-hidden shadow-2xl",
          isFullscreen && "max-w-none rounded-none"
        )}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background/90 to-transparent p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground truncate">{matchName}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-foreground hover:bg-secondary"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Video */}
        <div className="relative aspect-video bg-secondary">
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <div className="bg-destructive/10 rounded-full p-4 mb-4">
                <X className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-foreground font-medium mb-2">Stream Unavailable</p>
              <p className="text-muted-foreground text-sm mb-6 max-w-md">
                {error}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleRetry} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                <Button onClick={openFancode} variant="default">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Watch on Fancode
                </Button>
                <Button onClick={onClose} variant="secondary">
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full"
              playsInline
              onClick={togglePlay}
            />
          )}
        </div>

        {/* Controls */}
        {!error && !isLoading && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background/90 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePlay}
                  className="text-foreground hover:bg-secondary"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-foreground hover:bg-secondary"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
                <span className="text-xs text-muted-foreground ml-2">LIVE</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-foreground hover:bg-secondary"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
