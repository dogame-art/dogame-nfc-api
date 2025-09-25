export default function handler(req, res) {
  const { slug } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  
  console.log(`NFC request for ${slug} from ${userAgent}`);
  
  if (userAgent.includes('ArduinoCalendar') || userAgent.includes('ESP32')) {
    return res.json({
      type: "exclusive",
      slug: slug,
      auth_required: true,
      api_endpoint: `https://nfc.dogame.art/artwork/${slug}`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Simple redirect for phones
    return res.redirect(302, `https://dogame.art/${slug}/`);
  }
}
