const express = require('express');
const crypto = require('crypto');
const bunny = require('../../bunny');
const Media = require('../models/Media');
const router = express.Router();

// POST /api/bunny-sign  { title }
router.post('/', async (req, res) => {
  try {
    const { title = 'untitled' } = req.body;
    // 1. 创建视频对象
    const { guid: videoId } = await bunny.createVideo({ title });

    const libraryId = process.env.BUNNY_VIDEO_LIBRARY;
    const apiKey = process.env.BUNNY_API_KEY;
    const expires = Math.floor(Date.now() / 1000) + 3600; // 1h

    const sigPayload = `${libraryId}${apiKey}${expires}${videoId}`;
    const signature = crypto.createHash('sha256').update(sigPayload).digest('hex');

    res.json({
      success: true,
      videoId,
      libraryId,
      expires,
      signature,
      tusUrl: 'https://video.bunnycdn.com/tusupload'
    });
  } catch (err) {
    console.error('bunny sign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 