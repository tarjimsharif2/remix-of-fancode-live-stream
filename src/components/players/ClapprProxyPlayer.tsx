import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

declare var Clappr: any;

interface ClapprProxyPlayerProps {
  streamUrl: string;
  poster?: string;
  referer?: string;
  origin?: string;
  userAgent?: string;
  cookie?: string;
  customHeaders?: Record<string, string>;
  onError?: (error: string) => void;
  onReady?: () => void;
  onStuck?: () => void;
}

export const ClapprProxyPlayer = ({ 
  streamUrl, 
  poster, 
  referer, 
  origin, 
  userAgent,
  cookie,
  customHeaders,
  onError,
  onReady,
  onStuck 
}: ClapprProxyPlayerProps) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStretched, setIsStretched] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Clappr from CDN if not already loaded
  useEffect(() => {
    if (typeof Clappr !== 'undefined') {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@clappr/player@latest/dist/clappr.min.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      setError('Failed to load player script.');
      setIsLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove script on unmount - it can be reused
    };
  }, []);

  const initPlayer = useCallback(() => {
    if (!playerContainerRef.current || typeof Clappr === 'undefined') return;

    // Cleanup existing player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    // Clear container
    const container = playerContainerRef.current;
    container.innerHTML = '';

    setError(null);
    setIsLoading(true);

    // Build proxied URL using the edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    let proxiedSrc = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}&t=${Date.now()}`;
    if (referer) proxiedSrc += `&referer=${encodeURIComponent(referer)}`;
    if (origin) proxiedSrc += `&origin=${encodeURIComponent(origin)}`;
    if (userAgent) proxiedSrc += `&user_agent=${encodeURIComponent(userAgent)}`;
    if (cookie) proxiedSrc += `&cookie=${encodeURIComponent(cookie)}`;
    if (customHeaders && Object.keys(customHeaders).length > 0) {
      proxiedSrc += `&custom_headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
    }

    try {
      const player = new Clappr.Player({
        source: proxiedSrc,
        parent: container,
        autoPlay: true,
        muted: true,
        width: "100%",
        height: "100%",
        mimeType: "application/x-mpegURL",
        playback: {
          playInline: true,
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: false,
            debug: false,
            liveSyncDurationCount: 7,
            liveMaxLatencyDurationCount: 12,
            maxLiveSyncPlaybackRate: 1.5,
            maxBufferLength: 60,
            maxMaxBufferLength: 120,
            maxBufferSize: 60 * 1000 * 1000,
            fragLoadingRetryDelay: 1000,
            fragLoadingMaxRetry: 10,
            manifestLoadingRetryDelay: 1000,
            manifestLoadingMaxRetry: 10,
            levelLoadingRetryDelay: 1000,
            levelLoadingMaxRetry: 10,
            xhrSetup: (xhr: XMLHttpRequest) => {
              xhr.withCredentials = false;
            }
          }
        },
        events: {
          onReady: () => { setIsLoading(false); setError(null); onReady?.(); },
          onPlay: () => { setIsLoading(false); setError(null); },
          onBuffer: () => setIsLoading(true),
          onBufferFull: () => setIsLoading(false),
          onError: (err: any) => {
            console.error('ClapprProxy Error:', err);
            const errMsg = 'Playback failed. The stream might be restricted or the proxy is being blocked.';
            setError(errMsg);
            setIsLoading(false);
            onError?.(errMsg);
            if (err?.code === 'PLAYBACK_ERROR') {
              setTimeout(() => initPlayer(), 3000);
            }
            onStuck?.();
          }
        }
      });
      playerRef.current = player;
    } catch (err) {
      console.error('ClapprProxy init error:', err);
      setError('Could not initialize player.');
      setIsLoading(false);
    }
  }, [streamUrl, referer, origin, userAgent, cookie, customHeaders, onStuck, onError, onReady]);

  // Initialize when script is loaded
  useEffect(() => {
    if (scriptLoaded) {
      initPlayer();
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [scriptLoaded, initPlayer]);

  // Stuck detection
  useEffect(() => {
    let lastTime = 0;
    let stuckCount = 0;

    const checkStuck = setInterval(() => {
      const video = playerContainerRef.current?.querySelector('video');
      if (video && !video.paused && !isLoading && video.readyState >= 3) {
        if (video.currentTime === lastTime) {
          stuckCount++;
          if (stuckCount >= 20) {
            console.warn('Stream stuck detected. Reloading...');
            onStuck?.();
            initPlayer();
            stuckCount = 0;
          }
        } else {
          lastTime = video.currentTime;
          stuckCount = 0;
        }
      }
    }, 1000);

    return () => clearInterval(checkStuck);
  }, [initPlayer, isLoading, onStuck]);

  const containerId = useRef(`cp-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      <div 
        id={`clappr-proxy-container-${containerId}`}
        ref={(el) => {
          (playerContainerRef as any).current = el;
          if (el) el.id = containerId;
        }}
        className={cn("w-full h-full", isLoading && "opacity-0")}
      />

      {/* Loading */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black p-8 text-center z-20">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <h3 className="text-lg font-bold text-foreground mb-2">Transmission Error</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={initPlayer} size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(streamUrl, '_blank')}>
              Open Link
            </Button>
          </div>
        </div>
      )}

      <style>{`
        #clappr-proxy-container-${containerId} [data-player] { width: 100% !important; height: 100% !important; }
        #clappr-proxy-container-${containerId} video {
          width: 100% !important;
          height: 100% !important;
          object-fit: ${isStretched ? 'fill' : 'contain'} !important;
        }
        .clappr-watermark { display: none !important; }
      `}</style>
    </div>
  );
};
