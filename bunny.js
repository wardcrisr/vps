// Bunny Stream 客户端封装
require('dotenv').config();
const { BunnyCdnStream } = require('bunnycdn-stream');

const bunny = new BunnyCdnStream({
  apiKey: process.env.BUNNY_API_KEY,
  videoLibrary: process.env.BUNNY_VIDEO_LIBRARY,
});

module.exports = bunny; 