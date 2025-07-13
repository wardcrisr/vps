// src/routes/videosApi.js
console.log('[VIDEOS API MODULE] loaded');

const express = require('express');
const axios   = require('axios');
const Media   = require('../models/Media');
const router  = express.Router();

router.get('/', async (req, res) => {
  console.log('[VIDEOS API] 收到请求');
  try {
    const {
      BUNNY_VIDEO_LIBRARY: LIB_ID,
      BUNNY_API_KEY:       ACCESS_KEY
    } = process.env;

    // 固定 Pull Zone（用于拼接缩略图 URL）
    const STATIC_PULL_ZONE = 'vz-48ed4217-ce4.b-cdn.net';

    console.log(
      '[ENV CHECK]',
      `LIB_ID = ${LIB_ID}`,
      `ACCESS_KEY? = ${!!ACCESS_KEY}`
    );

    if (!LIB_ID || !ACCESS_KEY) {
      return res.status(500).json({
        success: false,
        message: '缺少 Bunny 配置（LIB_ID / API_KEY）'
      });
    }

    // 1. 从数据库获取所有视频信息（包含付费信息）
    const dbVideos = await Media.find({ type: 'video' }).populate('uploader', 'username displayName _id').sort({ createdAt: -1 });

    // 2. 拉取 Bunny 视频列表
    const listResp = await axios.get(
      `https://api.bunny.net/library/${LIB_ID}/videos?page=1&perPage=50`,
      { headers: { AccessKey: ACCESS_KEY } }
    );
    const bunnyVideos = listResp.data.items || [];

    // 3. 创建 Bunny 视频的 guid 映射
    const bunnyMap = new Map();
    bunnyVideos.forEach(v => {
      if (v.guid) {
        bunnyMap.set(v.guid, v);
      }
    });

    // 4. 合并数据库信息和 Bunny 信息
    const processed = dbVideos.map(dbVideo => {
      const obj = typeof dbVideo.toObject === 'function' ? dbVideo.toObject() : dbVideo;
      
      // 查找对应的 Bunny 视频信息
      const bunnyVideo = bunnyMap.get(obj.bunnyId || obj.guid);
      
      // 合并基本信息
      if (bunnyVideo) {
        obj.duration = bunnyVideo.length || obj.duration || 0;
        obj.status = bunnyVideo.status;
        obj.thumbnailFileName = bunnyVideo.thumbnailFileName;
      }
      
      // 确保有预览图
      obj.previewUrl = `https://${STATIC_PULL_ZONE}/${obj.bunnyId || obj.guid}/preview.webp`;
      
      // 确保有付费信息字段
      obj.priceCoin = obj.priceCoins || 0;
      obj.isPaid = obj.isPremiumOnly || obj.category === 'paid' || (obj.priceCoins > 0);
      
      // 确保有上传者信息
      if (obj.uploader) {
        obj.uploaderInfo = {
          _id: obj.uploader._id,
          username: obj.uploader.username || obj.uploader.displayName || '匿名用户',
          displayName: obj.uploader.displayName || obj.uploader.username || '匿名用户'
        };
      }
      
      // 清理不需要的字段
      delete obj.coverUrl;
      delete obj.thumbnail;
      delete obj.path;
      delete obj.cloudFileId;
      delete obj.cloudDownloadUrl;
      
      return obj;
    });

    console.log(
      '[MERGED DATA SAMPLE]',
      processed.slice(0, 3).map(v => ({
        title: v.title,
        bunnyId: v.bunnyId,
        priceCoin: v.priceCoin,
        isPaid: v.isPaid,
        category: v.category,
        uploader: v.uploaderInfo?.username
      }))
    );

    // 5. 返回结果
    return res.json({ success: true, videos: processed });

  } catch (e) {
    console.error('[VIDEOS API] 处理异常:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
