const express = require('express');
const bunny = require('../../bunny');
const router = express.Router();

// GET /api/bunny-embed/:videoId
router.get('/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    if (!videoId) return res.status(400).json({ success: false, message: 'Missing videoId' });

    const expires = Math.floor(Date.now() / 1000) + 3600; // 1h
    const token = bunny.generateEmbedToken(videoId, expires);
    const embedUrl = `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_VIDEO_LIBRARY}/${videoId}?token=${token}&expires=${expires}`;

    res.json({ success: true, embedUrl });
  } catch (err) {
    console.error('Generate embed url error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 