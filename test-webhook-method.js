// test-webhook-method.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const axios = require('axios');

async function testWebhookMethod() {
  try {
    const apiKey = process.env.BUNNY_API_KEY;
    const videoLibrary = process.env.BUNNY_VIDEO_LIBRARY;
    
    console.log('📡 测试 Webhook 中使用的方法...');
    
    // 1. 获取视频列表
    const listResponse = await axios.get(`https://video.bunnycdn.com/library/${videoLibrary}/videos`, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    const testVideo = listResponse.data.items[0];
    const VideoGuid = testVideo.guid;
    
    console.log(`🎯 测试视频: ${VideoGuid}`);
    console.log(`📋 视频标题: ${testVideo.title}`);
    
    // 2. 模拟 webhook 中的逻辑
    console.log('\n🔍 模拟 webhook 逻辑...');
    
    // 这里我们需要找到正确的 bunny.video.get() 替代方案
    // 尝试直接使用 axios 调用
    
    const possibleEndpoints = [
      `https://video.bunnycdn.com/library/${videoLibrary}/videos/${VideoGuid}`,
      `https://video.bunnycdn.com/library/${videoLibrary}/video/${VideoGuid}`,
      `https://video.bunnycdn.com/videos/${VideoGuid}`,
      `https://video.bunnycdn.com/video/${VideoGuid}`
    ];
    
    let videoInfo = null;
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`📡 尝试: ${endpoint}`);
        const response = await axios.get(endpoint, {
          headers: {
            'AccessKey': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        videoInfo = response.data;
        console.log('✅ 成功获取视频信息!');
        break;
        
      } catch (error) {
        console.log(`❌ 失败: ${error.response?.status}`);
        continue;
      }
    }
    
    if (!videoInfo) {
      console.log('⚠️  无法获取单个视频详情，使用列表中的信息');
      videoInfo = testVideo;
    }
    
    console.log('\n📋 视频信息:');
    console.log(JSON.stringify(videoInfo, null, 2));
    
    // 3. 提取时长 (模拟 webhook 逻辑)
    const lengthInSeconds =
      Number(videoInfo.length) ||
      Number(videoInfo.duration) ||
      Number(videoInfo.lengthInSeconds) ||
      Number(videoInfo.meta?.duration) ||
      0;
    
    console.log(`\n⏱️  提取的时长: ${lengthInSeconds} 秒`);
    
    if (lengthInSeconds === 0) {
      console.log('⚠️  时长为0的可能原因:');
      console.log('   1. 视频还在处理中');
      console.log('   2. API 字段名称不正确');
      console.log('   3. 视频确实很短或有问题');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testWebhookMethod();