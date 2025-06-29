const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const b2Storage = require('../services/b2Storage-simple');
const Media = require('../models/Media');

const router = express.Router();

// 配置临时文件上传
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp/'),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB 限制
  },
  fileFilter: function (req, file, cb) {
    // 只允许视频文件
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持视频文件上传到B2存储!'), false);
    }
  }
});

// 应用认证中间件
router.use(authenticateToken);
router.use(requireAdmin);

// 列出B2存储桶中的所有视频文件
router.get('/', async (req, res) => {
  try {
    const { prefix = 'video/', limit = 100, marker = '' } = req.query;
    
    console.log('📹 获取B2视频列表...');
    
    // 从B2获取文件列表
    const b2Result = await b2Storage.listFiles(prefix, parseInt(limit));
    
    if (!b2Result.success) {
      console.error('B2列表获取失败:', b2Result.error);
      return res.status(500).json({
        success: false,
        message: 'B2存储访问失败: ' + b2Result.error
      });
    }
    
    // 处理文件信息，只返回视频文件
    const videoFiles = b2Result.files
      .filter(file => {
        const ext = path.extname(file.Key).toLowerCase();
        return ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].includes(ext);
      })
      .map(file => {
        // 生成下载URL
        const downloadUrl = `https://f005.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${file.Key}`;
        
        return {
          id: file.ETag ? file.ETag.replace(/"/g, '') : file.Key,
          fileName: file.Key,
          displayName: path.basename(file.Key),
          size: file.Size,
          lastModified: file.LastModified,
          downloadUrl: downloadUrl,
          cdnUrl: process.env.CDN_BASE_URL ? `${process.env.CDN_BASE_URL}/${file.Key}` : downloadUrl,
          type: 'video',
          storage: 'b2'
        };
      })
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    console.log(`✅ B2视频列表获取成功: ${videoFiles.length} 个文件`);
    
    res.json({
      success: true,
      data: {
        videos: videoFiles,
        total: videoFiles.length,
        hasMore: b2Result.files.length >= parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('获取B2视频列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取视频列表失败: ' + error.message
    });
  }
});

// 上传视频到B2存储
router.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的视频文件'
      });
    }

    const { title, description = '' } = req.body;
    const file = req.file;
    
    console.log(`🚀 开始上传视频到B2: ${file.originalname}`);
    console.log(`📁 临时文件路径: ${file.path}`);
    console.log(`📊 文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

    // 检查文件大小
    if (file.size > 500 * 1024 * 1024) {
      // 清理临时文件
      fs.unlinkSync(file.path);
      return res.status(413).json({
        success: false,
        message: '视频文件过大，最大支持500MB'
      });
    }

    // 上传到B2
    const uploadResult = await b2Storage.uploadFile(
      file.path,
      file.originalname,
      file.mimetype
    );

    // 清理临时文件
    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.log('⚠️ 临时文件清理失败:', err.message);
    }

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'B2上传失败: ' + uploadResult.error
      });
    }

    // 保存到数据库记录
    const media = new Media({
      title: title || path.basename(file.originalname, path.extname(file.originalname)),
      description: description,
      filename: path.basename(uploadResult.fileName),
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      cloudFileName: uploadResult.fileName,
      cloudFileId: uploadResult.fileId,
      cloudDownloadUrl: uploadResult.downloadUrl,
      cdnUrl: uploadResult.cdnUrl,
      url: uploadResult.cdnUrl || uploadResult.downloadUrl,
      type: 'video',
      uploader: req.user._id,
      cloudStatus: 'uploaded',
      cloudUploadedAt: new Date(),
      isPremiumOnly: true // B2上的视频默认付费
    });

    await media.save();

    console.log(`✅ 视频上传成功: ${file.originalname} -> ${uploadResult.fileName}`);

    res.json({
      success: true,
      message: '视频上传成功',
      data: {
        id: media._id,
        fileName: uploadResult.fileName,
        originalName: file.originalname,
        title: media.title,
        size: file.size,
        downloadUrl: uploadResult.downloadUrl,
        cdnUrl: uploadResult.cdnUrl,
        cloudFileId: uploadResult.fileId
      }
    });

  } catch (error) {
    // 清理临时文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.log('⚠️ 临时文件清理失败:', err.message);
      }
    }
    
    console.error('B2视频上传错误:', error);
    
    if (error.message.includes('只支持视频文件')) {
      return res.status(400).json({
        success: false,
        message: '只支持视频文件上传'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '视频上传失败: ' + error.message
    });
  }
});

// 删除B2存储中的视频文件
router.delete('/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    
    console.log(`🗑️ 准备删除B2视频: ${fileName}`);
    
    // 从B2删除文件
    const deleteResult = await b2Storage.deleteFile(fileName);
    
    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        message: 'B2删除失败: ' + deleteResult.error
      });
    }

    // 从数据库中删除记录
    try {
      await Media.deleteOne({ cloudFileName: fileName });
      console.log(`📝 数据库记录已删除: ${fileName}`);
    } catch (dbError) {
      console.log('⚠️ 数据库记录删除失败:', dbError.message);
    }

    console.log(`✅ B2视频删除成功: ${fileName}`);

    res.json({
      success: true,
      message: '视频删除成功'
    });

  } catch (error) {
    console.error('B2视频删除错误:', error);
    res.status(500).json({
      success: false,
      message: '视频删除失败: ' + error.message
    });
  }
});

// 生成视频下载链接
router.get('/:fileName/download', async (req, res) => {
  try {
    const { fileName } = req.params;
    const { userId } = req.query;
    
    console.log(`🔗 生成下载链接: ${fileName}`);
    
    // 生成临时下载令牌
    const tokenResult = await b2Storage.generateDownloadToken(
      fileName,
      userId || req.user._id,
      24 // 24小时有效期
    );
    
    if (!tokenResult.success) {
      return res.status(500).json({
        success: false,
        message: '生成下载链接失败: ' + tokenResult.error
      });
    }

    res.json({
      success: true,
      data: {
        downloadUrl: tokenResult.downloadUrl,
        downloadToken: tokenResult.downloadToken,
        expiresAt: tokenResult.expiresAt,
        fileName: fileName
      }
    });

  } catch (error) {
    console.error('生成下载链接错误:', error);
    res.status(500).json({
      success: false,
      message: '生成下载链接失败: ' + error.message
    });
  }
});

// 获取B2存储状态和统计信息
router.get('/stats/storage', async (req, res) => {
  try {
    console.log('📊 获取B2存储统计...');
    
    // 获取视频文件列表
    const b2Result = await b2Storage.listFiles('video/', 1000);
    
    if (!b2Result.success) {
      return res.status(500).json({
        success: false,
        message: 'B2存储访问失败: ' + b2Result.error
      });
    }

    // 统计信息
    const videoFiles = b2Result.files.filter(file => {
      const ext = path.extname(file.Key).toLowerCase();
      return ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'].includes(ext);
    });

    const totalSize = videoFiles.reduce((sum, file) => sum + (file.Size || 0), 0);
    const totalSizeGB = (totalSize / (1024 * 1024 * 1024)).toFixed(2);

    const stats = {
      connected: b2Storage.isConnected,
      bucketName: process.env.B2_BUCKET_NAME,
      totalVideos: videoFiles.length,
      totalSize: totalSize,
      totalSizeGB: totalSizeGB,
      largestFile: videoFiles.length > 0 ? Math.max(...videoFiles.map(f => f.Size || 0)) : 0,
      oldestFile: videoFiles.length > 0 ? Math.min(...videoFiles.map(f => new Date(f.LastModified).getTime())) : null,
      newestFile: videoFiles.length > 0 ? Math.max(...videoFiles.map(f => new Date(f.LastModified).getTime())) : null
    };

    console.log('✅ B2存储统计获取成功');

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取B2存储统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取存储统计失败: ' + error.message
    });
  }
});

module.exports = router; 