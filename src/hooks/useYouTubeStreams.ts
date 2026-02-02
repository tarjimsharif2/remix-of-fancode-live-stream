import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { YouTubeStream } from '@/types/youtubeStream';

export function useYouTubeStreams() {
  const [streams, setStreams] = useState<YouTubeStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStreams = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('youtube_streams')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      setStreams((data || []) as YouTubeStream[]);
    } catch (err) {
      console.error('Error fetching YouTube streams:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch streams');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchM3u8 = useCallback(async (stream: YouTubeStream): Promise<string | null> => {
    // Priority 1: Manual M3U8 URL (always preferred if set)
    if (stream.manual_m3u8) {
      console.log('Using manual M3U8 URL');
      return stream.manual_m3u8;
    }

    // Priority 2: Cached M3U8 (if still valid - less than 30 minutes old)
    if (stream.cached_m3u8 && stream.last_fetched_at) {
      const lastFetched = new Date(stream.last_fetched_at);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastFetched.getTime()) / (1000 * 60);
      
      if (diffMinutes < 30) {
        console.log('Using cached M3U8 URL');
        return stream.cached_m3u8;
      }
    }

    // Priority 3: Fetch fresh M3U8 from external APIs
    try {
      const { data, error } = await supabase.functions.invoke('fetch-youtube-m3u8', {
        body: { 
          youtube_url: stream.youtube_url,
          stream_id: stream.id 
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.m3u8_url;
    } catch (err) {
      console.error('Error fetching M3U8:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStreams();
  }, [fetchStreams]);

  return {
    streams,
    loading,
    error,
    refetch: fetchStreams,
    fetchM3u8,
  };
}
