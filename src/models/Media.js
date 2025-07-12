const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  // 本地文件信息（临时）
  filename: { 
    type: String, 
    required: false 
  },
  originalName: { 
    type: String, 
    required: true 
  },
  mimetype: { 
    type: String, 
    required: true 
  },
  size: { 
    type: Number, 
    required: true 
  },
  // 云存储信息
  cloudFileName: {
    type: String,
    required: false  // B2上的文件名
  },
  cloudFileId: {
    type: String,
    required: false  // B2文件ID
  },
  cloudDownloadUrl: {
    type: String,
    required: false  // B2原始下载URL
  },
  cdnUrl: {
    type: String,
    required: false  // CDN加速URL
  },
  // 本地路径（上传到云端后可删除）
  path: { 
    type: String, 
    required: false 
  },
  url: { 
    type: String, 
    required: true  // 显示用的URL（可能是CDN或本地）
  },
  type: { 
    type: String, 
    enum: ['image', 'video'], 
    required: true 
  },
  category: {
    type: String,
    enum: ['free', 'paid', 'member', 'new', 'exclusive', 'resources', 'models', 'show'], // 保留旧分类兼容
    default: 'free',
    required: true
  },
  uploader: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false
  },
  // 访问控制
  isPublic: {
    type: Boolean,
    default: true  // 是否公开预览
  },
  isPremiumOnly: {
    type: Boolean,
    default: false  // 是否仅付费用户可下载
  },
  downloadPrice: {
    type: Number,
    default: 0  // 下载价格（积分或金币）
  },
  // 统计信息
  views: { 
    type: Number, 
    default: 0 
  },
  likes: { 
    type: Number, 
    default: 0 
  },
  downloads: {
    type: Number,
    default: 0
  },
  // 视频相关字段
  duration: {
    type: Number,  // 视频时长（秒）
    default: 0
  },
  danmakuCount: {
    type: Number,  // 弹幕数量
    default: 0
  },
  favoriteCount: {
    type: Number,  // 收藏数
    default: 0
  },
  // 缩略图 URL
  thumbnail: {
    type: String,
    default: ''
  },
  // 解锁价格（金币）
  priceCoins: {
    type: Number,
    default: 0
  },
  coverUrl: {  // 视频封面（别名）
    type: String,
    default: ''
  },
  // Bunny Stream 视频ID
  bunnyId: {
    type: String,
    unique: true,
    required: true
  },
  // 兼容字段：Bunny Video GUID（与 bunnyId 相同）
  guid: {
    type: String,
    required: false
  },
  // HLS 视频流地址
  streamUrl: {
    type: String,
    required: false  // HLS播放地址，通常来自Bunny Stream
  },
  // 云存储状态
  cloudStatus: {
    type: String,
    enum: ['uploading', 'uploaded', 'failed', 'local'],
    default: 'local'
  },
  cloudUploadedAt: {
    type: Date,
    required: false
  },
  // 时间戳
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 更新 updatedAt 字段
MediaSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 检查文件是否在云端
MediaSchema.methods.isInCloud = function() {
  return this.cloudStatus === 'uploaded' && this.cloudFileId;
};

// 获取预览URL（通常是CDN或缩略图）
MediaSchema.methods.getPreviewUrl = function() {
  if (this.isInCloud() && this.cdnUrl) {
    return this.cdnUrl;
  }
  return this.url;
};

// 获取下载URL（需要权限验证）
MediaSchema.methods.getDownloadUrl = function(userId = null) {
  if (!this.isInCloud()) {
    return this.url;  // 本地文件直接返回
  }
  
  // 云端文件需要生成临时下载链接
  return `/api/media/${this._id}/download${userId ? `?userId=${userId}` : ''}`;
};

// 增加下载次数
MediaSchema.methods.incrementDownload = function() {
  this.downloads += 1;
  return this.save();
};

// 增加浏览次数
MediaSchema.methods.incrementView = function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Media', MediaSchema); 