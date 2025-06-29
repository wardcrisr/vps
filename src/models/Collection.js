const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  uid: {
    type: String,
    required: true,
    ref: 'User'  // 关联UP主的uid
  },
  coverUrl: {
    type: String,
    default: ''  // 合集封面
  },
  videoIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Media'
  }],
  isPublic: {
    type: Boolean,
    default: true
  },
  // 统计信息
  viewCount: {
    type: Number,
    default: 0
  },
  playCount: {
    type: Number,
    default: 0
  },
  // 排序
  order: {
    type: Number,
    default: 0
  },
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
CollectionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 获取视频数量
CollectionSchema.virtual('videoCount').get(function() {
  return this.videoIds.length;
});

module.exports = mongoose.model('Collection', CollectionSchema); 