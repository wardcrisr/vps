// test-bunny-api.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const bunny = require('./bunny');

async function testBunnyApi() {
  try {
    console.log('📡 测试 Bunny Stream API 连接...');
    
    // 1. 列出所有视频
    console.log('\n1. 获取视频列表...');
    const videos = await bunny.video.list();
    console.log(`✅ 找到 ${videos.length} 个视频`);
    
    // 2. 显示前几个视频的信息
    console.log('\n2. 视频列表:');
    videos.slice(0, 5).forEach((video, index) => {
      console.log(`${index + 1}. ${video.title || '无标题'}`);
      console.log(`   GUID: ${video.guid}`);
      console.log(`   状态: ${video.status}`);
      console.log(`   长度: ${video.length} 秒`);
      console.log(`   创建时间: ${video.dateUploaded}`);
      console.log('   ---');
    });
    
    // 3. 详细测试第一个视频
    if (videos.length > 0) {
      const firstVideo = videos[0];
      console.log(`\n3. 详细测试视频: ${firstVideo.guid}`);
      
      const detailInfo = await bunny.video.get(firstVideo.guid);
      console.log('\n📋 详细信息:');
      console.log(JSON.stringify(detailInfo, null, 2));
      
      // 4. 分析时长字段
      console.log('\n🔍 时长字段分析:');
      const durationFields = {
        'length': detailInfo.length,
        'duration': detailInfo.duration,
        'lengthInSeconds': detailInfo.lengthInSeconds,
        'meta?.duration': detailInfo.meta?.duration,
        'video?.duration': detailInfo.video?.duration,
        'statistics?.duration': detailInfo.statistics?.duration
      };
      
      for (const [field, value] of Object.entries(durationFields)) {
        console.log(`  ${field}: ${value} (类型: ${typeof value}, 有效: ${!isNaN(Number(value)) && Number(value) > 0})`);
      }
    }
    
  } catch (error) {
    console.error('❌ API 测试失败:', error);
    console.error('错误详情:', error.message);
  }
}

testBunnyApi();