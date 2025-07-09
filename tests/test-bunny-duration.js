// test-bunny-duration.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bunny = require('./bunny');
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function testBunnyDuration() {
  try {
    // 1. 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/content-distribution');
    console.log('✅ 数据库连接成功');

    // 2. 获取一个测试视频的 GUID
    const testVideoGuid = 'YOUR_TEST_VIDEO_GUID'; // 替换为实际的视频GUID
    
    // 3. 直接调用 Bunny API 获取视频信息
    console.log('\n📡 正在调用 Bunny Stream API...');
    const videoInfo = await bunny.video.get(testVideoGuid);
    
    console.log('\n📋 完整的视频信息:');
    console.log(JSON.stringify(videoInfo, null, 2));
    
    // 4. 分析各种可能的时长字段
    console.log('\n🔍 分析时长字段:');
    console.log('videoInfo.length:', videoInfo.length);
    console.log('videoInfo.duration:', videoInfo.duration);
    console.log('videoInfo.lengthInSeconds:', videoInfo.lengthInSeconds);
    console.log('videoInfo.meta?.duration:', videoInfo.meta?.duration);
    console.log('videoInfo.video?.duration:', videoInfo.video?.duration);
    console.log('videoInfo.statistics?.duration:', videoInfo.statistics?.duration);
    
    // 5. 测试现有的时长提取逻辑
    const lengthInSeconds =
      Number(videoInfo.length) ||
      Number(videoInfo.duration) ||
      Number(videoInfo.lengthInSeconds) ||
      Number(videoInfo.meta?.duration) ||
      0;
    
    console.log('\n⏱️ 提取的时长:', lengthInSeconds, '秒');
    
    // 6. 测试数据库查询和更新
    console.log('\n🔍 查找数据库中的视频记录...');
    const existingMedia = await Media.findOne({
      $or: [
        { bunnyId: testVideoGuid },
        { guid: testVideoGuid },
        { cloudFileName: testVideoGuid }
      ]
    });
    
    if (existingMedia) {
      console.log('✅ 找到视频记录:', {
        _id: existingMedia._id,
        title: existingMedia.title,
        currentDuration: existingMedia.duration,
        bunnyId: existingMedia.bunnyId
      });
      
      // 7. 测试更新操作
      console.log('\n📝 更新数据库记录...');
      const updatedMedia = await Media.findOneAndUpdate(
        { $or: [ { bunnyId: testVideoGuid }, { guid: testVideoGuid }, { cloudFileName: testVideoGuid } ] },
        { duration: lengthInSeconds },
        { new: true }
      );
      
      console.log('✅ 更新成功:', {
        _id: updatedMedia._id,
        title: updatedMedia.title,
        newDuration: updatedMedia.duration
      });
    } else {
      console.log('❌ 未找到对应的视频记录');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 数据库连接已断开');
  }
}

// 运行测试
testBunnyDuration();