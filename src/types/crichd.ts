export interface CricHdChannel {
  name: string;
  id: string;
  logo: string;
  link: string;
  referer: string;
  origin: string;
}

export interface CricHdResponse {
  success: boolean;
  totalChannels: number;
  channels: CricHdChannel[];
  error?: string;
}
