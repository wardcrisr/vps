const AWS = require('aws-sdk');
const crypto = require('crypto');
const path = require('path');

class B2DirectUploadService {
  constructor() {
    // 配置S3兼容的Backblaze B2
    this.s3 = new AWS.S3({
      endpoint: `https://${process.env.B2_ENDPOINT}`,
      accessKeyId: process.env.B2_APPLICATION_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
      region: 'us-east-005', // B2固定区域
      s3ForcePathStyle: true,
      signatureVersion: 'v4'
    });
    
    this.bucketName = process.env.B2_BUCKET_NAME;
    this.cdnBaseUrl = process.env.CDN_BASE_URL;
    this.isAuthorized = false;
    // 记录是否已检查过 CORS 设置，避免每次调用都重复请求
    this.corsChecked = false;
  }

  /**
   * 确保 Bucket 的 CORS 规则允许浏览器直传
   * 如果未配置或缺少必要规则，则自动写入默认规则。
   * 该操作在进程生命周期内只会执行一次（通过 this.corsChecked 标记）。
   */
  async ensureCorsSetup() {
    if (this.corsChecked) return;

    const allowedOrigins = (process.env.B2_ALLOWED_ORIGINS || '*')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    // 默认规则：允许 PUT、GET、HEAD 对象操作以及用于多段上传的 POST
    const defaultCorsRule = {
      AllowedHeaders: ['*'],
      AllowedMethods: ['PUT', 'POST', 'GET', 'HEAD'],
      AllowedOrigins: allowedOrigins,
      ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
      MaxAgeSeconds: 3000
    };

    try {
      const current = await this.s3.getBucketCors({ Bucket: this.bucketName }).promise();
      // 简单检查现有规则是否已包含我们想要的 AllowedMethods
      const hasPutRule = (current.CORSRules || []).some(r =>
        (r.AllowedMethods || []).includes('PUT') &&
        (r.AllowedOrigins || []).some(origin => allowedOrigins.includes(origin) || origin === '*')
      );

      if (!hasPutRule) {
        console.warn('⚠️ B2 Bucket 缺少 CORS 规则，正在自动写入默认规则');
        await this.s3.putBucketCors({
          Bucket: this.bucketName,
          CORSConfiguration: {
            CORSRules: [defaultCorsRule]
          }
        }).promise();
        console.log('✅ 已写入默认 CORS 规则');
      }
    } catch (error) {
      if (error.code === 'NoSuchCORSConfiguration') {
        console.warn('⚠️ 未检测到 CORS 规则，正在写入默认规则');
        await this.s3.putBucketCors({
          Bucket: this.bucketName,
          CORSConfiguration: {
            CORSRules: [defaultCorsRule]
          }
        }).promise();
        console.log('✅ 已写入默认 CORS 规则');
      } else {
        console.error('获取/设置 CORS 规则失败:', error.message);
      }
    } finally {
      this.corsChecked = true;
    }
  }

