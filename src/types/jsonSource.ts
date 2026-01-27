import { PlayerType } from "./playerTypes";

export interface JsonSource {
  id: string;
  name: string;
  slug: string;
  url: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  display_order?: number;
  default_player?: PlayerType;
  link_prefixes?: Record<string, string>; // Per-link proxy prefixes: {"1": "https://...", "2": "https://..."}
  created_at?: string;
  updated_at?: string;
}
