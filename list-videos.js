// list-videos.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function listVideos() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb');
    console.log('✅ 数据库连接成功');

    const videos = await Media.find({}).sort({ createdAt: -1 }).limit(10);
    
    console.log(`\n📋 找到 ${videos.length} 个视频记录:`);
    
    videos.forEach((video, index) => {
      console.log(`\n${index + 1}. ${video.title}`);
      console.log(`   ID: ${video._id}`);
      console.log(`   bunnyId: ${video.bunnyId || '无'}`);
      console.log(`   guid: ${video.guid || '无'}`);
      console.log(`   duration: ${video.duration} 秒`);
      console.log(`   创建时间: ${video.createdAt}`);
      console.log(`   类型: ${video.type}`);
      console.log(`   状态: ${video.cloudStatus}`);
    });
    
  } catch (error) {
    console.error('❌ 失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 数据库连接已断开');
  }
}

listVideos();