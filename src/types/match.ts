export interface Match {
  id: string;
  team1: string;
  team2: string;
  event: string;
  startTime: string;
  status: 'live' | 'upcoming';
  thumbnail: string;
}
