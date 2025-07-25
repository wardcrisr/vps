const express = require('express');
const fs = require('fs');
const path = require('path');
const Media = require('../models/Media');
// B2直传服务已移除
const router = express.Router();

// 视频目录路径
const VIDEOS_DIR = path.join(__dirname, '../../videos');

// 确保视频目录存在
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// 获取视频文件列表 - 合并本地文件和数据库记录（支持 ?category=<free|paid|member>）
router.get('/videos', async (req, res) => {
  try {
    const { category } = req.query;
    // 1. 获取本地videos目录中的文件
    const localFiles = [];
    if (fs.existsSync(VIDEOS_DIR)) {
      const files = fs.readdirSync(VIDEOS_DIR)
        .filter(file => file.endsWith('.mp4'))
        .map(file => {
          const stat = fs.statSync(path.join(VIDEOS_DIR, file));
          return {
            filename : file,
            name     : file.replace('.mp4', ''),
            url      : `/vod/video/${file}`,
            thumbnail: '/api/placeholder/video-thumbnail',
            views    : 0,
            size     : stat.size,
            source   : 'local',
            createdAt: stat.birthtime || stat.mtime,  // 使用文件创建时间或修改时间
            uploadDate: stat.mtime  // 使用文件修改时间作为上传时间
          };
        });
      localFiles.push(...files);
    }

    // 2. 获取数据库中的视频记录
    const dbQuery = {
      type: 'video',
      cloudStatus: { $in: ['uploaded', 'local', 'failed'] }
    };
    if (category && ['free', 'paid', 'member'].includes(category)) {
      dbQuery.category = category; // 严格相等匹配
    }

    const dbVideos = await Media.find(dbQuery).populate('uploader', 'username displayName _id avatarUrl').sort({ createdAt: -1 });

    const dbVideoList = dbVideos.map(video => {
      const obj = {
        _id      : video._id,          // 添加MongoDB ID
        id       : video._id,          // 兼容前端使用 id 字段
        filename : video.cloudFileName || video.filename,
        name     : video.title,
        title    : video.title,        // 添加title字段
        url      : video.url.startsWith('http') ? video.url : `/uploads/${video.filename}`,
        playUrl  : video.url.startsWith('http') ? video.url : `/vod/video/${video.filename}`,
        bunnyId  : video.bunnyId || video.cloudFileName, // Bunny Stream ID
        guid     : video.bunnyId || video.guid,           // 兼容guid字段
        embedUrl : video.url.startsWith('http') ? video.url : undefined,
        views    : video.views || 0,
        size     : video.size,
        source   : video.cloudStatus === 'uploaded' ? 'cloud' : 'upload',
        mimetype : video.mimetype,
        duration : video.duration || 0,  // 添加时长字段
        createdAt: video.createdAt,     // 添加创建时间字段
        uploadDate: video.updatedAt || video.createdAt,  // 添加上传时间字段
        
        // 添加付费相关字段
        category       : video.category || 'free',                    // 视频分类
        isPremiumOnly  : video.isPremiumOnly || false,                // 是否仅付费用户可访问
        priceCoins     : video.priceCoins || 0,                      // 金币价格
        priceCoin      : video.priceCoins || 0,                      // 前端兼容字段
        isPaid         : video.isPremiumOnly || video.category === 'paid' || (video.priceCoins && video.priceCoins > 0),  // 是否付费视频
        downloadPrice  : video.downloadPrice || 0,                   // 下载价格
        
        // 上传者信息
        uploader: video.uploader ? {
          _id: video.uploader._id,
          username: video.uploader.username || video.uploader.displayName || '匿名用户',
          displayName: video.uploader.displayName || video.uploader.username || '匿名用户',
          avatarUrl: video.uploader.avatarUrl || ''
        } : null,
        uploaderInfo: video.uploader ? {
          _id: video.uploader._id,
          username: video.uploader.username || video.uploader.displayName || '匿名用户',
          displayName: video.uploader.displayName || video.uploader.username || '匿名用户',
          avatarUrl: video.uploader.avatarUrl || ''
        } : null
      };
      
      // 添加 previewUrl 字段，基于 bunnyId 或 guid
      if (video.bunnyId || video.guid) {
        const videoGuid = video.bunnyId || video.guid;
        // 统一：previewUrl 指向 MP4 动画，previewImage 指向静态 WEBP
        obj.previewUrl   = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.mp4`;
        obj.previewImage = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.webp`;
      }
      
      return obj;
    });

    // 3. 合并并去重（按 MongoDB _id 或 filename 去重）
    const allVideosMap = new Map();

    [...localFiles, ...dbVideoList].forEach(v => {
      const key = v._id ? v._id.toString() : v.filename;
      if (!allVideosMap.has(key)) {
        allVideosMap.set(key, v);
      }
    });

    const allVideos = Array.from(allVideosMap.values());
    
    // 调试断言：确保输出无旧字段
    if (allVideos.some(x => x.coverUrl || x.thumbnail)) {
      console.warn('❌ vod API still contains cover/thumbnail');
    }
    
    console.log(`📹 VOD API: 返回 ${allVideos.length} 个视频 (本地: ${localFiles.length}, 数据库: ${dbVideoList.length})`);
    
    // 调试：显示部分视频的付费信息
    if (allVideos.length > 0) {
      const sampleVideo = allVideos[0];
      console.log('示例视频付费信息:', {
        title: sampleVideo.title,
        category: sampleVideo.category,
        isPaid: sampleVideo.isPaid,
        priceCoin: sampleVideo.priceCoin,
        priceCoins: sampleVideo.priceCoins,
        isPremiumOnly: sampleVideo.isPremiumOnly,
        uploader: sampleVideo.uploaderInfo?.username
      });
    }
    
    res.json({
      success: true,
      videos: allVideos
    });
  } catch (error) {
    console.error('获取视频列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取视频列表失败'
    });
  }
});

