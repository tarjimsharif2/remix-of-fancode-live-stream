import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, Maximize2, Minimize2, Volume2, VolumeX, Play, Pause } from "lucide-react";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let hls: Hls | null = null;

    const initPlayer = () => {
      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(console.error);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          console.error("HLS Error:", data);
          if (data.fatal) {
            setError("Failed to load stream. Please try again.");
            setIsLoading(false);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          video.play().then(() => setIsPlaying(true)).catch(console.error);
        });
      } else {
        setError("HLS streaming not supported in this browser");
        setIsLoading(false);
      }
    };

    initPlayer();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [streamUrl]);

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
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={onClose}>Close Player</Button>
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
        {!error && (
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
