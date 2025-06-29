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
          embedUrl: '$url'
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

    // 统一走 /vod/video/:filename，让 VOD 路由自动处理本地/云端与签名。
    let playUrl;
    if (videoData.streamUrl) {
      playUrl = videoData.streamUrl; // 已完成HLS
    } else if (videoData.cdnUrl && videoData.cdnUrl.startsWith('http')) {
      playUrl = videoData.cdnUrl; // 走CDN MP4
    } else {
      const fileKey = videoData.cloudFileName || videoData.filename;
      playUrl = `/vod/video/${fileKey}`; // 本地或签名MP4
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