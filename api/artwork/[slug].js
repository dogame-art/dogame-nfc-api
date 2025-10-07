import { kv } from '@vercel/kv';
import { get } from '@vercel/edge-config';
import { getVercelOidcToken } from '@vercel/functions/oidc';

// ============================================
// RATE LIMITING - Using Vercel KV (Persistent)
// ============================================
async function rateLimit(ip, maxRequests = 10, windowMs = 60000) {
  const key = `rate_limit:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  try {
    // Get requests within the time window
    const requests = await kv.zrangebyscore(key, windowStart, now);
    
    // Check if limit exceeded
    if (requests && requests.length >= maxRequests) {
      return false;
    }
    
    // Add new request with current timestamp as score
    await kv.zadd(key, { score: now, member: `${now}:${Math.random()}` });
    
    // Set expiration (slightly longer than window for cleanup)
    await kv.expire(key, Math.ceil(windowMs / 1000) + 60);
    
    // Clean up old entries
    await kv.zremrangebyscore(key, 0, windowStart);
    
    return true;
  } catch (error) {
    // Log error but allow request (fail open for availability)
    console.error('Rate limit error:', error);
    return true;
  }
}

// ============================================
// MAIN HANDLER
// ============================================
export default async function handler(req, res) {
  const { slug } = req.query;
  
  // ============================================
  // 1. RATE LIMITING
  // ============================================
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
             req.headers['x-real-ip'] || 
             'unknown';
  
  if (!(await rateLimit(ip))) {
    return res.status(429).json({ 
      error: 'Too many requests',
      retry_after: 60 
    });
  }
  
  // ============================================
  // 2. AUTHENTICATION
  // ============================================
  const authHeader = req.headers['authorization'];
  const validToken = process.env.NFC_AUTH_TOKEN;
  
  if (!authHeader || authHeader !== `Bearer ${validToken}`) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid Bearer token required' 
    });
  }
  
  // ============================================
  // 3. INPUT VALIDATION
  // ============================================
  // Validate slug format (alphanumeric and hyphens only)
  if (!slug || !/^[a-zA-Z0-9-]+$/.test(slug)) {
    return res.status(400).json({ 
      error: 'Invalid slug format',
      message: 'Slug must contain only letters, numbers, and hyphens'
    });
  }
  
  // ============================================
  // 4. FETCH ARTWORK FROM EDGE CONFIG
  // ============================================
  let artwork;
  try {
    artwork = await get(slug);
  } catch (error) {
    console.error('Edge Config error:', error);
    return res.status(500).json({ 
      error: 'Configuration error',
      message: 'Unable to retrieve artwork data'
    });
  }
  
  if (!artwork) {
    return res.status(404).json({ 
      error: 'Artwork not found',
      slug: slug 
    });
  }
  
  // ============================================
  // 5. OPTIONAL: OIDC TOKEN FOR MACHINE AUTH
  // ============================================
  let oidcToken = null;
  if (process.env.VERCEL_OIDC_TOKEN) {
    try {
      oidcToken = await getVercelOidcToken();
    } catch (error) {
      // OIDC is optional, continue without it
      console.warn('OIDC token generation failed:', error);
    }
  }
  
  // ============================================
  // 6. MINIMAL LOGGING (ONLY IN DEVELOPMENT)
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    console.log(`Artwork ${slug} accessed by ${ip}`);
  }
  
  // ============================================
  // 7. RETURN RESPONSE
  // ============================================
  return res.json({
    success: true,
    slug: slug,
    artwork: {
      title: artwork.title,
      image_url: artwork.image_url,
      description: artwork.description,
      exclusive: artwork.exclusive || false,
      display_duration: artwork.display_duration || 30000,
    },
    access_timestamp: Date.now(),
    ...(oidcToken && { oidc_token: oidcToken }),
  });
}

// ============================================
// EDGE RUNTIME CONFIGURATION
// ============================================
export const config = {
  runtime: 'edge',
  maxDuration: 10,
  regions: ['iad1'], // US East - adjust based on your users
};
