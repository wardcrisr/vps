const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class B2StorageService {
  constructor() {
    // 配置S3兼容的Backblaze B2
    this.s3 = new AWS.S3({
      endpoint: `https://${process.env.B2_ENDPOINT}`,
      accessKeyId: process.env.B2_APPLICATION_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
      region: 'us-east-005', // B2固定区域
      s3ForcePathStyle: true, // B2需要路径样式
      signatureVersion: 'v4'
    });
    
    this.bucketName = process.env.B2_BUCKET_NAME;
    this.cdnBaseUrl = process.env.CDN_BASE_URL;
    this.isConnected = false;
  }

  // 初始化B2连接
  async initialize() {
    try {
      // 测试存储桶访问
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      
      // 设置CORS策略以允许网页访问
      await this.configureCORS();
      
      console.log('✅ Backblaze B2 (S3 API) 已连接');
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Backblaze B2 连接失败:', error.message);
      // 即使B2连接失败，系统也应该能继续运行（使用本地存储）
      return false;
    }
  }

  // 配置CORS策略
  async configureCORS() {
    try {
      const corsParams = {
        Bucket: this.bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'HEAD'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3000
            }
          ]
        }
      };
      
      await this.s3.putBucketCors(corsParams).promise();
      console.log('✅ CORS策略已配置');
    } catch (error) {
      console.log('⚠️ CORS配置失败（可能已存在）:', error.message);
    }
  }

  // 生成唯一文件名
  generateFileName(originalName, type = 'video') {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    
    // 按类型和日期组织文件夹结构
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `${type}/${year}/${month}/${baseName}-${timestamp}-${randomId}${ext}`;
  }

  // 上传文件到B2
  async uploadFile(filePath, originalName, mimeType) {
    try {
      // 如果B2没有连接，跳过云端上传
      if (!this.isConnected) {
        console.log('⚠️ B2未连接，跳过云端上传');
        return {
          success: false,
          error: 'B2 not connected'
        };
      }
      
      const fileName = this.generateFileName(originalName, mimeType.startsWith('video/') ? 'video' : 'image');
      const fileBuffer = fs.readFileSync(filePath);
      
      // 使用S3兼容API上传
      const uploadParams = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
        Metadata: {
          'original-name': originalName,
          'upload-time': new Date().toISOString(),
          'file-size': fileBuffer.length.toString()
        }
      };
      
      const s3Result = await this.s3.upload(uploadParams).promise();
      
      // 生成Backblaze B2的友好下载URL
      const b2DownloadUrl = `https://f005.backblazeb2.com/file/${this.bucketName}/${fileName}`;
      
      const uploadResult = {
        success: true,
        fileId: s3Result.ETag.replace(/"/g, ''), // 移除引号
        fileName: fileName,
        downloadUrl: b2DownloadUrl, // 使用B2的友好下载URL
        cdnUrl: this.cdnBaseUrl ? `${this.cdnBaseUrl}/${fileName}` : b2DownloadUrl,
        size: fileBuffer.length,
        uploadResponse: s3Result
      };

      console.log(`✅ 文件上传成功: ${originalName} -> ${fileName}`);
      return uploadResult;
      
    } catch (error) {
      console.error('B2 上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 生成临时下载链接（付费用户专用）
  async generateDownloadToken(fileName, userId, expiresInHours = 24) {
    try {
      // 生成带签名的下载令牌
      const expirationTime = Date.now() + (expiresInHours * 60 * 60 * 1000);
      const tokenData = {
        fileName: fileName,
        userId: userId,
        expires: expirationTime,
        timestamp: Date.now()
      };
      
      // 使用JWT签名
      const jwt = require('jsonwebtoken');
      const downloadToken = jwt.sign(tokenData, process.env.JWT_SECRET, {
        expiresIn: `${expiresInHours}h`
      });

      return {
        success: true,
        downloadToken: downloadToken,
        downloadUrl: `/api/download/${downloadToken}`,
        expiresAt: new Date(expirationTime)
      };
    } catch (error) {
      console.error('生成下载令牌失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 验证下载令牌并获取文件
  async getFileWithToken(token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.expires < Date.now()) {
        throw new Error('下载链接已过期');
      }

      // 如果B2连接正常，生成预签名URL
      if (this.isConnected) {
        const params = {
          Bucket: this.bucketName,
          Key: decoded.fileName,
          Expires: 3600 // 1小时有效期
        };
        
        const downloadUrl = this.s3.getSignedUrl('getObject', params);
        
        return {
          success: true,
          fileName: decoded.fileName,
          userId: decoded.userId,
          downloadUrl: downloadUrl
        };
      } else {
        // B2未连接，返回本地URL
        return {
          success: true,
          fileName: decoded.fileName,
          userId: decoded.userId,
          downloadUrl: `/uploads/${decoded.fileName}` // 本地文件路径
        };
      }
    } catch (error) {
      console.error('验证下载令牌失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 删除文件
  async deleteFile(fileName, fileId = null) {
    try {
      if (this.isConnected) {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: fileName
        }).promise();
      }
      
      return { success: true };
    } catch (error) {
      // 如果文件不存在，也视为成功删除
      if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
        console.warn(`文件不存在，无需删除: ${fileName}`);
        return { success: true, message: '文件不存在，已跳过' };
      }
      console.error('删除文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 列出存储桶中的文件
  async listFiles(prefix = '', maxKeys = 100) {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: 'B2 not connected'
        };
      }
      
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      };
      
      const result = await this.s3.listObjectsV2(params).promise();
      return {
        success: true,
        files: result.Contents || []
      };
    } catch (error) {
      console.error('列出文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 大文件分片上传功能
  async startLargeFile(fileName, mimeType) {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: 'B2 not connected'
        };
      }

      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: mimeType,
        Metadata: {
          'upload-type': 'multipart',
          'upload-time': new Date().toISOString()
        }
      };

      const multipartUpload = await this.s3.createMultipartUpload(params).promise();
      
      console.log(`🚀 开始大文件上传: ${fileName} (UploadId: ${multipartUpload.UploadId})`);
      
      return {
        success: true,
        uploadId: multipartUpload.UploadId,
        fileName: fileName,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('开始大文件上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 上传文件分片
  async uploadPart(uploadId, fileName, partNumber, partData) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: partData
      };

      const result = await this.s3.uploadPart(params).promise();
      
      console.log(`📦 分片 ${partNumber} 上传完成 (ETag: ${result.ETag})`);
      
      return {
        success: true,
        partNumber: partNumber,
        etag: result.ETag
      };
    } catch (error) {
      console.error(`分片 ${partNumber} 上传失败:`, error);
      return {
        success: false,
        error: error.message,
        partNumber: partNumber
      };
    }
  }

  // 完成分片上传
  async finishLargeFile(uploadId, fileName, parts) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map(part => ({
            ETag: part.etag,
            PartNumber: part.partNumber
          }))
        }
      };

      const result = await this.s3.completeMultipartUpload(params).promise();
      
      // 生成B2友好下载URL
      const b2DownloadUrl = `https://f005.backblazeb2.com/file/${this.bucketName}/${fileName}`;
      
      console.log(`✅ 大文件上传完成: ${fileName}`);
      
      return {
        success: true,
        fileId: result.ETag.replace(/"/g, ''),
        fileName: fileName,
        downloadUrl: b2DownloadUrl,
        cdnUrl: this.cdnBaseUrl ? `${this.cdnBaseUrl}/${fileName}` : b2DownloadUrl,
        location: result.Location
      };
    } catch (error) {
      console.error('完成大文件上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 取消分片上传
  async abortLargeFile(uploadId, fileName) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        UploadId: uploadId
      };

      await this.s3.abortMultipartUpload(params).promise();
      
      console.log(`❌ 取消大文件上传: ${fileName}`);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('取消大文件上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new B2StorageService(); 