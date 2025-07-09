// test-api-response.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const axios = require('axios');

async function testAPIResponse() {
  try {
    console.log('📡 测试前端API响应...');
    
    // 测试首页API
    const response = await axios.get('http://localhost:3000/api/videos', {
      timeout: 5000
    });
    
    console.log('✅ API响应成功');
    console.log('📋 前3个视频的时长信息:');
    
    const videos = response.data.data?.videos || response.data.videos || response.data;
    
    if (Array.isArray(videos)) {
      videos.slice(0, 3).forEach((video, index) => {
        console.log(`${index + 1}. ${video.title}`);
        console.log(`   duration: ${video.duration}s`);
        console.log(`   _id: ${video._id}`);
      });
    } else {
      console.log('❌ 返回的数据格式不正确:', typeof videos);
      console.log('原始响应:', response.data);
    }
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    
    // 如果端口3000不通，尝试其他端口
    const ports = [3000, 8000, 8080, 3001];
    for (const port of ports) {
      try {
        console.log(`🔄 尝试端口 ${port}...`);
        const response = await axios.get(`http://localhost:${port}/api/videos`, { timeout: 2000 });
        console.log(`✅ 端口 ${port} 响应成功`);
        break;
      } catch (e) {
        console.log(`❌ 端口 ${port} 失败`);
      }
    }
  }
}

testAPIResponse();