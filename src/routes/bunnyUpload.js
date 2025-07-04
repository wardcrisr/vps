const express = require('express');
const multer = require('multer');
const bunny = require('../../bunny');
const Media = require('../models/Media');

const router = express.Router();
const upload = multer();

// POST /api/bunny-upload
router.post('/', upload.single('video'), async (req, res) => {
  try {
    // 校验 Bunny Stream 凭证，若缺失则直接返回
    if (!process.env.BUNNY_API_KEY || !process.env.BUNNY_VIDEO_LIBRARY) {
      console.error('[bunny-upload] 缺少 BUNNY_API_KEY 或 BUNNY_VIDEO_LIBRARY 环境变量');
      return res.status(500).json({
        success: false,
        error: '服务器未配置 Bunny Stream 凭证(BUNNY_API_KEY / BUNNY_VIDEO_LIBRARY)'
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file uploaded' });
    }

    const { title = req.file.originalname, description = '' } = req.body;

    // 1. 创建视频条目
    const { guid: videoId } = await bunny.createVideo({ title });

    // 2. 上传二进制内容
    await bunny.uploadVideo(videoId, req.file.buffer, req.file.mimetype);

    // 生成基础 embedUrl（无签名）
    const embedUrl = `https://iframe.mediadelivery.net/embed/${process.env.BUNNY_VIDEO_LIBRARY}/${videoId}`;

    // 保存到数据库
    try {
      const media = new Media({
        title: title.split('.')[0],
        description,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: embedUrl,
        type: 'video',
        uploader: req.user ? req.user._id : null,
        cloudStatus: 'uploaded',
        cloudFileName: videoId,
        cloudFileId: videoId,
        cdnUrl: embedUrl,
        bunnyId: videoId,
        cloudUploadedAt: new Date()
      });
      await media.save();
      console.log(`🎬 Bunny 视频已保存到数据库: ${videoId}`);
    } catch (dbErr) {
      console.error('保存媒体记录失败:', dbErr);
      // 不阻断上传返回
    }

    res.json({ success: true, videoId, embedUrl });
  } catch (err) {
    console.error('Bunny upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 