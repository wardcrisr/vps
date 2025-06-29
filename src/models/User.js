const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },     // 存储 bcrypt.hash 后的值
  role:     { type: String, enum: ['user','vip','admin'], default: 'user' },
  
  // 用户资料字段
  displayName: { type: String, default: '' },    // 显示昵称
  qq: { type: String, default: '' },             // QQ号
  bio: { type: String, default: '' },            // 个人介绍
  
  // 付费相关字段
  isPremium: { type: Boolean, default: false },
  premiumExpiry: { type: Date, default: null },
  downloadCount: { type: Number, default: 0 },
  dailyDownloadLimit: { type: Number, default: 5 }, // 免费用户每日5次下载
  lastDownloadReset: { type: Date, default: Date.now },
  
  // 用户统计
  totalDownloads: { type: Number, default: 0 },
  joinDate: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  
  // UP主相关字段
  uid: { type: String, unique: true, sparse: true }, // UP主唯一ID
  name: { type: String, default: '' },               // UP主名称
  level: { type: Number, default: 1 },               // 等级
  fansCount: { type: Number, default: 0 },           // 粉丝数
  likeCount: { type: Number, default: 0 },           // 获赞总数
  playCount: { type: Number, default: 0 },           // 播放总量
  isUploader: { type: Boolean, default: false },     // 是否为UP主
  uploaderDescription: { type: String, default: '' } // UP主简介
});

// 检查用户是否为付费用户
UserSchema.methods.isPremiumUser = function() {
  return this.isPremium && this.premiumExpiry > new Date();
};

// 检查用户每日下载限制
UserSchema.methods.canDownload = function() {
  const today = new Date();
  const resetDate = new Date(this.lastDownloadReset);
  
  // 如果是新的一天，重置下载计数
  if (today.toDateString() !== resetDate.toDateString()) {
    this.downloadCount = 0;
    this.lastDownloadReset = today;
  }
  
  // 付费用户无限制下载
  if (this.isPremiumUser()) {
    return true;
  }
  
  // 免费用户检查每日限制
  return this.downloadCount < this.dailyDownloadLimit;
};

// 增加下载次数
UserSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.totalDownloads += 1;
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);
