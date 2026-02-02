export interface YouTubeStream {
  id: string;
  name: string;
  youtube_url: string;
  logo_url: string | null;
  category: string;
  cached_m3u8: string | null;
  manual_m3u8: string | null;
  last_fetched_at: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
