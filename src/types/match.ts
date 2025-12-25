export interface Match {
  id: string;
  team1: string;
  team2: string;
  event: string;
  startTime: string;
  status: 'live' | 'upcoming';
  thumbnail?: string;
  streamLinkIN?: string;
  streamLinkBD?: string;
  matchId?: number;
  title?: string;
  category?: string;
}

export interface FancodeMatch {
  event_category: string;
  title: string;
  src: string;
  team_1: string;
  team_2: string;
  status: string;
  event_name: string;
  match_name: string;
  match_id: number;
  startTime: string;
  dai_url?: string;
  adfree_url?: string;
}

export interface FancodeResponse {
  success: boolean;
  totalMatches: number;
  lastUpdated: string | null;
  matches: FancodeMatch[];
  error?: string;
}
