import { PlayerType } from './playerTypes';

export interface CustomChannel {
  id: string;
  name: string;
  stream_url: string;
  logo_url: string | null;
  category: string;
  custom_referer: string | null;
  custom_origin: string | null;
  custom_user_agent: string | null;
  custom_cookie: string | null;
  custom_headers: Record<string, string>;
  player_type: PlayerType;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
