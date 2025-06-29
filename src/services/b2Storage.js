const B2 = require('backblaze-b2'); // 使用正确的包名
const AWS = require('aws-sdk'); // 添加AWS SDK支持S3兼容API
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class B2StorageService {
  constructor() {
    // 优先使用S3兼容API（更稳定）
    this.useS3Api = true;
    
    if (this.useS3Api) {
      // 配置S3兼容的Backblaze B2
      this.s3 = new AWS.S3({
        endpoint: `https://${process.env.B2_ENDPOINT}`,
        accessKeyId: process.env.B2_APPLICATION_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
        region: 'us-east-005', // B2固定区域
        s3ForcePathStyle: true, // B2需要路径样式
        signatureVersion: 'v4'
      });
    } else {
      // 原生B2 API（备用）
      this.b2 = new B2({
        applicationKeyId: process.env.B2_APPLICATION_KEY_ID,
        applicationKey: process.env.B2_APPLICATION_KEY,
      });
    }
    
    this.bucketName = process.env.B2_BUCKET_NAME;
    this.bucketId = process.env.B2_BUCKET_ID;
    this.cdnBaseUrl = process.env.CDN_BASE_URL;
    this.isAuthorized = false;
  }

  // 初始化B2连接
  async initialize() {
    try {
      if (this.useS3Api) {
        // 测试S3连接
        await this.s3.headBucket({ Bucket: this.bucketName }).promise();
        console.log('✅ Backblaze B2 (S3 API) 已连接');
        this.isAuthorized = true;
      } else {
        // 原生B2 API初始化
        if (!this.isAuthorized) {
          await this.b2.authorize();
          this.isAuthorized = true;
          console.log('✅ Backblaze B2 (原生API) 已连接');
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Backblaze B2 连接失败:', error.message);
      
      // 如果S3 API失败，尝试原生API
      if (this.useS3Api) {
        console.log('🔄 尝试切换到原生B2 API...');
        this.useS3Api = false;
        return this.initialize();
      }
      
      return false;
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
      await this.initialize();
      
      const fileName = this.generateFileName(originalName, mimeType.startsWith('video/') ? 'video' : 'image');
      const fileBuffer = fs.readFileSync(filePath);
      
      let uploadResult;
      
      if (this.useS3Api) {
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
        
        uploadResult = {
          success: true,
          fileId: s3Result.ETag.replace(/"/g, ''), // 移除引号
          fileName: fileName,
          downloadUrl: s3Result.Location,
          cdnUrl: this.cdnBaseUrl ? `${this.cdnBaseUrl}/${fileName}` : s3Result.Location,
          size: fileBuffer.length,
          uploadResponse: s3Result
        };
        
      } else {
        // 使用原生B2 API上传
        const uploadResponse = await this.b2.uploadFile({
          bucketId: this.bucketId,
          fileName: fileName,
          data: fileBuffer,
          mime: mimeType,
          info: {
            originalName: originalName,
            uploadTime: new Date().toISOString(),
          }
        });

        uploadResult = {
          success: true,
          fileId: uploadResponse.data.fileId,
          fileName: fileName,
          downloadUrl: uploadResponse.data.downloadUrl,
          cdnUrl: this.cdnBaseUrl ? `${this.cdnBaseUrl}/${fileName}` : uploadResponse.data.downloadUrl,
          size: fileBuffer.length,
          uploadResponse: uploadResponse
        };
      }

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
      await this.initialize();
      
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

      await this.initialize();
      
      let downloadUrl;
      
      if (this.useS3Api) {
        // 使用S3预签名URL
        const params = {
          Bucket: this.bucketName,
          Key: decoded.fileName,
          Expires: 3600 // 1小时有效期
        };
        
        downloadUrl = this.s3.getSignedUrl('getObject', params);
      } else {
        // 使用原生B2 API
        const downloadAuth = await this.b2.getDownloadAuthorization({
          bucketId: this.bucketId,
          fileNamePrefix: decoded.fileName,
          validDurationInSeconds: 3600
        });
        
        downloadUrl = `${downloadAuth.downloadUrl}/${decoded.fileName}?Authorization=${downloadAuth.authorizationToken}`;
      }

      return {
        success: true,
        fileName: decoded.fileName,
        userId: decoded.userId,
        downloadUrl: downloadUrl
      };
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
      await this.initialize();
      
      if (this.useS3Api) {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: fileName
        }).promise();
      } else {
        await this.b2.deleteFileVersion({
          fileId: fileId,
          fileName: fileName
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('删除文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取文件信息
  async getFileInfo(fileName) {
    try {
      await this.initialize();
      
      let fileInfo;
      
      if (this.useS3Api) {
        fileInfo = await this.s3.headObject({
          Bucket: this.bucketName,
          Key: fileName
        }).promise();
      } else {
        // 原生B2 API需要fileId，这里返回基本信息
        fileInfo = { fileName: fileName };
      }
      
      return {
        success: true,
        fileInfo: fileInfo
      };
    } catch (error) {
      console.error('获取文件信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 列出存储桶中的文件
  async listFiles(prefix = '', maxKeys = 100) {
    try {
      await this.initialize();
      
      if (this.useS3Api) {
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
      } else {
        // 原生B2 API
        const result = await this.b2.listFileNames({
          bucketId: this.bucketId,
          maxFileCount: maxKeys,
          startFileName: prefix
        });
        
        return {
          success: true,
          files: result.data.files || []
        };
      }
    } catch (error) {
      console.error('列出文件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new B2StorageService(); 