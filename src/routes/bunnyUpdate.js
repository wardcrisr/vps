const express = require('express');
const router = express.Router();
const Media = require('../models/Media');

// POST /api/bunny-update/:videoId { size, mimetype }
router.post('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { size = 0, mimetype = 'video/mp4' } = req.body;

    const media = await Media.findOne({ bunnyId: videoId });
    if (!media) {
      return res.status(404).json({ success: false, message: '记录不存在' });
    }

    media.size = size;
    media.mimetype = mimetype;
    media.cloudStatus = 'uploaded';
    await media.save();

    res.json({ success: true });
  } catch (err) {
    console.error('bunny update error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 