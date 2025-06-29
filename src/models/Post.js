const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  coverUrl:  { type: String, required: true },
  category:  { type: String, index: true },
  assets:    [String],                // HLS 链接或图片列表
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);
