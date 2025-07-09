const axios = require('axios');

async function testVODAPI() {
  try {
    console.log('📡 测试 VOD API 响应...');
    
    const response = await axios.get('http://127.0.0.1:3000/vod/videos?page=1&category=all', {
      timeout: 5000
    });
    
    console.log('✅ VOD API 响应成功');
    console.log('📋 响应状态:', response.status);
    console.log('📋 响应头:', response.headers['content-type']);
    
    const data = response.data;
    console.log('📋 响应数据结构:', Object.keys(data));
    
    if (data.success && data.data && data.data.videos) {
      console.log(`📋 找到 ${data.data.videos.length} 个视频`);
      
      console.log('\n📋 视频时长信息:');
      data.data.videos.forEach((video, index) => {
        const duration = video.duration || 0;
        const formatTime = (seconds) => {
          if (!seconds || seconds <= 0) return '00:00';
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = Math.floor(seconds % 60);
          return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        };
        
        console.log(`  ${index + 1}. ${video.title}`);
        console.log(`     时长: ${duration}s (${formatTime(duration)})`);
        console.log(`     状态: ${video.status}`);
        console.log(`     bunnyId: ${video.bunnyId || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('❌ 响应数据格式不正确');
      console.log('响应内容:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ VOD API 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testVODAPI();
