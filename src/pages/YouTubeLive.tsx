import { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Youtube, Play, Loader2, RefreshCw, Copy, Check } from 'lucide-react';
import { ClapprPlayer } from '@/components/players/ClapprPlayer';
import { HlsJsPlayer } from '@/components/players/HlsJsPlayer';
import { PlayerType, PLAYER_CONFIGS } from '@/types/playerTypes';

interface YouTubeResult {
  videoId: string;
  title: string;
  m3u8Url: string;
}

export default function YouTubeLive() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<YouTubeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerType, setPlayerType] = useState<PlayerType>('hlsjs');
  const [copied, setCopied] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const extractM3u8 = useCallback(async (youtubeUrl?: string) => {
    const targetUrl = youtubeUrl || url;
    if (!targetUrl.trim()) {
      toast.error('Please enter a YouTube URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('youtube-to-m3u8', {
        body: { url: targetUrl },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to extract M3U8');
      }

      setResult({
        videoId: data.videoId,
        title: data.title,
        m3u8Url: data.m3u8Url,
      });
      toast.success('M3U8 link extracted successfully!');
    } catch (err) {
      console.error('Error extracting M3U8:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract M3U8';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    extractM3u8();
  };

  const handleRefresh = () => {
    if (result) {
      extractM3u8(url);
    }
  };

  const handleRetry = useCallback(() => {
    // First try to refresh the M3U8 link on error
    extractM3u8(url);
    setRetryKey(prev => prev + 1);
  }, [extractM3u8, url]);

  const copyToClipboard = async () => {
    if (result?.m3u8Url) {
      await navigator.clipboard.writeText(result.m3u8Url);
      setCopied(true);
      toast.success('M3U8 URL copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setUrl('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <Youtube className="h-10 w-10 text-red-500" />
              <h1 className="text-3xl font-bold">YouTube Live to M3U8</h1>
            </div>
            <p className="text-muted-foreground">
              Convert YouTube Live streams to M3U8 format for playback
            </p>
          </div>

          {/* Input Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enter YouTube Live URL</CardTitle>
              <CardDescription>
                Paste a YouTube Live stream URL to extract the M3U8 link
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading || !url.trim()}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Extract</span>
                  </Button>
                  {result && (
                    <Button type="button" variant="outline" onClick={handleClear}>
                      Clear
                    </Button>
                  )}
                </div>

                {/* Player Type Selector */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">Player:</span>
                  <Select value={playerType} onValueChange={(v) => setPlayerType(v as PlayerType)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYER_CONFIGS.filter(p => p.type !== 'iframe').map((config) => (
                        <SelectItem key={config.type} value={config.type}>
                          {config.icon} {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive text-center">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Result & Player */}
          {result && (
            <div className="space-y-4">
              {/* Stream Info */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-semibold">{result.title}</h3>
                      <p className="text-sm text-muted-foreground">Video ID: {result.videoId}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyToClipboard}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        <span className="ml-2">{copied ? 'Copied' : 'Copy URL'}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span className="ml-2">Refresh</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Player */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video bg-black">
                    {playerType === 'clappr' ? (
                      <ClapprPlayer
                        key={`${result.m3u8Url}-${retryKey}`}
                        streamUrl={result.m3u8Url}
                      />
                    ) : playerType === 'native' ? (
                      <video
                        key={`${result.m3u8Url}-${retryKey}`}
                        src={result.m3u8Url}
                        className="w-full h-full"
                        controls
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <HlsJsPlayer
                        key={`${result.m3u8Url}-${retryKey}`}
                        streamUrl={result.m3u8Url}
                        title={result.title}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* M3U8 URL Display */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">M3U8 URL</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-3 rounded-md overflow-x-auto">
                    <code className="text-xs break-all">{result.m3u8Url}</code>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ This link may expire. Click "Refresh" if playback fails.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
