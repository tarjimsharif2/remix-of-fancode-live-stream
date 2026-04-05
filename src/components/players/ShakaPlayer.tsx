import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";

declare global {
  interface Window {
    shaka: any;
  }
}

interface ShakaPlayerProps {
  streamUrl: string;
  title?: string;
}

function parseShakaUrl(raw: string): {
  url: string;
  drm: Record<string, any> | null;
} {
  const parts = raw.split("|");
  const url = parts[0].trim();

  if (parts.length < 2) {
    return { url, drm: null };
  }

  const params = new URLSearchParams(parts[1]);
  const drmScheme = params.get("drmScheme");
  const drmLicense = params.get("drmLicense");

  if (drmScheme === "clearkey" && drmLicense) {
    const [keyId, key] = drmLicense.split(":");
    if (keyId && key) {
      return {
        url,
        drm: {
          clearkey: {
            keySystem: "org.w3.clearkey",
            licenseServerUri: "",
          },
        },
      };
    }
  }

  return { url, drm: null };
}

function buildDrmConfig(raw: string): Record<string, any> {
  const parts = raw.split("|");
  if (parts.length < 2) return {};

  const params = new URLSearchParams(parts[1]);
  const drmScheme = params.get("drmScheme");
  const drmLicense = params.get("drmLicense");

  if (drmScheme === "clearkey" && drmLicense) {
    const [keyId, key] = drmLicense.split(":");
    if (keyId && key) {
      return {
        drm: {
          clearKeys: {
            [keyId]: key,
          },
        },
      };
    }
  }

  return {};
}

export const ShakaPlayer = ({ streamUrl, title }: ShakaPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initPlayer = useCallback(async () => {
    const shaka = window.shaka;
    if (!shaka) {
      setError("Shaka Player library not loaded");
      setIsLoading(false);
      return;
    }

    shaka.polyfill.installAll();

    if (!shaka.Player.isBrowserSupported()) {
      setError("Your browser does not support this player");
      setIsLoading(false);
      return;
    }

    // Cleanup previous instance
    if (playerRef.current) {
      try {
        await playerRef.current.destroy();
      } catch {}
      playerRef.current = null;
    }

    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    setError(null);
    setIsLoading(true);

    try {
      const player = new shaka.Player();
      await player.attach(video);
      playerRef.current = player;

      // Setup UI
      const ui = new shaka.ui.Overlay(player, container, video);
      ui.configure({
        controlPanelElements: [
          "play_pause",
          "time_and_duration",
          "mute",
          "volume",
          "spacer",
          "language",
          "captions",
          "picture_in_picture",
          "quality",
          "fullscreen",
        ],
        seekBarColors: {
          base: "rgba(255, 255, 255, 0.3)",
          buffered: "rgba(255, 255, 255, 0.5)",
          played: "hsl(var(--primary))",
        },
      });

      // Parse URL and DRM
      const { url } = parseShakaUrl(streamUrl);
      const drmConfig = buildDrmConfig(streamUrl);

      player.configure({
        ...drmConfig,
        streaming: {
          lowLatencyMode: true,
          bufferingGoal: 15,
          rebufferingGoal: 2,
          bufferBehind: 15,
          retryParameters: {
            timeout: 10000,
            maxAttempts: 5,
            baseDelay: 300,
            backoffFactor: 1.2,
          },
        },
        manifest: {
          retryParameters: {
            timeout: 8000,
            maxAttempts: 3,
          },
        },
      });

      player.addEventListener("error", (event: any) => {
        console.error("Shaka Player Error:", event.detail);
        setError("Stream playback error");
        setIsLoading(false);
      });

      await player.load(url);

      // ✅ Autoplay fix: muted দিয়ে play করে সাথে সাথে unmute
      video.muted = true;
      try {
        await video.play();
        video.muted = false;
      } catch {
        // Unmute করেও না হলে muted রেখেই চালু রাখো
        video.muted = true;
        try {
          await video.play();
        } catch (playErr) {
          console.warn("Autoplay blocked:", playErr);
        }
      }

      setIsLoading(false);
      console.log(`✅ Shaka loaded: ${title || url}`);
    } catch (err: any) {
      console.error("Shaka init error:", err);
      setError(err?.message || "Failed to load stream");
      setIsLoading(false);
    }
  }, [streamUrl, title]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Logo overlay */}
      <img
        src="https://i.ibb.co/Q3rp8ZXs/20260203-180035-0000.png"
        alt=""
        className="absolute top-2 right-2 z-[100] w-16 sm:w-20 opacity-80 pointer-events-none"
        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
      />

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80">
          <div className="text-center text-white max-w-sm px-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <p className="text-sm mb-4">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={initPlayer}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.history.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Shaka container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full shaka-video-container"
        data-shaka-player
      >
        <video
          ref={videoRef}
          autoPlay
          muted         // ✅ Browser policy মানতে muted দিয়ে শুরু
          playsInline
          preload="metadata"
          poster="https://cdn2.eplayhd.com/icon/eplaylogo.webp"
          className="w-full h-full bg-black object-contain"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
};
