export default function handler(req, res) {
  const { slug } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  
  // Log the request for debugging
  console.log(`NFC request for ${slug} from ${userAgent}`);
  
  // Detect Arduino calendar device
  if (userAgent.includes('ArduinoCalendar') || userAgent.includes('ESP32')) {
    return res.json({
      type: "exclusive",
      slug: slug,
      auth_required: true,
      api_endpoint: `https://api.dogame.art/api/artwork/${slug}`,
      timestamp: new Date().toISOString()
    });
  } else {
    // Redirect phones/browsers to main artwork page
    return res.redirect(302, `https://dogame.art/${slug}/`);
  }
}
