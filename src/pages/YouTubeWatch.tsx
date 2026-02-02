import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { YouTubeStream } from "@/types/youtubeStream";
import { ClapprPlayer } from "@/components/players/ClapprPlayer";
import { HlsJsPlayer } from "@/components/players/HlsJsPlayer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Youtube, Settings2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PlayerType = "embed" | "clappr" | "hlsjs";

// Extract YouTube video ID from URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Build proxied URL for M3U8 streams
function buildProxiedUrl(m3u8Url: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const proxyUrl = `${supabaseUrl}/functions/v1/stream-proxy`;
  const params = new URLSearchParams();
  params.set('url', m3u8Url);
  return `${proxyUrl}?${params.toString()}`;
}

const YouTubeWatch = () => {
  const { streamId } = useParams<{ streamId: string }>();
  const navigate = useNavigate();
  
  const [stream, setStream] = useState<YouTubeStream | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [m3u8Url, setM3u8Url] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<PlayerType>("embed");
  const [playerKey, setPlayerKey] = useState(0);

  const fetchStream = useCallback(async () => {
    if (!streamId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch stream details
      const { data: streamData, error: streamError } = await supabase
        .from("youtube_streams")
        .select("*")
        .eq("id", streamId)
        .single();

      if (streamError) throw streamError;
      if (!streamData) throw new Error("Stream not found");

      setStream(streamData as YouTubeStream);

      const typedStream = streamData as YouTubeStream;

      // Extract video ID for embed player
      const vid = extractVideoId(typedStream.youtube_url);
      setVideoId(vid);

      // For embed player, we don't need M3U8
      if (playerType === "embed") {
        setLoading(false);
        return;
      }

      // For HLS players, try to get M3U8 URL
      // Priority 1: Manual M3U8 URL
      if (typedStream.manual_m3u8) {
        console.log("Using manual M3U8 URL");
        setM3u8Url(typedStream.manual_m3u8);
        setLoading(false);
        return;
      }

      // Priority 2: Cached M3U8 (if valid - less than 30 minutes old)
      if (typedStream.cached_m3u8 && typedStream.last_fetched_at) {
        const lastFetched = new Date(typedStream.last_fetched_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastFetched.getTime()) / (1000 * 60);

        if (diffMinutes < 30) {
          console.log("Using cached M3U8 URL via proxy");
          setM3u8Url(buildProxiedUrl(typedStream.cached_m3u8));
          setLoading(false);
          return;
        }
      }

      // Priority 3: Fetch fresh M3U8 from external APIs
      console.log("Fetching fresh M3U8 URL...");
      const { data: m3u8Data, error: m3u8Error } = await supabase.functions.invoke(
        "fetch-youtube-m3u8",
        {
          body: {
            youtube_url: typedStream.youtube_url,
            stream_id: streamId,
          },
        }
      );

      if (m3u8Error) throw m3u8Error;
      if (!m3u8Data.success) throw new Error(m3u8Data.error || "Failed to extract M3U8");

      console.log("Using fresh M3U8 URL via proxy");
      setM3u8Url(buildProxiedUrl(m3u8Data.m3u8_url));
    } catch (err) {
      console.error("Error fetching stream:", err);
      setError(err instanceof Error ? err.message : "Failed to load stream");
    } finally {
      setLoading(false);
    }
  }, [streamId, playerType]);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  const handleRefresh = () => {
    setM3u8Url(null);
    setPlayerKey((k) => k + 1);
    fetchStream();
  };

  const handlePlayerChange = (newType: PlayerType) => {
    setPlayerType(newType);
    setPlayerKey((k) => k + 1);
  };

  // YouTube Embed Player Component
  const YouTubeEmbed = ({ videoId }: { videoId: string }) => (
    <div className="w-full h-full flex items-center justify-center">
      <iframe
        key={playerKey}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
        className="w-full h-full max-h-[80vh] aspect-video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title={stream?.name || "YouTube Stream"}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/youtube")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center">
              <Youtube className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <h1 className="text-white font-medium text-sm truncate max-w-[200px] sm:max-w-none">
                {stream?.name || "Loading..."}
              </h1>
              {stream?.category && (
                <p className="text-white/60 text-xs capitalize">{stream.category}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="text-white hover:bg-white/10"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handlePlayerChange("embed")}
                className={playerType === "embed" ? "bg-accent" : ""}
              >
                🎬 YouTube Embed (Recommended)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handlePlayerChange("clappr")}
                className={playerType === "clappr" ? "bg-accent" : ""}
              >
                📺 Clappr Player
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handlePlayerChange("hlsjs")}
                className={playerType === "hlsjs" ? "bg-accent" : ""}
              >
                📡 HLS.js Player
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Player Area */}
      <div className="flex-1 flex items-center justify-center bg-black p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-10 h-10 animate-spin text-red-500" />
            <p className="text-white/70">Loading stream...</p>
          </div>
        ) : error && playerType !== "embed" ? (
          <div className="flex flex-col items-center gap-4 text-center px-4">
            <Youtube className="w-16 h-16 text-red-500/50" />
            <p className="text-white/70 max-w-md">{error}</p>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="outline" onClick={() => navigate("/youtube")}>
                Go Back
              </Button>
              <Button onClick={() => handlePlayerChange("embed")}>
                <Youtube className="w-4 h-4 mr-2" />
                Use Embed Player
              </Button>
              <Button variant="secondary" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry HLS
              </Button>
            </div>
          </div>
        ) : playerType === "embed" && videoId ? (
          <YouTubeEmbed videoId={videoId} />
        ) : m3u8Url ? (
          <div className="w-full h-full max-w-[1920px]">
            {playerType === "clappr" ? (
              <ClapprPlayer
                key={`clappr-${playerKey}`}
                streamUrl={m3u8Url}
              />
            ) : (
              <HlsJsPlayer
                key={`hlsjs-${playerKey}`}
                streamUrl={m3u8Url}
                title={stream?.name}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Youtube className="w-16 h-16 text-red-500/50" />
            <p className="text-white/70">No stream available</p>
            <Button onClick={() => handlePlayerChange("embed")}>
              <Youtube className="w-4 h-4 mr-2" />
              Try Embed Player
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default YouTubeWatch;
