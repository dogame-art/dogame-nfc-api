// api/artwork/[slug].js
// FIXED: Using correct @vercel/functions/oidc import

import { getVercelOidcToken } from '@vercel/functions/oidc';
import { userAgent } from '@edge-runtime/user-agent';
import { kv } from '@vercel/kv';
import { get } from '@vercel/edge-config';

export const config = {
  runtime: 'edge',
  maxDuration: 10,
};

// Rate limiting using Vercel KV (persistent across invocations)
async function checkRateLimit(ip, maxRequests = 10, windowMs = 60000) {
  const key = `rate_limit:${ip}`;
  const now = Date.now();
  
  try {
    const record = await kv.get(key);
    
    if (!record) {
      await kv.set(key, { count: 1, resetTime: now + windowMs }, { px: windowMs });
      return { allowed: true, remaining: maxRequests - 1 };
    }
    
    if (now > record.resetTime) {
      await kv.set(key, { count: 1, resetTime: now + windowMs }, { px: windowMs });
      return { allowed: true, remaining: maxRequests - 1 };
    }
    
    if (record.count >= maxRequests) {
      return { 
        allowed: false, 
        remaining: 0,
        resetTime: record.resetTime 
      };
    }
    
    const newCount = record.count + 1;
    await kv.set(key, { count: newCount, resetTime: record.resetTime }, { px: record.resetTime - now });
    
    return { 
      allowed: true, 
      remaining: maxRequests - newCount 
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true, remaining: maxRequests - 1 };
  }
}

export default async function handler(req) {
  const { slug } = req.query || {};
  const ua = userAgent(req);
  
  // 1. Bot Protection
  if (ua.isBot) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // 2. Get client IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
             req.headers.get('x-real-ip') || 
             'unknown';
  
  // 3. Rate Limiting
  const rateLimit = await checkRateLimit(ip);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded',
      retry_after: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
      },
    });
  }
  
  // 4. Bearer Token Authentication
  const authHeader = req.headers.get('authorization');
  const validToken = process.env.NFC_AUTH_TOKEN;
  
  if (!authHeader || authHeader !== `Bearer ${validToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // 5. Validate slug parameter
  if (!slug || typeof slug !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid artwork slug' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  try {
    // 6. Fetch artwork from Edge Config
    const artwork = await get(slug);
    
    if (!artwork) {
      return new Response(JSON.stringify({ 
        error: 'Artwork not found',
        slug: slug 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // 7. Optional: Generate OIDC token for machine-to-machine auth
    let oidcToken = null;
    if (ua.browser?.name === 'ArtCalendar' || req.headers.get('x-device-type') === 'arduino') {
      try {
        oidcToken = await getVercelOidcToken();
      } catch (error) {
        console.warn('OIDC token generation failed:', error);
      }
    }
    
    // 8. Return artwork data
    return new Response(JSON.stringify({
      success: true,
      slug: slug,
      ...artwork,
      access_timestamp: Date.now(),
      rate_limit_remaining: rateLimit.remaining,
      ...(oidcToken && { oidc_token: oidcToken })
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        'X-Rate-Limit-Remaining': rateLimit.remaining.toString(),
      },
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
