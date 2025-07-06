// src/routes/videosApi.js
console.log('[VIDEOS API MODULE] loaded');

const express = require('express');
const axios   = require('axios');
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

    // 1. 拉取 Bunny 视频列表
    const listResp = await axios.get(
      `https://api.bunny.net/library/${LIB_ID}/videos?page=1&perPage=50`,
      { headers: { AccessKey: ACCESS_KEY } }
    );
    const videos = listResp.data.items || [];

    // 打印示例，确认拿到 guid
    console.log(
      '[BUNNY LIST SAMPLE]',
      videos.slice(0, 5).map(v => ({
        mongoId: v.id || v._id,
        guid:    v.guid,
        title:   v.title
      }))
    );

    // 2. 直接拼接静态封面 URL
    const processed = videos.map(v => {
      const obj = typeof v.toObject === 'function' ? v.toObject() : v;
      delete obj.coverUrl;             // 去掉旧封面字段
      delete obj.thumbnail;            // 同样删除 thumbnail
      obj.previewUrl = `https://${STATIC_PULL_ZONE}/${v.guid}/preview.webp`;
      return obj;
    });

    // 调试断言：确保输出无旧字段
    if (processed.some(x => x.coverUrl || x.thumbnail)) {
      console.warn('❌ videosApi still contains cover/thumbnail');
    }

    // 3. 返回结果
    return res.json({ success: true, videos: processed });

  } catch (e) {
    console.error('[VIDEOS API] 处理异常:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
