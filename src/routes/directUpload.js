const express = require('express');
const router = express.Router();
const b2DirectUpload = require('../services/b2DirectUpload');
const Media = require('../models/Media');
const User = require('../models/User');

// 解码从S3 Metadata中获取的文件名
function decodeMetadataValue(encodedValue) {
  try {
    return Buffer.from(encodedValue, 'base64').toString('utf8');
  } catch (error) {
    console.warn('解码metadata失败，使用原值:', encodedValue);
    return encodedValue;
  }
}

/**
 * POST /api/direct-upload/create
 * 创建多段上传并返回预签名URL
 */
router.post('/create', async (req, res) => {
  try {
    const { fileName, fileSize, mimeType, chunkSize } = req.body;
    
    // 参数验证
    if (!fileName || !fileSize || !mimeType) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: fileName, fileSize, mimeType'
      });
    }

    // 文件大小验证
    const maxSize = mimeType.startsWith('video/') ? 2 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 视频2GB，图片100MB
    if (fileSize > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return res.status(413).json({
        success: false,
        error: 'FileTooLarge',
        message: `文件过大，${mimeType.startsWith('video/') ? '视频' : '图片'}文件最大支持 ${maxSizeMB}MB`
      });
    }

    // 使用固定分片大小 20MB
    const finalChunkSize = chunkSize || 20 * 1024 * 1024;
    
    // 创建多段上传
    const createResult = await b2DirectUpload.createMultipartUpload(fileName, mimeType, finalChunkSize);
    
    if (!createResult.success) {
      return res.status(500).json({
        success: false,
        message: '创建多段上传失败: ' + createResult.error
      });
    }

    // 计算需要的分片数量
    const totalParts = Math.ceil(fileSize / finalChunkSize);
    
    // 生成所有分片的预签名URL
    const urlsResult = await b2DirectUpload.generateMultiplePartUploadUrls(
      createResult.uploadId,
      createResult.fileName,
      totalParts,
      3600 // 1小时有效期
    );

    if (!urlsResult.success) {
      // 如果生成URL失败，取消上传
      await b2DirectUpload.abortMultipartUpload(createResult.uploadId, createResult.fileName);
      return res.status(500).json({
        success: false,
        message: '生成预签名URL失败: ' + urlsResult.error
      });
    }

    console.log(`🚀 创建直传任务: ${fileName} (${totalParts} 个分片, 每片 ${(finalChunkSize/1024/1024).toFixed(1)}MB)`);

    res.json({
      success: true,
      uploadId: createResult.uploadId,
      fileName: createResult.fileName,
      key: createResult.key,
      chunkSize: finalChunkSize,
      totalParts: totalParts,
      uploadUrls: urlsResult.urls, // 包含所有分片的预签名URL
      expiresIn: 3600,
      message: `已创建 ${totalParts} 个分片的上传任务`
    });

  } catch (error) {
    console.error('创建直传任务失败:', error);
    res.status(500).json({
      success: false,
      message: '创建直传任务失败: ' + error.message
    });
  }
});

/**
 * POST /api/direct-upload/complete
 * 完成多段上传
 */