// 视频流式传输路由 - 支持Range请求和云端视频
// 允许文件名包含任意字符（如含目录、特殊符号），使用 (.*) 正则以兼容 path-to-regexp v6
router.get('/video/:filename(.*)', async (req, res) => {
  try {
    const filename = req.params.filename; // 使用参数名
    const filePath = path.join(VIDEOS_DIR, filename);
    
    // 首先检查是否为本地文件
    if (fs.existsSync(filePath)) {
      // 本地文件处理（原有逻辑）
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        const file = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': 'video/mp4',
          'Cache-Control': 'public, max-age=31536000',
        });
        
        file.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
        });
        
        fs.createReadStream(filePath).pipe(res);
      }
      
      console.log(`本地视频: ${filename}, Range: ${range || 'full'}, Size: ${fileSize}`);
      return;
    }
    
    // 如果本地没有，查找数据库中的云端视频
    const media = await Media.findOne({
      $or: [
        { filename: filename },
        { cloudFileName: filename },
        { cloudFileName: { $regex: filename.replace(/\.[^/.]+$/, "") } } // 匹配不带扩展名的部分
      ],
      type: 'video'
    });
    
    if (media) {
      // B2服务已移除，使用原始URL（如果可用）

      // 回退：如果数据库中已存储绝对 URL，则直接重定向（可能已过期，但作为兜底）
      if (media.url && media.url.startsWith('http')) {
        console.log(`重定向到云端视频 (原始): ${filename} -> ${media.url}`);
        return res.redirect(302, media.url);
      }
    }
    
    // 文件不存在
    return res.status(404).json({
      success: false,
      message: '视频文件不存在'
    });
    
  } catch (error) {
    console.error('视频流传输错误:', error);
    res.status(500).json({
      success: false,
      message: '视频播放失败'
    });
  }
});

// 视频信息API
router.get('/info/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(VIDEOS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '视频文件不存在'
      });
    }
    
    const stat = fs.statSync(filePath);
    
    res.json({
      success: true,
      info: {
        filename: filename,
        size: stat.size,
        sizeFormatted: formatFileSize(stat.size),
        created: stat.birthtime,
        modified: stat.mtime
      }
    });
    
  } catch (error) {
    console.error('获取视频信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取视频信息失败'
    });
  }
});

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router; 