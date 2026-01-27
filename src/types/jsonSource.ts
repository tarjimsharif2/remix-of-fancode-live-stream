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
  created_at?: string;
  updated_at?: string;
}
