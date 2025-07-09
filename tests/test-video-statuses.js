// test-video-statuses.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bunny = require('./bunny');

async function testVideoStatuses() {
  try {
    // 1. 获取视频库中的所有视频
    console.log('📋 获取视频库中的所有视频...');
    const videos = await bunny.video.list();
    
    console.log(`找到 ${videos.length} 个视频`);
    
    // 2. 遍历每个视频，检查状态和时长信息
    for (const video of videos.slice(0, 10)) { // 限制测试前10个视频
      console.log(`\n🎬 视频: ${video.guid}`);
      console.log(`状态: ${video.status}`);
      console.log(`标题: ${video.title}`);
      
      // 获取详细信息
      const detailInfo = await bunny.video.get(video.guid);
      
      console.log('详细信息中的时长字段:');
      console.log('  length:', detailInfo.length);
      console.log('  duration:', detailInfo.duration);
      console.log('  lengthInSeconds:', detailInfo.lengthInSeconds);
      
      // 计算时长
      const duration = Number(detailInfo.length) || 
                      Number(detailInfo.duration) || 
                      Number(detailInfo.lengthInSeconds) || 0;
      
      console.log(`  计算结果: ${duration} 秒`);
      
      // 检查是否为0
      if (duration === 0) {
        console.log('  ⚠️  时长为0，可能需要等待处理完成');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testVideoStatuses();