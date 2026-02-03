/**
 * Stream Link Extractor
 * Extracts multiple stream URLs from various JSON field formats
 * Handles nested structures like STREAMING_CDN
 */

export interface StreamLink {
  url: string;
  label: string;
  quality?: string;
  region?: string;
  type?: string;
  // Header fields for proxying
  referer?: string;
  origin?: string;
  userAgent?: string;
}

// Common field names for stream URLs - ordered by priority
const STREAM_FIELDS = [
  // Direct link fields (most common in simple JSON) - url first!
  'url', 'link', 'src', 'source',
  // Primary/Main URLs
  'Primary_Playback_URL', 'primary_playback_url',
  'adfree_url', 'adFreeUrl', 'adfree',
  'dai_url', 'daiUrl', 'dai',
  'dai_google_cdn', 'daiGoogleCdn',
  'stream_url', 'streamUrl', 'stream',
  'hls_url', 'hlsUrl', 'hls',
  'm3u8', 'm3u8_url', 'm3u8Url',
  'video_url', 'videoUrl', 'video',
  'play_url', 'playUrl', 'play',
  'live_url', 'liveUrl', 'live',
  'embed_url', 'embedUrl', 'embed',
  'iframe_url', 'iframeUrl', 'iframe',
  'playback_url', 'playbackUrl', 'playback',
  'media_url', 'mediaUrl', 'media',
  'content_url', 'contentUrl',
  // CDN specific
  'fancode_cdn', 'fancode_bd_cdn', 'fancodeCdn',
  'cloudfront_cdn', 'cloudfrontCdn',
  'sony_cdn', 'sonyCdn',
  'akamai_cdn', 'akamaiCdn',
];

// Nested objects that might contain stream URLs
const NESTED_STREAM_OBJECTS = [
  'STREAMING_CDN', 'streaming_cdn', 'streamingCdn',
  'streams', 'cdn', 'playback', 'urls', 'links',
];

