// bunnywebhook.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Mongoose 模型
const Media = require('../models/Media');

// POST  /api/bunny/webhook
router.post('/webhook', async (req, res) => {
  console.log('[bunnyWebhook][ENTRY] body:', req.body);
  res.status(200).json({ success: true });

  const { VideoGuid, Status } = req.body;
  if (!VideoGuid) {
    console.warn('[bunnyWebhook] Missing VideoGuid:', req.body);
    return;
  }

  if (Status < 4) {
    console.log(`[bunnyWebhook] Video ${VideoGuid} Status ${Status} – waiting for complete processing`);
    return;
  }

  try {
    console.log(`[bunnyWebhook] Processing video ${VideoGuid} with status ${Status}`);
    
    // 直接使用 axios 调用 API
    const apiKey = process.env.BUNNY_API_KEY;
    const videoLibrary = process.env.BUNNY_VIDEO_LIBRARY;
    
    console.log(`[bunnyWebhook] API Key: ${apiKey?.substring(0, 10)}...`);
    console.log(`[bunnyWebhook] Video Library: ${videoLibrary}`);
    
    const response = await axios.get(`https://video.bunnycdn.com/library/${videoLibrary}/videos/${VideoGuid}`, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    const videoInfo = response.data;
    console.log('[bunnyWebhook][DEBUG] API Response success');
    console.log('[bunnyWebhook][DEBUG] Video length:', videoInfo.length);

    // 提取时长
    const lengthInSeconds = videoInfo.length || 0;
    console.log(`[bunnyWebhook][DEBUG] Extracted duration: ${lengthInSeconds}s`);

    // 更新数据库
    const updatedMedia = await Media.findOneAndUpdate(
      { $or: [ { bunnyId: VideoGuid }, { guid: VideoGuid }, { cloudFileName: VideoGuid } ] },
      { duration: lengthInSeconds },
      { new: true }
    );
    
    if (!updatedMedia) {
      console.warn(`[bunnyWebhook] No Media found for bunnyId: ${VideoGuid}`);
    } else {
      console.log(`[bunnyWebhook] Duration updated: ${VideoGuid} → ${lengthInSeconds}s`);
      console.log(`[bunnyWebhook] Updated media: ${updatedMedia.title}`);
    }

    // 推送通知
    try {
      const io = req.app && req.app.get('io');
    if (io) {
      io.emit('video-duration-updated', { 
        videoId: VideoGuid, 
        lengthInSeconds,
        title: updatedMedia?.title 
      });
      }
    } catch (ioError) {
      console.warn('[bunnyWebhook] Socket.io notification failed:', ioError.message);
    }

  } catch (error) {
    console.error('[bunnyWebhook][ERROR]', error.message);
    console.error('[bunnyWebhook][ERROR] Stack:', error.stack);
  }
});

module.exports = router;

