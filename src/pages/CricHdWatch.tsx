import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import Hls from "hls.js";
import { supabase } from "@/integrations/supabase/client";
import { CricHdChannel, CricHdResponse } from "@/types/crichd";
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

const CricHdWatch = () => {
  const [searchParams] = useSearchParams();

  const channelId = searchParams.get("id");

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [channel, setChannel] = useState<CricHdChannel | null>(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);

  // Fetch channel data by ID
  useEffect(() => {
    const fetchChannel = async () => {
      if (!channelId) {
        setError("No channel ID provided");
        setChannelLoading(false);
        return;
      }

      try {
        const { data, error: fnError } = await supabase.functions.invoke<CricHdResponse>('fetch-crichd-channels');

        if (fnError) {
          throw new Error(fnError.message);
        }

        if (data?.success && data.channels) {
          const foundChannel = data.channels.find(ch => ch.id === channelId);
          if (foundChannel) {
            setChannel(foundChannel);
          } else {
            setError("Channel not found");
          }
        } else {
          setError(data?.error || "Failed to fetch channels");
        }
      } catch (err) {
        console.error("Error fetching channel:", err);
        setError(err instanceof Error ? err.message : "Failed to load channel");
      } finally {
        setChannelLoading(false);
      }
    };

    fetchChannel();
  }, [channelId]);

  const lockLandscape = useCallback(async () => {
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (err) {
      console.log('Could not lock orientation:', err);
    }
  }, []);

  const unlockOrientation = useCallback(() => {
    try {
      if (screen.orientation && 'unlock' in screen.orientation) {
        screen.orientation.unlock();
      }
    } catch (err) {
      console.log('Could not unlock orientation:', err);
    }
  }, []);

  // Build proxy URL for the stream
  const getProxyUrl = useCallback((url: string) => {
    if (!channel) return url;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const proxyUrl = new URL(`${supabaseUrl}/functions/v1/stream-proxy`);
    proxyUrl.searchParams.set('url', url);
    if (channel.referer) proxyUrl.searchParams.set('referer', channel.referer);
    if (channel.origin) proxyUrl.searchParams.set('origin', channel.origin);
    return proxyUrl.toString();
  }, [channel]);

  const initPlayer = useCallback(() => {
    if (!channel?.link || !videoRef.current) return;

    setIsLoading(true);
    setError(null);

    // Cleanup existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;

    // Use proxy URL instead of direct stream URL
    const proxiedStreamUrl = getProxyUrl(channel.link);
    console.log('Using proxied stream URL:', proxiedStreamUrl);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hlsRef.current = hls;

      hls.loadSource(proxiedStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.muted = false; // Start unmuted
        video.play().catch(console.error);
        setIsPlaying(true);

        // Extract quality levels
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
          console.error("HLS fatal error:", data);
          setError("Stream error. Please try again.");
          setIsLoading(false);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari) - use proxy URL
      video.src = proxiedStreamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLoading(false);
        video.muted = false; // Start unmuted
        video.play().catch(console.error);
        setIsPlaying(true);
      });
      video.addEventListener("error", () => {
        setError("Stream error. Please try again.");
        setIsLoading(false);
      });
    } else {
      setError("HLS not supported in this browser");
      setIsLoading(false);
    }
  }, [channel, getProxyUrl]);

  useEffect(() => {
    if (channel) {
      initPlayer();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      unlockOrientation();
    };
  }, [channel, initPlayer, unlockOrientation]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      if (isNowFullscreen) {
        lockLandscape();
      } else {
        unlockOrientation();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, [lockLandscape, unlockOrientation]);

  const handleRetry = () => {
    initPlayer();
  };

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
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleQualityChange = (levelId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId;
      hlsRef.current.nextLevel = levelId;
      hlsRef.current.loadLevel = levelId;
      setCurrentQuality(levelId);
    }
  };

  const handleAutoQuality = () => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = -1;
      hlsRef.current.nextLevel = -1;
      hlsRef.current.loadLevel = -1;
      setCurrentQuality(-1);
    }
  };

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) return "Auto";
    const quality = qualities.find((q) => q.id === currentQuality);
    return quality?.label || "Auto";
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };


  // Loading channel data
  if (channelLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-white">Loading channel...</p>
        </div>
      </div>
    );
  }

  if (!channelId || !channel) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl mb-2">{error || "Invalid Channel"}</h2>
          <p className="text-gray-400 mb-4">Channel not found or invalid ID</p>
          <Button onClick={() => window.history.back()} variant="outline">
            Back to Channels
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onMouseMove={showControlsTemporarily}
      onTouchStart={showControlsTemporarily}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-white">Loading stream...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !channelLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl mb-2">{error}</h2>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleRetry} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Video player - contained to show full content, responsive on all devices */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        playsInline
        muted={isMuted}
        autoPlay
      />

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center gap-4">
          <div className="flex-1">
            <h1 className="text-white font-semibold text-lg line-clamp-1">
              {channel.name}
            </h1>
          </div>
          <span className="px-2 py-1 text-xs font-bold bg-red-600 text-white rounded-full animate-pulse">
            LIVE
          </span>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={togglePlay}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </Button>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {qualities.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-white/20 gap-1"
                    >
                      <Settings className="w-4 h-4" />
                      {getCurrentQualityLabel()}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-black border-white/20 z-50 max-h-[calc(100vh-5rem)] overflow-y-auto"
                  >
                    <DropdownMenuItem
                      onClick={handleAutoQuality}
                      className={cn(
                        "text-white hover:bg-white/20 cursor-pointer",
                        currentQuality === -1 && "bg-primary/30"
                      )}
                    >
                      Auto
                    </DropdownMenuItem>
                    {qualities.map((quality) => (
                      <DropdownMenuItem
                        key={quality.id}
                        onClick={() => handleQualityChange(quality.id)}
                        className={cn(
                          "text-white hover:bg-white/20 cursor-pointer",
                          currentQuality === quality.id && "bg-primary/30"
                        )}
                      >
                        {quality.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize className="w-6 h-6" />
                ) : (
                  <Maximize className="w-6 h-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CricHdWatch;
