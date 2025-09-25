export default function handler(req, res) {
  const { slug } = req.query;
  const userAgent = req.headers['user-agent'] || '';
  
  console.log(`NFC request for ${slug} from ${userAgent}`);
  
  if (userAgent.includes('ArtCalendar') || userAgent.includes('ESP32')) {
    return res.json({
      type: "exclusive",
      slug: slug,
      auth_required: true,
      api_endpoint: `https://nfc.dogame.art/api/artwork/${slug}`,
      timestamp: new Date().toISOString()
    });
  } else {
    return res.redirect(302, `https://dogame.art/${slug}/`);
  }
}
