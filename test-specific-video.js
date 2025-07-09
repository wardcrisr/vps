// test-specific-video.js  
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const axios = require('axios');

async function testSpecificVideo() {
  try {
    const apiKey = process.env.BUNNY_API_KEY;
    const videoLibrary = process.env.BUNNY_VIDEO_LIBRARY;
    
    // 使用数据库中的一个实际 bunnyId
    const testVideoId = '18d67e3f-a170-4adc-95bc-f681217717fd19f';
    
    console.log('📡 测试特定视频 API 调用...');
    console.log('Video ID:', testVideoId);
    
    // 1. 获取视频列表
    console.log('\n1. 获取视频列表...');
    const listResponse = await axios.get(`https://video.bunnycdn.com/library/${videoLibrary}/videos`, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ 找到 ${listResponse.data.items.length} 个视频`);
    
    // 2. 查找我们的测试视频
    const ourVideo = listResponse.data.items.find(v => v.guid === testVideoId);
    if (ourVideo) {
      console.log('\n✅ 找到我们的测试视频:');
      console.log('  guid:', ourVideo.guid);
      console.log('  title:', ourVideo.title);
      console.log('  status:', ourVideo.status);
      console.log('  length:', ourVideo.length);
      console.log('  duration:', ourVideo.duration);
      console.log('  所有字段:', Object.keys(ourVideo));
    } else {
      console.log('\n❌ 未找到测试视频，显示所有视频的 GUID:');
      listResponse.data.items.forEach(video => {
        console.log(`  ${video.guid} - ${video.title}`);
      });
    }
    
    // 3. 获取特定视频的详细信息
    console.log('\n2. 获取特定视频详细信息...');
    try {
      const detailResponse = await axios.get(`https://video.bunnycdn.com/library/${videoLibrary}/videos/${testVideoId}`, {
        headers: {
          'AccessKey': apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ 视频详细信息:');
      console.log(JSON.stringify(detailResponse.data, null, 2));
      
    } catch (detailError) {
      console.error('❌ 获取视频详细信息失败:', detailError.response?.data || detailError.message);
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testSpecificVideo();