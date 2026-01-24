/**
 * Stream Link Extractor
 * Extracts multiple stream URLs from various JSON field formats
 */

export interface StreamLink {
  url: string;
  label: string;
  quality?: string;
  region?: string;
  type?: string;
}

// Common field names for stream URLs
const STREAM_FIELDS = [
  'adfree_url', 'adFreeUrl', 'adfree',
  'dai_url', 'daiUrl', 'dai',
  'stream_url', 'streamUrl', 'stream',
  'url', 'link', 'src', 'source',
  'hls_url', 'hlsUrl', 'hls',
  'm3u8', 'm3u8_url',
  'video_url', 'videoUrl', 'video',
  'play_url', 'playUrl', 'play',
  'live_url', 'liveUrl', 'live',
  'embed_url', 'embedUrl', 'embed',
  'iframe_url', 'iframeUrl', 'iframe',
];

// Generate label from field name
const getLabelFromField = (field: string): string => {
  const labels: Record<string, string> = {
    'adfree_url': 'Ad-Free',
    'adFreeUrl': 'Ad-Free',
    'adfree': 'Ad-Free',
    'dai_url': 'DAI',
    'daiUrl': 'DAI',
    'dai': 'DAI',
    'stream_url': 'Stream',
    'streamUrl': 'Stream',
    'hls_url': 'HLS',
    'hlsUrl': 'HLS',
    'm3u8': 'M3U8',
    'embed_url': 'Embed',
    'iframe_url': 'Iframe',
  };
  
  return labels[field] || field.replace(/_url$/i, '').replace(/([A-Z])/g, ' $1').trim();
};

// Extract all stream URLs from an object
export const extractStreamLinks = (obj: Record<string, any>): StreamLink[] => {
  const links: StreamLink[] = [];
  const seenUrls = new Set<string>();
  
  // Check direct stream fields
  for (const field of STREAM_FIELDS) {
    const value = obj[field];
    if (value && typeof value === 'string' && value.startsWith('http') && !seenUrls.has(value)) {
      seenUrls.add(value);
      links.push({
        url: value,
        label: getLabelFromField(field),
        region: value.includes('bd-mc-fdlive') ? 'BD' : value.includes('in-mc-fdlive') ? 'IN' : undefined,
      });
    }
  }
  
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
        } else if (typeof item === 'object') {
          url = item.url || item.link || item.src || item.stream_url || '';
          label = item.label || item.name || item.title || item.quality || `Stream ${index + 1}`;
        }
        
        if (url && url.startsWith('http') && !seenUrls.has(url)) {
          seenUrls.add(url);
          links.push({
            url,
            label,
            quality: item?.quality || item?.resolution,
            region: item?.region,
            type: item?.type,
          });
        }
      });
    }
  }
  
  // Check nested objects like "in", "bd", "ww" regions
  const regionKeys = ['in', 'bd', 'ww', 'india', 'bangladesh', 'worldwide', 'IN', 'BD', 'WW'];
  for (const regionKey of regionKeys) {
    if (obj[regionKey] && typeof obj[regionKey] === 'object') {
      const regionLinks = extractStreamLinks(obj[regionKey]);
      regionLinks.forEach(link => {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          links.push({
            ...link,
            label: `${link.label} (${regionKey.toUpperCase()})`,
            region: regionKey.toUpperCase().slice(0, 2) as 'BD' | 'IN',
          });
        }
      });
    }
    
    // Also check for direct region URLs like "in_url", "bd_url"
    const regionUrl = obj[`${regionKey}_url`] || obj[`${regionKey}Url`];
    if (regionUrl && typeof regionUrl === 'string' && !seenUrls.has(regionUrl)) {
      seenUrls.add(regionUrl);
      links.push({
        url: regionUrl,
        label: regionKey.toUpperCase(),
        region: regionKey.toUpperCase().slice(0, 2),
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
          label: `${inLink.label} (BD)`,
          region: 'BD',
        });
      }
    });
  }
  
  return links;
};

// Get primary stream URL (first available)
export const getPrimaryStreamUrl = (obj: Record<string, any>): string => {
  const links = extractStreamLinks(obj);
  return links.length > 0 ? links[0].url : '';
};
