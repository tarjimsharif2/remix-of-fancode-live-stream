export interface Match {
  id: string;
  team1: string;
  team2: string;
  team1Flag?: string;
  team2Flag?: string;
  event: string;
  startTime: string;
  status: 'live' | 'upcoming';
  thumbnail?: string;
  streamLink?: string;
  matchId?: number;
}

export interface FancodeMatch {
  event_catagory: string;
  event_name: string;
  match_id: number;
  match_name: string;
  team_1: string;
  team_1_flag: string;
  team_2: string;
  team_2_flag: string;
  banner: string;
  stream_link: string;
}

export interface FancodeResponse {
  success: boolean;
  totalMatches: number;
  lastUpdated: string | null;
  matches: FancodeMatch[];
  error?: string;
}