// Generate label from field name
const getLabelFromField = (field: string): string => {
  const labels: Record<string, string> = {
    'Primary_Playback_URL': 'Primary (IN)',
    'primary_playback_url': 'Primary (IN)',
    'adfree_url': 'Ad-Free',
    'adFreeUrl': 'Ad-Free',
    'adfree': 'Ad-Free',
    'dai_url': 'DAI',
    'daiUrl': 'DAI',
    'dai': 'DAI',
    'dai_google_cdn': 'DAI Google',
    'daiGoogleCdn': 'DAI Google',
    'stream_url': 'Stream',
    'streamUrl': 'Stream',
    'hls_url': 'HLS',
    'hlsUrl': 'HLS',
    'm3u8': 'M3U8',
    'embed_url': 'Embed',
    'iframe_url': 'Iframe',
    'fancode_cdn': 'FanCode (IN)',
    'fancode_bd_cdn': 'FanCode (BD)',
    'cloudfront_cdn': 'CloudFront',
    'sony_cdn': 'Sony',
  };
  
  return labels[field] || field
    .replace(/_url$/i, '')
    .replace(/_cdn$/i, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

// Check if URL is valid stream URL
const isValidStreamUrl = (value: any): boolean => {
  if (!value || typeof value !== 'string') return false;
  if (value === 'Unavailable' || value === 'null' || value === 'undefined') return false;
  return value.startsWith('http://') || value.startsWith('https://');
};

// Detect region from URL or field name
const detectRegion = (url: string, fieldName: string): string | undefined => {
  // From URL patterns
  if (url.includes('bd-mc-fdlive') || url.includes('bd-') || url.includes('/bd/')) return 'BD';
  if (url.includes('in-mc-fdlive') || url.includes('in-') || url.includes('/in/')) return 'IN';
  if (url.includes('ww-') || url.includes('/ww/')) return 'WW';
  
  // From field name
  const lowerField = fieldName.toLowerCase();
  if (lowerField.includes('_bd') || lowerField.includes('bd_')) return 'BD';
  if (lowerField.includes('_in') || lowerField.includes('in_') || lowerField.includes('india')) return 'IN';
  if (lowerField.includes('_ww') || lowerField.includes('ww_') || lowerField.includes('worldwide')) return 'WW';
  
  return undefined;
};

// Extract stream URLs from a flat object
const extractFromObject = (obj: Record<string, any>, seenUrls: Set<string>): StreamLink[] => {
  const links: StreamLink[] = [];
  
  // Get header values from the object (for proxy use)
  const referer = obj.referer || obj.Referer || obj.referrer || obj.Referrer || '';
  const origin = obj.origin || obj.Origin || '';
  const userAgent = obj.user_agent || obj.userAgent || obj.User_Agent || '';
  
  for (const field of STREAM_FIELDS) {
    const value = obj[field];
    if (isValidStreamUrl(value) && !seenUrls.has(value)) {
      seenUrls.add(value);
      links.push({
        url: value,
        label: getLabelFromField(field),
        region: detectRegion(value, field),
        referer: referer || undefined,
        origin: origin || undefined,
        userAgent: userAgent || undefined,
      });
    }
  }
  
  return links;
};

// Main extraction function
export const extractStreamLinks = (obj: Record<string, any>): StreamLink[] => {
  const links: StreamLink[] = [];
  const seenUrls = new Set<string>();
  
  if (!obj || typeof obj !== 'object') return links;
  
  // First, check for nested streaming objects (STREAMING_CDN, etc.)
  for (const nestedField of NESTED_STREAM_OBJECTS) {
    const nested = obj[nestedField];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedLinks = extractFromObject(nested, seenUrls);
      links.push(...nestedLinks);
    }
  }
  
  // Then check direct fields on the object
  const directLinks = extractFromObject(obj, seenUrls);
  links.push(...directLinks);
  
  // Check for streams/links array
  const arrayFields = ['streams', 'links', 'sources', 'urls', 'channels'];
  for (const field of arrayFields) {
    if (Array.isArray(obj[field])) {
      obj[field].forEach((item: any, index: number) => {
        let url = '';
        let label = '';
        
        if (typeof item === 'string') {
          url = item;
          label = `Stream ${index + 1}`;
        } else if (typeof item === 'object' && item) {
          url = item.url || item.link || item.src || item.stream_url || '';
          label = item.label || item.name || item.title || item.quality || `Stream ${index + 1}`;
        }
        
        if (isValidStreamUrl(url) && !seenUrls.has(url)) {
          seenUrls.add(url);
          links.push({
            url,
            label,
            quality: item?.quality || item?.resolution,
            region: detectRegion(url, label),
            type: item?.type,
          });
        }
      });
    }
  }
  
  // Check nested objects like "in", "bd", "ww" regions
  const regionKeys = ['in', 'bd', 'ww', 'india', 'bangladesh', 'worldwide', 'IN', 'BD', 'WW'];
  for (const regionKey of regionKeys) {
    if (obj[regionKey] && typeof obj[regionKey] === 'object' && !Array.isArray(obj[regionKey])) {
      const regionLinks = extractFromObject(obj[regionKey], seenUrls);
      regionLinks.forEach(link => {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          const regionCode = regionKey.toUpperCase().slice(0, 2);
          links.push({
            ...link,
            label: `${link.label} (${regionCode})`,
            region: regionCode,
          });
        }
      });
    }
    
    // Also check for direct region URLs like "in_url", "bd_url"
    const regionUrl = obj[`${regionKey}_url`] || obj[`${regionKey}Url`];
    if (isValidStreamUrl(regionUrl) && !seenUrls.has(regionUrl)) {
      seenUrls.add(regionUrl);
      const regionCode = regionKey.toUpperCase().slice(0, 2);
      links.push({
        url: regionUrl,
        label: regionCode,
        region: regionCode,
      });
    }
  }
  
  // Generate BD variants for IN streams if not present
  const hasInStream = links.some(l => l.region === 'IN' || l.url.includes('in-mc-fdlive'));
  const hasBdStream = links.some(l => l.region === 'BD' || l.url.includes('bd-mc-fdlive'));
  
  if (hasInStream && !hasBdStream) {
    const inLinks = links.filter(l => l.url.includes('in-mc-fdlive'));
    inLinks.forEach(inLink => {
      const bdUrl = inLink.url.replace('in-mc-fdlive', 'bd-mc-fdlive');
      if (!seenUrls.has(bdUrl)) {
        seenUrls.add(bdUrl);
        links.push({
          ...inLink,
          url: bdUrl,
          label: inLink.label.replace('(IN)', '(BD)').replace(/IN$/, 'BD') || `${inLink.label} (BD)`,
          region: 'BD',
        });
      }
    });
  }
  
  // Sort: Primary first, then by region (IN, BD, WW), then others
  links.sort((a, b) => {
    if (a.label.includes('Primary')) return -1;
    if (b.label.includes('Primary')) return 1;
    if (a.region === 'IN' && b.region !== 'IN') return -1;
    if (b.region === 'IN' && a.region !== 'IN') return 1;
    if (a.region === 'BD' && b.region !== 'BD') return -1;
    if (b.region === 'BD' && a.region !== 'BD') return 1;
    return 0;
  });
  
  return links;
};

// Get primary stream URL (first available)
export const getPrimaryStreamUrl = (obj: Record<string, any>): string => {
  const links = extractStreamLinks(obj);
  return links.length > 0 ? links[0].url : '';
};
