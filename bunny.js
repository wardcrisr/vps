// bunny.js - 修复版本
require('dotenv').config({
  path: require('path').resolve(__dirname, './.env'),
});

const axios = require('axios');

// 创建自定义的 Bunny Stream 客户端
class BunnyStreamClient {
  constructor(apiKey, videoLibrary) {
    this.apiKey = apiKey;
    this.videoLibrary = videoLibrary;
    this.baseURL = 'https://video.bunnycdn.com';
  }

  // 获取单个视频信息
  async getVideo(videoGuid) {
    try {
      const response = await axios.get(`${this.baseURL}/library/${this.videoLibrary}/videos/${videoGuid}`, {
        headers: {
          'AccessKey': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('[BunnyStreamClient] getVideo error:', error.response?.data || error.message);
      throw error;
    }
  }

  // 获取视频列表
  async listVideos() {
    try {
      const response = await axios.get(`${this.baseURL}/library/${this.videoLibrary}/videos`, {
        headers: {
          'AccessKey': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return response.data.items;
    } catch (error) {
      console.error('[BunnyStreamClient] listVideos error:', error.response?.data || error.message);
      throw error;
    }
  }

  // 创建视频
  async createVideo(options = {}) {
    try {
      const { title = 'untitled' } = options;
      const response = await axios.post(`${this.baseURL}/library/${this.videoLibrary}/videos`, 
        { title },
        {
          headers: {
            'AccessKey': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('[BunnyStreamClient] createVideo error:', error.response?.data || error.message);
      throw error;
    }
  }
}

// 创建实例
const bunnyClient = new BunnyStreamClient(
  process.env.BUNNY_API_KEY,
  Number(process.env.BUNNY_VIDEO_LIBRARY)
);

// 为了保持向后兼容，创建一个带有 video 属性的对象
const bunny = {
  video: {
    get: (videoGuid) => bunnyClient.getVideo(videoGuid),
    list: () => bunnyClient.listVideos()
  },
  createVideo: (options) => bunnyClient.createVideo(options)
};

module.exports = bunny;

// 调试信息
console.log('[DEBUG] Bunny Stream Client initialized:', {
  apiKey: process.env.BUNNY_API_KEY,
  videoLibrary: process.env.BUNNY_VIDEO_LIBRARY,
  hasVideoGet: typeof bunny.video.get === 'function',
  hasVideoList: typeof bunny.video.list === 'function',
  hasCreateVideo: typeof bunny.createVideo === 'function'
});





