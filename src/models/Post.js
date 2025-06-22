// src/models/Post.js
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title:     { type: String, required: true },
  thumbnail: { type: String, required: true }, // 存相对路径 public/thumbnails/xxx.jpg
  videoUrl:  { type: String, required: true }, // 实际视频链接
  views:     { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  tags:      [ String ]
});

module.exports = mongoose.model('Post', PostSchema);
