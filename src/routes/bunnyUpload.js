const express = require('express');
const multer = require('multer');
const bunny = require('../../bunny');
const Media = require('../models/Media');
const { authenticateToken, requireAdmin } = require('./middleware/auth');

const router = express.Router();
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB 上限

// 服务端中转上传（管理员专用）
// POST /api/bunny-upload  form-data: video(File), title, description, category, priceCoin, uploaderId
router.post('/', authenticateToken, requireAdmin, upload.single('video'), async (req, res) => {
  try {
    if (!process.env.BUNNY_API_KEY || !process.env.BUNNY_VIDEO_LIBRARY) {
      return res.status(500).json({ success: false, error: '未配置 Bunny 凭证' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: '缺少视频文件' });
    }

    const title = (req.body.title || req.file.originalname).toString();
    const description = (req.body.description || '').toString();
    const category = (req.body.category || 'free').toString();
    const priceCoin = Number(req.body.priceCoin || 0);
    const uploaderId = req.body.uploaderId || null;

    // 1. 创建视频条目
    const { guid: videoId } = await bunny.createVideo({ title });

    // 2. 上传二进制内容
    await bunny.uploadVideo(videoId, req.file.buffer, req.file.mimetype || 'video/mp4');

    const embedUrl = `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_VIDEO_LIBRARY}/${videoId}`;

    // 3. 保存到数据库（与前端直传保持一致字段）
    const media = await Media.findOneAndUpdate(
      { bunnyId: videoId },
      {
        title: title.split('.')[0],
        description,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: embedUrl,
        type: 'video',
        uploader: uploaderId || (req.user ? req.user._id : null),
        cloudStatus: 'uploaded',
        cloudFileName: videoId,
        cloudFileId: videoId,
        guid: videoId,
        cdnUrl: embedUrl,
        bunnyId: videoId,
        cloudUploadedAt: new Date(),
        category,
        isPremiumOnly: category === 'member',
        priceCoins: category === 'paid' ? priceCoin : 0,
        isPublic: true,
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, videoId, embedUrl, data: media });
  } catch (err) {
    console.error('Bunny upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;