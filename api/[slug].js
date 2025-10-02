import { userAgent } from '@edge-runtime/user-agent';

export default async function handler(req, res) {
  const { slug } = req.query;
  const ua = userAgent(req);
  
  // Check if it's a bot
  if (ua.isBot) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Validate auth for NFC devices
  const authToken = req.headers['authorization'];
  const validToken = process.env.NFC_AUTH_TOKEN;
  
  if (ua.browser?.name === 'ArtCalendar' || ua.ua?.includes('ESP32')) {
    // Require authentication for exclusive devices
    if (!authToken || authToken !== `Bearer ${validToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.json({
      type: "exclusive",
      slug: slug,
      auth_required: true,
      api_endpoint: `https://nfc.dogame.art/artwork/${slug}`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Regular web users get redirected
    return res.redirect(302, `https://dogame.art/${slug}/`);
  }
}

export const config = {
  runtime: 'edge', // Use Edge Runtime for better performance
};
