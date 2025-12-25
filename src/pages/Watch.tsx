import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Globe, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Generate stream URL from match ID
const generateStreamUrl = (matchId: string, region: 'BD' | 'IN'): string => {
  const prefix = region === 'BD' ? 'bd-mc-fdlive' : 'in-mc-fdlive';
  return `https://${prefix}.fancode.com/mumbai/${matchId}_english_hls/master.m3u8`;
};

const Watch = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Determine region from URL path
  const region: 'BD' | 'IN' = location.pathname.includes('play-bd') ? 'BD' : 'IN';
  const matchId = searchParams.get('id') || '';
  
  // Generate stream URL from match ID
  const streamUrl = matchId ? generateStreamUrl(matchId, region) : '';
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initPlayer = useCallback(async () => {
    if (!playerContainerRef.current || !streamUrl || !matchId) {
      setError("No stream URL provided");
      setIsLoading(false);
      return;
    }

    // Cleanup previous player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import Clappr
      const Clappr = await import('@clappr/player');
      const HlsjsPlayback = await import('@clappr/hlsjs-playback');

      // Clear container
      if (playerContainerRef.current) {
        playerContainerRef.current.innerHTML = '';
      }

      const player = new Clappr.default.Player({
        parent: playerContainerRef.current,
        source: streamUrl,
        plugins: [HlsjsPlayback.default],
        playback: {
          hlsjsConfig: {
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
          }
        },
        autoPlay: true,
        mute: false,
        height: '100%',
        width: '100%',
        mediacontrol: {
          seekbar: '#10b981',
          buttons: '#ffffff'
        },
        events: {
          onError: (e: any) => {
            console.error('Clappr error:', e);
            setError(`Stream unavailable in your region. This stream is geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}. Try using a VPN.`);
            setIsLoading(false);
          },
          onPlay: () => {
            setIsLoading(false);
          },
          onReady: () => {
            setIsLoading(false);
          }
        }
      });

      playerRef.current = player;

      // Handle playback errors
      player.on(Clappr.default.Events.PLAYER_ERROR, () => {
        setError(`Stream unavailable. This stream may be geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}.`);
        setIsLoading(false);
      });

    } catch (err) {
      console.error('Failed to initialize player:', err);
      setError('Failed to load video player. Please try again.');
      setIsLoading(false);
    }
  }, [streamUrl, region, matchId]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [initPlayer]);

  const handleRetry = () => {
    initPlayer();
  };

  const switchRegion = () => {
    const newPath = region === 'BD' ? '/fancode/play-in.php' : '/fancode/play-bd.php';
    window.location.href = `${newPath}?id=${matchId}`;
  };

  const openFancode = () => {
    window.open('https://www.fancode.com', '_blank');
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden">
      {isLoading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white/70 text-sm">Connecting to {region} stream...</p>
        </div>
      )}

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10 bg-black">
          <div className="bg-destructive/20 rounded-full p-4 mb-4">
            <Globe className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-white font-medium mb-2">Stream Unavailable</p>
          <p className="text-white/60 text-sm mb-6 max-w-md">
            {error}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleRetry} variant="outline" className="border-white/20 text-white hover:bg-white/10">
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
          <p className="text-xs text-white/40 mt-4">
            💡 Use a VPN to access geo-restricted streams
          </p>
        </div>
      ) : null}

      {/* Clappr Player Container - Fullscreen */}
      <div 
        ref={playerContainerRef} 
        className={cn(
          "w-full h-full",
          (isLoading || error) && "invisible"
        )}
      />
    </div>
  );
};

export default Watch;