router.post('/complete', async (req, res) => {
  try {
    const { uploadId, fileName, parts, originalName, fileSize, mimeType, uploaderUid, collectionId } = req.body;
    
    // 参数验证
    if (!uploadId || !fileName || !parts || !Array.isArray(parts)) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: uploadId, fileName, parts'
      });
    }

    // 验证parts格式
    for (const part of parts) {
      if (!part.PartNumber || !part.ETag) {
        return res.status(400).json({
          success: false,
          message: '分片信息格式错误，需要 PartNumber 和 ETag'
        });
      }
    }

    console.log(`🏁 完成直传: ${fileName} (${parts.length} 个分片)`);

    // 完成多段上传
    const completeResult = await b2DirectUpload.completeMultipartUpload(uploadId, fileName, parts);
    
    if (!completeResult.success) {
      return res.status(500).json({
        success: false,
        message: '完成多段上传失败: ' + completeResult.error
      });
    }

    // 判断 originalName 是否为 Base64，并按需解码，避免中文文件名乱码
    const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;

    let decodedOriginalName = originalName;
    if (originalName && base64Regex.test(originalName)) {
      try {
        decodedOriginalName = decodeMetadataValue(originalName);
      } catch (e) {
        decodedOriginalName = originalName; // 解码失败则使用原值
      }
    }
    
    // 确定归属UP主
    let targetUploaderId = req.user ? req.user.id : null;
    if (uploaderUid) {
      const targetUser = await User.findOne({ uid: uploaderUid });
      if (!targetUser) {
        return res.status(400).json({ success: false, message: '指定的UP主不存在' });
      }
      targetUploaderId = targetUser._id;
    }

    // 保存到数据库
    const type = mimeType.startsWith('image/') ? 'image' : 'video';
    const media = new Media({
      title: decodedOriginalName ? decodedOriginalName.split('.')[0] : fileName.split('.')[0],
      filename: fileName,
      originalName: decodedOriginalName || fileName,
      mimetype: mimeType,
      size: fileSize,
      path: null, // 直传文件不保存本地路径
      url: completeResult.cdnUrl || completeResult.downloadUrl,
      type: type,
      uploader: targetUploaderId,
      cloudStatus: 'uploaded',
      cloudFileName: fileName,
      cloudFileId: completeResult.etag,
      cloudDownloadUrl: completeResult.downloadUrl,
      cdnUrl: completeResult.cdnUrl,
      cloudUploadedAt: new Date(),
      isPremiumOnly: type === 'video', // 视频默认付费
      uploadMethod: 'direct', // 标记为直传
      collectionId: collectionId
    });

    await media.save();

    console.log(`✅ 直传文件已保存到数据库: ${originalName} -> ${fileName}`);

    // 自动截帧生成封面
    if (type === 'video') {
      try {
        const { generateThumbnail } = require('../services/videoProcessor');
        const thumbRes = await generateThumbnail(fileName, { timestamp: 3 });
        media.thumbnail = thumbRes.thumbUrl;
        media.coverUrl = thumbRes.thumbUrl;
        await media.save();
        console.log(`🖼️ 已生成视频封面 ${thumbRes.thumbKey}`);
      } catch (thumbErr) {
        console.error('生成封面失败:', thumbErr.message);
      }
    }

    // 如果传入 collectionId，则加入合集
    if (collectionId) {
      const Collection = require('../models/Collection');
      try {
        await Collection.findByIdAndUpdate(collectionId, {
          $addToSet: { videoIds: media._id }
        });
      } catch (e) {
        console.warn('添加到合集失败:', e.message);
      }
    }

    res.json({
      success: true,
      message: '文件上传完成',
      file: media,
      downloadUrl: completeResult.downloadUrl,
      cdnUrl: completeResult.cdnUrl
    });

  } catch (error) {
    console.error('完成直传失败:', error);
    res.status(500).json({
      success: false,
      message: '完成直传失败: ' + error.message
    });
  }
});

/**
 * GET /api/direct-upload/download/:filename
 * 生成2小时有效的下载预签名URL
 */
router.get('/download/:filename(.*)', async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.filename);
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: '缺少文件key参数'
      });
    }

    // 检查文件是否存在于数据库
    const media = await Media.findOne({ cloudFileName: fileName });
    
    if (!media) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 如果是付费内容，需要验证用户权限
    if (media.isPremiumOnly) {
      // TODO: 这里应该添加用户权限验证
      // if (!req.user || !req.user.isPremium) {
      //   return res.status(403).json({
      //     success: false,
      //     message: '此内容需要付费会员权限'
      //   });
      // }
      console.log('⚠️ TODO: 验证付费用户权限');
    }

    // 生成2小时有效的下载URL
    const downloadResult = await b2DirectUpload.generateDownloadUrl(fileName, 7200);
    
    if (!downloadResult.success) {
      return res.status(500).json({
        success: false,
        message: '生成下载链接失败: ' + downloadResult.error
      });
    }

    console.log(`🔗 生成下载链接: ${fileName} (有效期2小时)`);

    res.json({
      success: true,
      downloadUrl: downloadResult.url,
      fileName: media.originalName,
      fileSize: media.size,
      mimeType: media.mimetype,
      expiresAt: downloadResult.expiresAt,
      expiresIn: downloadResult.expiresIn
    });

  } catch (error) {
    console.error('生成下载链接失败:', error);
    res.status(500).json({
      success: false,
      message: '生成下载链接失败: ' + error.message
    });
  }
});

/**
 * POST /api/direct-upload/abort
 * 取消多段上传
 */
router.post('/abort', async (req, res) => {
  try {
    const { uploadId, fileName } = req.body;
    
    if (!uploadId || !fileName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: uploadId, fileName'
      });
    }

    const abortResult = await b2DirectUpload.abortMultipartUpload(uploadId, fileName);
    
    console.log(`❌ 取消直传: ${fileName}`);

    res.json({
      success: abortResult.success,
      message: abortResult.success ? '已取消上传' : abortResult.error
    });

  } catch (error) {
    console.error('取消直传失败:', error);
    res.status(500).json({
      success: false,
      message: '取消上传失败: ' + error.message
    });
  }
});

/**
 * GET /api/direct-upload/status/:uploadId
 * 查询上传状态（可用于断点续传）
 */
router.get('/status/:uploadId', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { fileName } = req.query;
    
    if (!uploadId || !fileName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: uploadId, fileName'
      });
    }

    // TODO: 实现查询已上传分片的状态
    // 这里可以调用 listParts API 来获取已上传的分片信息
    
    res.json({
      success: true,
      message: 'TODO: 实现上传状态查询',
      uploadId: uploadId,
      fileName: fileName
    });

  } catch (error) {
    console.error('查询上传状态失败:', error);
    res.status(500).json({
      success: false,
      message: '查询上传状态失败: ' + error.message
    });
  }
});

module.exports = router; 