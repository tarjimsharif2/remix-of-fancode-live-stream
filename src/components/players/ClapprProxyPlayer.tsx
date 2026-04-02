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

const CLAPPR_PROXY_LOGO_URL = 'https://i.ibb.co/Q3rp8ZXs/20260203-180035-0000.png';

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
  onStuck,
}: ClapprProxyPlayerProps) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStretched] = useState(true);
  const [scriptLoaded, setScriptLoaded] = useState(false);

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
  }, []);

  // ✅ নতুন ফাংশন: unmuted play try করে, fail হলে muted চালু করে তারপর unmute
  const tryAutoplayWithUnmute = useCallback(() => {
    const player = playerRef.current;
    const video = playerContainerRef.current?.querySelector('video') as HTMLVideoElement | null;

    if (!video) return;

    video.muted = false;
    video.volume = 1;
    video.playsInline = true;
    video.autoplay = true;

    const playPromise = video.play();

    if (playPromise) {
      playPromise
        .then(() => {
          // সফল! Clappr কেও unmute করো
          try {
            player?.configure?.({ mute: false });
            player?.unmute?.();
            player?.setVolume?.(100);
          } catch {}
        })
        .catch(() => {
          // Browser block করলে — muted দিয়ে চালু করো
          video.muted = true;
          video.play()
            .then(() => {
              // muted চললে ৫০০ms পর unmute try
              setTimeout(() => {
                video.muted = false;
                video.volume = 1;
                try {
                  player?.configure?.({ mute: false });
                  player?.unmute?.();
                  player?.setVolume?.(100);
                } catch {}
              }, 500);
            })
            .catch(() => {});
        });
    }
  }, []);

  // ✅ Click/tap এ unmute (fallback for strict browsers like Safari iOS)
  const tryUnmuteFromGesture = useCallback(() => {
    const player = playerRef.current;
    const video = playerContainerRef.current?.querySelector('video') as HTMLVideoElement | null;

    try {
      player?.configure?.({ mute: false });
      player?.unmute?.();
      player?.setVolume?.(100);
    } catch (err) {
      console.warn('ClapprProxy unmute failed:', err);
    }

    if (video) {
      video.muted = false;
      video.volume = 1;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }
  }, []);

  const initPlayer = useCallback(() => {
    if (!playerContainerRef.current || typeof Clappr === 'undefined') return;

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    const container = playerContainerRef.current;
    container.innerHTML = '';

    setError(null);
    setIsLoading(true);

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
        poster,
        autoPlay: true,
        mute: false, // ✅ শুরু থেকেই unmuted রাখো
        width: '100%',
        height: '100%',
        mimeType: 'application/x-mpegURL',
        disableVideoTagContextMenu: true,
        playback: {
          playInline: true,
          recycleVideo: true,
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
            },
          },
        },
        events: {
          onReady: () => {
            setIsLoading(false);
            setError(null);
            onReady?.();
            // ✅ tryAutoplayWithUnmute ব্যবহার করো
            requestAnimationFrame(() => {
              tryAutoplayWithUnmute();
            });
          },
          onPlay: () => {
            setIsLoading(false);
            setError(null);
            // ✅ play শুরু হলেও unmute enforce করো
            tryAutoplayWithUnmute();
          },
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
          },
        },
      });

      playerRef.current = player;
    } catch (err) {
      console.error('ClapprProxy init error:', err);
      setError('Could not initialize player.');
      setIsLoading(false);
    }
  }, [streamUrl, referer, origin, userAgent, cookie, customHeaders, poster, onError, onReady, onStuck, tryAutoplayWithUnmute]);

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

  useEffect(() => {
    let lastTime = 0;
    let stuckCount = 0;

    const checkStuck = setInterval(() => {
      const video = playerContainerRef.current?.querySelector('video');
      if (video && !video.paused && !isLoading && video.readyState >= 3) {
        if (video.currentTime === lastTime) {
          stuckCount += 1;
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
    <div
      className="relative w-full h-full bg-black overflow-hidden"
      onPointerUpCapture={tryUnmuteFromGesture}
    >
      <div
        id={`clappr-proxy-container-${containerId}`}
        ref={(el) => {
          playerContainerRef.current = el;
          if (el) el.id = containerId;
        }}
        className={cn('w-full h-full', isLoading && 'opacity-0')}
      />

      {!error && (
        <img
          src={CLAPPR_PROXY_LOGO_URL}
          alt="Player logo"
          className="pointer-events-none absolute right-3 top-3 z-30 w-14 select-none sm:w-16"
          decoding="async"
          loading="eager"
        />
      )}

      {isLoading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black p-8 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
          <h3 className="mb-2 text-lg font-bold text-foreground">Transmission Error</h3>
          <p className="mb-6 max-w-xs text-sm text-muted-foreground">{error}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={initPlayer} size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
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
      `}</style>
    </div>
  );
};
