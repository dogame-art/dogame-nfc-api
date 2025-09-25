const artworks = {
  'WindowShopping': {
    title: "Window Shopping",
    image_url: "https://dogame.art/art/image9.jpeg",
    description: "Sometimes it is nice to look at it before you buy it.",
    exclusive: true,
    display_duration: 30000,
    owner_authenticated: true
  }
};

export default function handler(req, res) {
  const { slug } = req.query;
  const artwork = artworks[slug];
  
  if (!artwork) {
    return res.status(404).json({
      error: "Artwork not found",
      available_artworks: Object.keys(artworks)
    });
  }
  
  // Log access for analytics
  console.log(`Artwork ${slug} accessed at ${new Date().toISOString()}`);
  
  res.json({
    success: true,
    ...artwork,
    access_timestamp: Date.now()
  });
}
