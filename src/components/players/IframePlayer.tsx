import { useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  // Build final URL
  const finalUrl = wrapperUrl 
    ? `${wrapperUrl}${encodeURIComponent(streamUrl)}`
    : streamUrl;

  const handleError = () => {
    const errMsg = "Failed to load embed";
    setError(errMsg);
    onError?.(errMsg);
  };

  const handleRetry = () => {
    setError(null);
    setKey(prev => prev + 1);
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
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

      {/* Iframe - no loading spinner, loads directly */}
      {!error && (
        <iframe
          key={key}
          src={finalUrl}
          className="absolute inset-0 w-full h-full border-0"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          onError={handleError}
          title={title}
          style={{ margin: 0, padding: 0 }}
        />
      )}
    </div>
  );
};