  // 初始化连接
  async initialize() {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName }).promise();
      console.log('✅ B2 直传服务已初始化');
      this.isAuthorized = true;

      // 检查并确保 CORS 规则
      await this.ensureCorsSetup();

      return true;
    } catch (error) {
      console.error('❌ B2 直传服务初始化失败:', error.message);
      return false;
    }
  }

  // 生成唯一文件名
  generateFileName(originalName, type = 'video') {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    return `${type}/${year}/${month}/${baseName}-${timestamp}-${randomId}${ext}`;
  }

  // 清理文件名用于S3 Metadata
  sanitizeForMetadata(str) {
    // S3 metadata values 只允许 ASCII 字符，移除或替换无效字符
    return Buffer.from(str, 'utf8').toString('base64');
  }

  // 1. 创建多段上传并生成预签名URL
  async createMultipartUpload(originalName, mimeType, chunkSize = 20 * 1024 * 1024) {
    try {
      await this.initialize();
      
      const fileName = this.generateFileName(originalName, mimeType.startsWith('video/') ? 'video' : 'image');
      
      // 创建多段上传
      const createParams = {
        Bucket: this.bucketName,
        Key: fileName,
        ContentType: mimeType,
        Metadata: {
          'original-name': this.sanitizeForMetadata(originalName),
          'upload-time': new Date().toISOString(),
          'chunk-size': chunkSize.toString()
        }
      };

      const createResult = await this.s3.createMultipartUpload(createParams).promise();
      
      console.log(`🚀 创建多段上传: ${fileName}, UploadId: ${createResult.UploadId}`);
      
      return {
        success: true,
        uploadId: createResult.UploadId,
        fileName: fileName,
        bucketName: this.bucketName,
        key: fileName,
        chunkSize: chunkSize
      };
      
    } catch (error) {
      console.error('创建多段上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 2. 生成单个分片的预签名PUT URL
  async generatePartUploadUrl(uploadId, fileName, partNumber, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        PartNumber: partNumber,
        UploadId: uploadId,
        Expires: expiresIn // 1小时有效期
      };

      const url = await this.s3.getSignedUrlPromise('uploadPart', params);
      
      return {
        success: true,
        url: url,
        partNumber: partNumber,
        expiresIn: expiresIn
      };
      
    } catch (error) {
      console.error(`生成分片 ${partNumber} 预签名URL失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 3. 批量生成多个分片的预签名URL
  async generateMultiplePartUploadUrls(uploadId, fileName, totalParts, expiresIn = 3600) {
    try {
      const urls = [];
      
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const result = await this.generatePartUploadUrl(uploadId, fileName, partNumber, expiresIn);
        if (result.success) {
          urls.push(result);
        } else {
          throw new Error(`生成分片 ${partNumber} URL失败: ${result.error}`);
        }
      }
      
      return {
        success: true,
        urls: urls,
        totalParts: totalParts
      };
      
    } catch (error) {
      console.error('批量生成预签名URL失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 4. 完成多段上传
  async completeMultipartUpload(uploadId, fileName, parts) {
    try {
      // 验证parts格式
      if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error('parts必须是非空数组');
      }

      // 排序parts确保顺序正确
      const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);
      
      const completeParams = {
        Bucket: this.bucketName,
        Key: fileName,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts.map(part => ({
            ETag: part.ETag,
            PartNumber: part.PartNumber
          }))
        }
      };

      const result = await this.s3.completeMultipartUpload(completeParams).promise();
      
      console.log(`✅ 多段上传完成: ${fileName}`);
      
      return {
        success: true,
        location: result.Location,
        bucket: result.Bucket,
        key: result.Key,
        etag: result.ETag,
        downloadUrl: result.Location,
        cdnUrl: this.cdnBaseUrl ? `${this.cdnBaseUrl}/${fileName}` : result.Location
      };
      
    } catch (error) {
      console.error('完成多段上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 5. 取消多段上传
  async abortMultipartUpload(uploadId, fileName) {
    try {
      const abortParams = {
        Bucket: this.bucketName,
        Key: fileName,
        UploadId: uploadId
      };

      await this.s3.abortMultipartUpload(abortParams).promise();
      
      console.log(`❌ 取消多段上传: ${fileName}`);
      
      return {
        success: true,
        message: '多段上传已取消'
      };
      
    } catch (error) {
      console.error('取消多段上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 6. 生成下载预签名URL（2小时有效）
  async generateDownloadUrl(fileName, expiresIn = 7200) {
    try {
      await this.initialize();
      
      const params = {
        Bucket: this.bucketName,
        Key: fileName,
        Expires: expiresIn,
        ResponseContentDisposition: `attachment; filename="${path.basename(fileName)}"`
      };

      const url = await this.s3.getSignedUrlPromise('getObject', params);
      
      return {
        success: true,
        url: url,
        expiresIn: expiresIn,
        expiresAt: new Date(Date.now() + expiresIn * 1000)
      };
      
    } catch (error) {
      console.error('生成下载URL失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 7. 获取文件信息
  async getFileInfo(fileName) {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: fileName
      };

      const result = await this.s3.headObject(params).promise();
      
      return {
        success: true,
        size: result.ContentLength,
        lastModified: result.LastModified,
        contentType: result.ContentType,
        etag: result.ETag,
        metadata: result.Metadata
      };
      
    } catch (error) {
      console.error('获取文件信息失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 8. 列出未完成的多段上传
  async listIncompleteUploads(prefix = '') {
    try {
      const params = {
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxUploads: 100
      };

      const result = await this.s3.listMultipartUploads(params).promise();
      
      return {
        success: true,
        uploads: result.Uploads || []
      };
      
    } catch (error) {
      console.error('列出未完成上传失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new B2DirectUploadService(); 