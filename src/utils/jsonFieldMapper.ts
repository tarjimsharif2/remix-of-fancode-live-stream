/**
 * Smart JSON Field Mapper
 * Auto-detects field names from various JSON structures
 */

import { StreamLink, extractStreamLinks } from './streamExtractor';

// Common field name variations for each data type
const FIELD_VARIANTS = {
  id: ['match_id', 'id', 'event_id', 'game_id', 'stream_id', 'channel_id', '_id'],
  title: ['title', 'name', 'match_title', 'event_name', 'game_name', 'channel_name', 'label', 'heading'],
  category: ['category', 'sport', 'type', 'genre', 'tournament', 'league', 'competition'],
  startTime: ['start_time', 'startTime', 'time', 'datetime', 'date', 'scheduled', 'start_at', 'starts_at', 'match_time'],
  status: ['status', 'state', 'live', 'is_live', 'match_status'],
  thumbnail: ['thumbnail', 'image', 'logo', 'poster', 'icon', 'thumb', 'img', 'picture', 'logo_url', 'image_url'],
  description: ['description', 'desc', 'info', 'details', 'summary', 'subtitle'],
};

// Find the first matching field value from an object
const findFieldValue = (obj: Record<string, any>, variants: string[]): any => {
  for (const variant of variants) {
    if (obj[variant] !== undefined && obj[variant] !== null && obj[variant] !== '') {
      return obj[variant];
    }
  }
  return null;
};

// Detect live status from various formats
const detectLiveStatus = (obj: Record<string, any>): string => {
  const status = findFieldValue(obj, FIELD_VARIANTS.status);
  
  if (status === true || status === 'live' || status === 'LIVE' || status === 1) {
    return 'live';
  }
  if (status === false || status === 'upcoming' || status === 'UPCOMING' || status === 0) {
    return 'upcoming';
  }
  if (status === 'ended' || status === 'finished' || status === 'completed') {
    return 'ended';
  }
  
  // Check if is_live field exists
  if (obj.is_live === true || obj.isLive === true) {
    return 'live';
  }
  
  return status?.toString() || 'upcoming';
};

export interface MappedMatch {
  matchId: string;
  title: string;
  category: string;
  startTime: string;
  status: string;
  thumbnail: string;
  streamLinks: StreamLink[]; // Multiple stream URLs
  description?: string;
  rawData: Record<string, any>; // Keep raw data for flexible display
}

// Map a single item from JSON to our format
export const mapJsonItem = (item: Record<string, any>, index: number): MappedMatch => {
  const streamLinks = extractStreamLinks(item);
  
  return {
    matchId: (findFieldValue(item, FIELD_VARIANTS.id) || index).toString(),
    title: findFieldValue(item, FIELD_VARIANTS.title) || 'Unknown',
    category: findFieldValue(item, FIELD_VARIANTS.category) || 'Sports',
    startTime: findFieldValue(item, FIELD_VARIANTS.startTime) || '',
    status: detectLiveStatus(item),
    thumbnail: findFieldValue(item, FIELD_VARIANTS.thumbnail) || '',
    streamLinks,
    description: findFieldValue(item, FIELD_VARIANTS.description) || '',
    rawData: item,
  };
};

// Extract matches array from various JSON structures
export const extractMatchesArray = (data: any): any[] => {
  if (!data) return [];
  
  // Direct array
  if (Array.isArray(data)) {
    return data;
  }
  
  // Common wrapper fields
  const wrapperFields = [
    'matches', 'events', 'data', 'items', 'results', 
    'channels', 'streams', 'content', 'list', 'games',
    'response', 'payload'
  ];
  
  for (const field of wrapperFields) {
    if (data[field]) {
      if (Array.isArray(data[field])) {
        return data[field];
      }
      // Nested data
      if (typeof data[field] === 'object') {
        const nested = extractMatchesArray(data[field]);
        if (nested.length > 0) return nested;
      }
    }
  }
  
  // If it's a single object with stream-like properties, wrap it
  if (typeof data === 'object' && (data.url || data.stream_url || data.title)) {
    return [data];
  }
  
  return [];
};

// Map entire JSON response to our format
export const mapJsonResponse = (data: any): MappedMatch[] => {
  const items = extractMatchesArray(data);
  return items.map((item, index) => mapJsonItem(item, index));
};
