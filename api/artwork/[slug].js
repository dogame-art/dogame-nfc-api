import { getVercelOidcToken } from '@vercel/functions/oidc';

// In-memory rate limiting (consider using Vercel KV for production)
const requests = new Map();

function rateLimit(ip, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  
  if (!requests.has(ip)) {
    requests.set(ip, []);
  }
  
  const userRequests = requests.get(ip);
  const recentRequests = userRequests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return false;
  }
  
  recentRequests.push(now);
  requests.set(ip, recentRequests);
  return true;
}

// Move to environment variables
const getArtworks = () => ({
  'WindowShopping': {
    title: process.env.ARTWORK_WINDOWSHOPPING_TITLE,
    image_url: process.env.ARTWORK_WINDOWSHOPPING_IMAGE,
    description: process.env.ARTWORK_WINDOWSHOPPING_DESC,
    exclusive: true,
    display_duration: 30000,
    owner_authenticated: true
  }
});

export default async function handler(req, res) {
  const { slug } = req.query;
  
  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  // Validate Bearer token
  const authHeader = req.headers['authorization'];
  const validToken = process.env.NFC_AUTH_TOKEN;
  
  if (!authHeader || authHeader !== `Bearer ${validToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const artworks = getArtworks();
  const artwork = artworks[slug];
  
  if (!artwork) {
    return res.status(404).json({ error: "Artwork not found" });
  }
  
  // Minimal logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Artwork ${slug} accessed`);
  }
  
  return res.json({
    success: true,
    ...artwork,
    access_timestamp: Date.now()
  });
}

export const config = {
  runtime: 'edge',
  maxDuration: 10,
};
