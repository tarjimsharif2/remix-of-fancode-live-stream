export interface M3uPlaylist {
  id: string;
  name: string;
  slug: string;
  url: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  display_order: number | null;
  default_player: string | null;
  created_at: string;
  updated_at: string;
}

export interface M3uChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}
