// debug-bunny-sdk.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const { BunnyCdnStream } = require('bunnycdn-stream');

async function debugBunnySDK() {
  try {
    console.log('🔍 调试 Bunny SDK...');
    
    // 1. 检查环境变量
    console.log('\n📋 环境变量:');
    console.log('BUNNY_API_KEY:', process.env.BUNNY_API_KEY);
    console.log('BUNNY_VIDEO_LIBRARY:', process.env.BUNNY_VIDEO_LIBRARY);
    
    // 2. 创建 Bunny Stream 实例
    const bunny = new BunnyCdnStream({
      apiKey: process.env.BUNNY_API_KEY,
      videoLibrary: Number(process.env.BUNNY_VIDEO_LIBRARY),
    });
    
    console.log('\n🔍 Bunny 实例结构:');
    console.log('bunny keys:', Object.keys(bunny));
    console.log('bunny.video exists:', !!bunny.video);
    
    // 3. 检查 bunny.video 的方法
    if (bunny.video) {
      console.log('bunny.video keys:', Object.keys(bunny.video));
      console.log('bunny.video.list exists:', typeof bunny.video.list);
      console.log('bunny.video.get exists:', typeof bunny.video.get);
    }
    
    // 4. 尝试直接调用 API
    console.log('\n📡 尝试调用 API...');
    
    // 使用我们之前看到的 bunnyId 进行测试
    const testVideoId = '18d67e3f-a170-4adc-95bc-f681217717fd19f';
    
    if (bunny.video && bunny.video.get) {
      const videoInfo = await bunny.video.get(testVideoId);
      console.log('✅ 视频信息获取成功:');
      console.log(JSON.stringify(videoInfo, null, 2));
    } else {
      console.log('❌ bunny.video.get 不存在');
    }
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
    console.error('错误详情:', error.message);
    
    // 5. 尝试直接使用 axios 调用 Bunny API
    console.log('\n🔄 尝试直接使用 axios 调用 API...');
    
    const axios = require('axios');
    const apiKey = process.env.BUNNY_API_KEY;
    const videoLibrary = process.env.BUNNY_VIDEO_LIBRARY;
    
    try {
      const response = await axios.get(`https://video.bunnycdn.com/library/${videoLibrary}/videos`, {
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ 直接 API 调用成功:');
      console.log(`找到 ${response.data.items.length} 个视频`);
      
      // 显示前几个视频的信息
      response.data.items.slice(0, 3).forEach((video, index) => {
        console.log(`\n视频 ${index + 1}:`);
        console.log('  guid:', video.guid);
        console.log('  title:', video.title);
        console.log('  status:', video.status);
        console.log('  length:', video.length);
        console.log('  duration:', video.duration);
      });
      
    } catch (axiosError) {
      console.error('❌ 直接 API 调用也失败:', axiosError.message);
    }
  }
}

debugBunnySDK();