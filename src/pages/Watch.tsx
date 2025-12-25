import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Globe, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Generate stream URL from match ID
const generateStreamUrl = (matchId: string, region: 'BD' | 'IN'): string => {
  const prefix = region === 'BD' ? 'bd-mc-fdlive' : 'in-mc-fdlive';
  return `https://${prefix}.fancode.com/mumbai/${matchId}_english_hls/master.m3u8`;
};

const Watch = () => {
  const { matchId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const region = (searchParams.get('region') as 'BD' | 'IN') || 'BD';
  const matchName = searchParams.get('match') || 'Live Match';
  
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
            setError(`Stream unavailable in your region. This stream is geo-restricted to ${region === 'BD' ? 'Bangladesh' : 'India'}. Try using a VPN or the other region's stream.`);
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
    const newRegion = region === 'BD' ? 'IN' : 'BD';
    navigate(`/watch/${matchId}?region=${newRegion}&match=${encodeURIComponent(matchName)}`);
  };

  const openFancode = () => {
    window.open('https://www.fancode.com', '_blank');
  };

  const goBack = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border p-4 flex items-center gap-4">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-card">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground text-sm">Connecting to {region} stream...</p>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-10 bg-card">
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
          ) : null}

          {/* Clappr Player Container */}
          <div 
            ref={playerContainerRef} 
            className={cn(
              "w-full h-full",
              (isLoading || error) && "invisible"
            )}
          />
        </div>
      </div>

      {/* Mobile Region Switcher */}
      <div className="sm:hidden p-4 bg-card border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={switchRegion}
          className="w-full"
        >
          <Globe className="w-4 h-4 mr-2" />
          Switch to {region === 'BD' ? 'India' : 'Bangladesh'} Stream
        </Button>
      </div>
    </div>
  );
};

export default Watch;
