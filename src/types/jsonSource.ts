import { PlayerType } from "./playerTypes";

// Per-link configuration with prefix and player
export interface LinkConfig {
  prefix?: string;  // Proxy prefix URL
  player?: PlayerType;  // Player type for this link
}

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
  link_prefixes?: Record<string, unknown>; // Stored as JSON - can be string (legacy) or LinkConfig
  created_at?: string;
  updated_at?: string;
}

// Helper to get normalized link config (handles legacy string format)
export const getLinkConfig = (
  linkPrefixes: Record<string, unknown> | null | undefined,
  linkNumber: number
): LinkConfig => {
  if (!linkPrefixes) return {};
  
  const config = linkPrefixes[linkNumber.toString()];
  if (!config) return {};
  
  // Handle legacy string format (just prefix)
  if (typeof config === 'string') {
    return { prefix: config };
  }
  
  // Handle LinkConfig object
  if (typeof config === 'object' && config !== null) {
    const obj = config as Record<string, unknown>;
    return {
      prefix: typeof obj.prefix === 'string' ? obj.prefix : undefined,
      player: typeof obj.player === 'string' ? obj.player as PlayerType : undefined,
    };
  }
  
  return {};
};
