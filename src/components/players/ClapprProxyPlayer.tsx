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
  const logoRef = useRef<HTMLImageElement>(null);
  const logoOriginalParentRef = useRef<HTMLElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const userPausedRef = useRef(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const logo = logoRef.current;
      if (!logo) return;
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement;
      if (fsElement) {
        logoOriginalParentRef.current = logo.parentElement as HTMLElement;
        fsElement.appendChild(logo);
        logo.style.position = 'fixed';
        logo.style.top = '12px';
        logo.style.right = '12px';
        logo.style.zIndex = '2147483647';
      } else {
        if (logoOriginalParentRef.current) {
          logoOriginalParentRef.current.appendChild(logo);
        }
        logo.style.position = '';
        logo.style.top = '';
        logo.style.right = '';
        logo.style.zIndex = '';
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (typeof Clappr !== 'undefined') { setScriptLoaded(true); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@clappr/player@latest/dist/clappr.min.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => { setError('Failed to load player script.'); setIsLoading(false); };
    document.head.appendChild(script);
  }, []);

  const applyVideoStretch = useCallback((container: HTMLElement) => {
    const video = container.querySelector('video') as HTMLVideoElement | null;
    if (!video) return;
    video.style.setProperty('object-fit', 'fill', 'important');
    video.style.setProperty('width', '100%', 'important');
    video.style.setProperty('height', '100%', 'important');
    video.style.setProperty('position', 'absolute', 'important');
    video.style.setProperty('inset', '0', 'important');
  }, []);

  const initPlayer = useCallback(() => {
    if (!playerContainerRef.current || typeof Clappr === 'undefined') return;

    if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }

    const container = playerContainerRef.current;
    container.innerHTML = '';
    userPausedRef.current = false;
    setError(null);
    setIsLoading(true);
    setIsPaused(false);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    let proxiedSrc = `${supabaseUrl}/functions/v1/stream-proxy?url=${encodeURIComponent(streamUrl)}&t=${Date.now()}`;
    if (referer) proxiedSrc += `&referer=${encodeURIComponent(referer)}`;
    if (origin) proxiedSrc += `&origin=${encodeURIComponent(origin)}`;
    if (userAgent) proxiedSrc += `&user_agent=${encodeURIComponent(userAgent)}`;
    if (cookie) proxiedSrc += `&cookie=${encodeURIComponent(cookie)}`;
    if (customHeaders && Object.keys(customHeaders).length > 0)
      proxiedSrc += `&custom_headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;

    try {
      const player = new Clappr.Player({
        source: proxiedSrc,
        parent: container,
        poster,
        autoPlay: true,
        mute: true, // ✅ muted দিয়ে init — browser autoplay block করবে না
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
            xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = false; },
          },
        },
        events: {
          onReady: () => {
            setIsLoading(false);
            setError(null);
            onReady?.();
            setTimeout(() => applyVideoStretch(container), 100);
            setTimeout(() => applyVideoStretch(container), 500);
            // ✅ mobile এ explicit play() call না দিলে autoPlay কাজ করে না
            setTimeout(() => {
              try { player.play(); } catch (e) {}
            }, 200);
          },
          onPlay: () => {
            setIsLoading(false);
            setError(null);
            setIsPaused(false);
            userPausedRef.current = false;
            applyVideoStretch(container);
          },
          onPause: () => {
            userPausedRef.current = true;
            setIsPaused(true);
          },
          onBuffer: () => setIsLoading(true),
          onBufferFull: () => {
            setIsLoading(false);
            applyVideoStretch(container);
          },
          onError: (err: any) => {
            console.error('ClapprProxy Error:', err);
            const errMsg = 'Playback failed. The stream might be restricted or the proxy is being blocked.';
            setError(errMsg);
            setIsLoading(false);
            setIsPaused(false);
            onError?.(errMsg);
            if (err?.code === 'PLAYBACK_ERROR') setTimeout(() => initPlayer(), 3000);
            onStuck?.();
          },
        },
      });

      playerRef.current = player;

      // ✅ Clappr নিজের API দিয়ে unmute — internal state + UI icon দুটোই আপডেট হবে
      player.on(Clappr.Events.PLAYER_PLAY, () => {
        setTimeout(() => {
          try {
            player.unmute();        // ✅ Clappr internal state update
            player.setVolume(100);  // ✅ Clappr volume UI আপডেট
          } catch (e) {}
        }, 100);
      });

      const videoWatcher = new MutationObserver(() => {
        const video = container.querySelector('video');
        if (video) {
          video.muted = true;
          video.playsInline = true;
          applyVideoStretch(container);
          videoWatcher.disconnect();
        }
      });
      videoWatcher.observe(container, { childList: true, subtree: true });

    } catch (err) {
      console.error('ClapprProxy init error:', err);
      setError('Could not initialize player.');
      setIsLoading(false);
    }
  }, [streamUrl, referer, origin, userAgent, cookie, customHeaders, poster, onError, onReady, onStuck, applyVideoStretch]);

  useEffect(() => {
    if (scriptLoaded) initPlayer();
    return () => {
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
    };
  }, [scriptLoaded, initPlayer]);

  useEffect(() => {
    let lastTime = 0;
    let stuckCount = 0;
    const checkStuck = setInterval(() => {
      const video = playerContainerRef.current?.querySelector('video') as HTMLVideoElement | null;
      if (!video) return;
      if (userPausedRef.current) return;
      if (!video.paused && !isLoading && video.readyState >= 3) {
        if (video.currentTime === lastTime) {
          stuckCount++;
          if (stuckCount >= 20) {
            console.warn('Stream stuck. Reloading...');
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
        ref={(el) => {
          playerContainerRef.current = el;
          if (el) el.id = containerId;
        }}
        className={cn('w-full h-full', isLoading && 'opacity-0')}
        style={{ position: 'relative' }}
      />

      {!error && (
        <img
          ref={logoRef}
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

      {/* ✅ Pause overlay */}
      {isPaused && !error && !isLoading && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 cursor-pointer"
          onClick={() => {
            playerRef.current?.play();
            setIsPaused(false);
          }}
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 transition-transform active:scale-95">
            <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white ml-1" xmlns="http://www.w3.org/2000/svg">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
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
          </div>
        </div>
      )}

      <style>{`
        #${containerId} [data-player] { width: 100% !important; height: 100% !important; }
        #${containerId} > div { width: 100% !important; height: 100% !important; padding: 0 !important; }
        :fullscreen video, :-webkit-full-screen video, :-moz-full-screen video {
          object-fit: fill !important;
          width: 100vw !important;
          height: 100vh !important;
        }
      `}</style>
    </div>
  );
};
