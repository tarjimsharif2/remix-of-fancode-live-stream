import { useState } from "react";
import { RefreshCw, AlertCircle, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IframePlayerProps {
  streamUrl: string;
  wrapperUrl?: string;
  title?: string;
  onError?: (error: string) => void;
}

export const IframePlayer = ({
  streamUrl,
  wrapperUrl,
  title = "Live Stream",
  onError,
}: IframePlayerProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  // Build final URL
  const finalUrl = wrapperUrl 
    ? `${wrapperUrl}${encodeURIComponent(streamUrl)}`
    : streamUrl;

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    const errMsg = "Failed to load embed";
    setError(errMsg);
    setIsLoading(false);
    onError?.(errMsg);
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setKey(prev => prev + 1);
  };

  const toggleFullscreen = async () => {
    try {
      const container = document.getElementById('iframe-container');
      if (!container) return;
      
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  return (
    <div id="iframe-container" className="relative w-full h-full bg-black">
      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <p className="text-white mb-4">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Iframe */}
      {!error && (
        <iframe
          key={key}
          src={finalUrl}
          className={cn(
            "w-full h-full border-0",
            isLoading && "invisible"
          )}
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          onLoad={handleLoad}
          onError={handleError}
          title={title}
        />
      )}

    </div>
  );
};
