import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Hls from "hls.js";
import { ArrowLeft, Maximize2, Minimize2, Volume2, VolumeX, Play, Pause, RefreshCw, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Watch = () => {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const region = searchParams.get('region') as 'BD' | 'IN' || 'BD';
  const streamUrl = searchParams.get('stream') || '';
  const matchName = searchParams.get('match') || 'Live Match';
  
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
    if (!video || !streamUrl) {
      setError("No stream URL provided");
      setIsLoading(false);
      return;
    }

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
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000,
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
            setError(`Stream unavailable in your region. This stream is geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}. Try using a VPN or the other region's stream.`);
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
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
        setError(`Stream unavailable. This stream may be geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}.`);
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

  const switchRegion = () => {
    // Switch to the other region
    const newRegion = region === 'BD' ? 'IN' : 'BD';
    const newStream = region === 'BD' 
      ? streamUrl.replace('bd-mc-fdlive', 'in-mc-fdlive')
      : streamUrl.replace('in-mc-fdlive', 'bd-mc-fdlive');
    
    navigate(`/watch/${matchId}?region=${newRegion}&stream=${encodeURIComponent(newStream)}&match=${encodeURIComponent(matchName)}`);
  };

  const openFancode = () => {
    window.open('https://www.fancode.com', '_blank');
  };

  const goBack = () => {
    navigate('/');
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
    <div 
      ref={containerRef}
      className={cn(
        "min-h-screen bg-background flex flex-col",
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Header */}
      <header className={cn(
        "bg-card/80 backdrop-blur-sm border-b border-border p-4 flex items-center gap-4",
        isFullscreen && "absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background/90 to-transparent border-none"
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          className="text-foreground hover:bg-secondary"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground truncate">{matchName}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {region === 'BD' ? 'Bangladesh' : 'India'} Stream
            </span>
            {!error && !isLoading && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={switchRegion}
          className="hidden sm:flex"
        >
          <Globe className="w-4 h-4 mr-2" />
          Switch to {region === 'BD' ? 'IN' : 'BD'}
        </Button>
      </header>

      {/* Video Container */}
      <div className="flex-1 flex items-center justify-center bg-secondary p-4">
        <div className="relative w-full max-w-6xl aspect-video bg-card rounded-xl overflow-hidden shadow-2xl">
          {isLoading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground text-sm">Connecting to {region} stream...</p>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <div className="bg-destructive/10 rounded-full p-4 mb-4">
                <Globe className="w-8 h-8 text-destructive" />
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
                <Button onClick={switchRegion} variant="secondary">
                  <Globe className="w-4 h-4 mr-2" />
                  Try {region === 'BD' ? 'India' : 'Bangladesh'} Stream
                </Button>
                <Button onClick={openFancode} variant="default">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Watch on Fancode
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                💡 Tip: Use a VPN to access geo-restricted streams from anywhere
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full"
              playsInline
              onClick={togglePlay}
            />
          )}

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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={switchRegion}
                    className="text-foreground hover:bg-secondary sm:hidden"
                  >
                    <Globe className="w-4 h-4 mr-1" />
                    {region === 'BD' ? 'IN' : 'BD'}
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
    </div>
  );
};

export default Watch;
