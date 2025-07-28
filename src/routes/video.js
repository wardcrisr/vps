const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Media = require('../models/Media');
const User = require('../models/User');
const { optionalAuth } = require('./middleware/auth');

/**
 * 视频详情页 - 兼容/video/:id路由
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const videoId = req.params.id;
    
    // 校验 ObjectId 格式
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).render('error', {
        title: '无效的视频ID',
        message: '视频ID格式错误',
        user: req.user || null
      });
    }
    
    // 直接使用populate方式查询，和主页保持一致
    const videoData = await Media.findById(videoId).populate('uploader', 'username displayName _id avatarUrl uid name');
    
    if (!videoData) {
      return res.status(404).render('error', {
        message: '视频不存在',
        user: req.user
      });
    }

    // 转换为前端需要的格式
    const video = {
      _id: videoData._id,
      id: videoData._id,
      title: videoData.title,
      description: videoData.description,
      coverUrl: videoData.coverUrl || videoData.thumbnail,
      url: videoData.url,
      duration: videoData.duration,
      views: videoData.views,
      likes: videoData.likes,
      danmakuCount: videoData.danmakuCount,
      isPremiumOnly: videoData.isPremiumOnly,
      createdAt: videoData.createdAt,
      uploader: videoData.uploader,
      up: videoData.uploader ? {
        uid: videoData.uploader._id,
        name: videoData.uploader.name || videoData.uploader.displayName || videoData.uploader.username || '匿名用户',
        avatarUrl: videoData.uploader.avatarUrl
      } : null,
      streamUrl: videoData.streamUrl,
      hlsStatus: videoData.hlsStatus,
      cloudFileName: videoData.cloudFileName,
      cdnUrl: videoData.cdnUrl,
      bunnyId: videoData.bunnyId,
      embedUrl: videoData.url,
      priceCoins: videoData.priceCoins,
      category: videoData.category,
      filename: videoData.filename
    };

    console.log('[debug] video.uploader=', video.uploader);

    // description 回退到标题
    if (!video.description || video.description.trim() === '') {
      console.warn(`[video-detail] Video ${videoId} 缺少描述，已回退为标题`);
      video.description = video.title;
    }

    // 确保 coverUrl 字段存在
    if (!video.coverUrl && video.thumbnail) {
      video.coverUrl = video.thumbnail;
    }

    // canonical URL
    const canonicalUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    
    // 增加播放次数
    await Media.findByIdAndUpdate(videoId, {
      $inc: { views: 1 }
    });

    let relatedVideos = [];
    // 优先同UP主的视频
    if (video.uploader) {
      relatedVideos = await Media.find({
      type: 'video',
      isPublic: true,
        uploader: video.uploader._id,
      _id: { $ne: videoId }
    })
      .populate('uploader', 'username displayName _id avatarUrl')
    .sort({ createdAt: -1 })
    .limit(8)
      .select('_id title coverUrl thumbnail duration views description bunnyId guid uploader');
    }

    // 若不足8条，直接按现有数量返回，不混入其他UP主视频

    // 为相关视频添加预览URL和uploader信息，和主页保持一致
    relatedVideos = relatedVideos.map(v => {
      const obj = v.toObject();
      if (obj.bunnyId || obj.guid) {
        const guid = obj.bunnyId || obj.guid;
        const base = `https://vz-48ed4217-ce4.b-cdn.net/${guid}/preview.webp`;
        obj.previewImage = base;
        obj.previewUrl   = base;  // 统一使用 Bunny 生成的 WebP 动图
      }
      // 添加uploader信息
      if (obj.uploader) {
        obj.up = {
          uid: obj.uploader._id,
          name: obj.uploader.name || obj.uploader.displayName || obj.uploader.username || '匿名用户',
          avatarUrl: obj.uploader.avatarUrl
        };
      }
      return obj;
    });

    // 生成可播放地址：按优先级依次使用 streamUrl → cdnUrl → url → /vod/video/:filename
    let playUrl = null;

    if (video.streamUrl) {
      playUrl = video.streamUrl; // HLS 已就绪
    } else if (video.cdnUrl && video.cdnUrl.startsWith('http')) {
      playUrl = video.cdnUrl; // CDN MP4
    } else if (video.url) {
      playUrl = video.url; // 原始 URL（/uploads/... 或外链）
    }

    // 对于本地未签名 MP4，再统一走 VOD 代理，以支持 Range
    if (!playUrl) {
      const fileKey = video.cloudFileName || video.filename;
      if (fileKey) {
        playUrl = `/vod/video/${encodeURIComponent(fileKey)}`;
      }
    }

    // 对 Bunny Stream 嵌入（可能403）自动添加签名 token（免费视频无需购买）
    if (playUrl && playUrl.includes('iframe.mediadelivery.net/embed') && process.env.BUNNY_SECRET) {
      const crypto = require('crypto');
      try {
        const expires = Math.floor(Date.now() / 1000) + 3600 * 24 * 7; // 7 天
        const raw     = `${process.env.BUNNY_SECRET}${video.bunnyId}${expires}`;
        const token   = crypto.createHash('sha256').update(raw).digest('hex');
        if(!playUrl.includes('token=')){
          playUrl += `${playUrl.includes('?') ? '&' : '?'}token=${token}&expires=${expires}`;
        }
      } catch(e) { console.error('生成 Bunny 签名失败', e); }
    }

    if (!playUrl) {
      playUrl = '';
    }

    res.render('video-detail', {
      title: video.title,
      video: { ...video, playUrl },
      relatedVideos,
      canonicalUrl,
      user: req.user || null,
      layout: false
    });

  } catch (error) {
    console.error('视频详情页错误:', error);
    res.status(500).render('error', {
      title: '服务器错误',
      message: '页面加载失败，请稍后重试',
      user: req.user || null,
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

module.exports = router; 