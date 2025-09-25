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
    const html = `<!DOCTYPE html>
    <html>
    <head>
      <title>Window Shopping - Dogame Art</title>
      <meta property="og:title" content="Window Shopping" />
      <meta property="og:description" content="Sometimes it is nice to look at it before you buy it." />
      <meta property="og:image" content="https://dogame.art/art/image9.jpeg" />
      <meta property="og:url" content="https://dogame.art/WindowShopping/" />
      <meta http-equiv="refresh" content="0; url=https://dogame.art/WindowShopping/" />
    </head>
    <body>
      <p>Redirecting to artwork...</p>
    </body>
    </html>`;
    
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }
}
