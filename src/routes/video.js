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
    
    // 查询视频信息并联表UP主信息
    const video = await Media.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(videoId),
          type: 'video'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'uploader',
          foreignField: '_id',
          as: 'uploaderInfo'
        }
      },
      {
        $unwind: {
          path: '$uploaderInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          id: '$_id',
          title: 1,
          description: 1,
          coverUrl: {
            $ifNull: ['$coverUrl', '$thumbnail']
          },
          url: 1,
          duration: 1,
          views: 1,
          likes: 1,
          danmakuCount: 1,
          isPremiumOnly: 1,
          createdAt: 1,
          up: {
            uid: '$uploaderInfo.uid',
            name: {
              $ifNull: ['$uploaderInfo.name', '$uploaderInfo.displayName', '$uploaderInfo.username']
            }
          },
          streamUrl: 1,
          hlsStatus: 1,
          cloudFileName: 1,
          cdnUrl: 1,
          bunnyId: 1,
          embedUrl: '$url',
          priceCoins: 1,
          category: 1,
          filename: 1
        }
      }
    ]);

    if (!video || video.length === 0) {
      return res.status(404).render('404', {
        title: '视频不存在',
        message: '您访问的视频不存在或已被删除',
        user: req.user || null
      });
    }

    const videoData = video[0];
    
    // 增加播放次数
    await Media.findByIdAndUpdate(videoId, {
      $inc: { views: 1 }
    });

    // 获取相关推荐视频
    const relatedVideos = await Media.find({
      type: 'video',
      isPublic: true,
      _id: { $ne: videoId }
    })
    .sort({ createdAt: -1 })
    .limit(8)
    .select('_id title coverUrl thumbnail duration views');

    // 生成可播放地址：按优先级依次使用 streamUrl → cdnUrl → url → /vod/video/:filename
    let playUrl = null;

    if (videoData.streamUrl) {
      playUrl = videoData.streamUrl; // HLS 已就绪
    } else if (videoData.cdnUrl && videoData.cdnUrl.startsWith('http')) {
      playUrl = videoData.cdnUrl; // CDN MP4
    } else if (videoData.url) {
      playUrl = videoData.url; // 原始 URL（/uploads/... 或外链）
    }

    // 对于本地未签名 MP4，再统一走 VOD 代理，以支持 Range
    if (!playUrl) {
      const fileKey = videoData.cloudFileName || videoData.filename;
      if (fileKey) {
        playUrl = `/vod/video/${encodeURIComponent(fileKey)}`;
      }
    }

    // 对 Bunny Stream 嵌入（可能403）自动添加签名 token（免费视频无需购买）
    if (playUrl && playUrl.includes('iframe.mediadelivery.net/embed') && process.env.BUNNY_SECRET) {
      const crypto = require('crypto');
      try {
        const expires = Math.floor(Date.now() / 1000) + 3600 * 24 * 7; // 7 天
        const raw     = `${process.env.BUNNY_SECRET}${videoData.bunnyId}${expires}`;
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
      title: videoData.title,
      video: { ...videoData, playUrl },
      relatedVideos,
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