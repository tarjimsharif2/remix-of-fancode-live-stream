export type PlayerType = 'clappr' | 'clappr-proxy' | 'hlsjs' | 'iframe' | 'native' | 'shaka';

export interface PlayerConfig {
  type: PlayerType;
  label: string;
  description: string;
  icon: string;
}

export const PLAYER_CONFIGS: PlayerConfig[] = [
  {
    type: 'clappr',
    label: 'Clappr',
    description: 'Default player with quality selection',
    icon: '🎬',
  },
  {
    type: 'clappr-proxy',
    label: 'Clappr Proxy',
    description: 'Proxy player for restricted streams (CricHD/RoarZone)',
    icon: '🛡️',
  },
  {
    type: 'hlsjs',
    label: 'HLS.js',
    description: 'Lightweight HLS player (like CricHD)',
    icon: '📺',
  },
  {
    type: 'iframe',
    label: 'Iframe/Embed',
    description: 'External embed player',
    icon: '🌐',
  },
  {
    type: 'native',
    label: 'Native',
    description: 'Browser native video player',
    icon: '▶️',
  },
];

export const getPlayerConfig = (type: PlayerType): PlayerConfig => {
  return PLAYER_CONFIGS.find(p => p.type === type) || PLAYER_CONFIGS[0];
};
