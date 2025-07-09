// test-bunny-duration.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const bunny = require('./bunny');
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function testBunnyDuration() {
  try {
    // 1. 连接数据库
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb');
    console.log('✅ 数据库连接成功');

    // 2. 首先找到一个有 bunnyId 的视频
    console.log('\n🔍 查找数据库中的视频...');
    const existingMedia = await Media.findOne({ 
      bunnyId: { $exists: true, $ne: null } 
    });
    
    if (!existingMedia) {
      console.log('❌ 数据库中没有找到带有 bunnyId 的视频');
      console.log('📝 让我们列出所有视频:');
      
      const allVideos = await Media.find({}).limit(5);
      allVideos.forEach(video => {
        console.log(`  - ${video.title} (ID: ${video._id})`);
        console.log(`    bunnyId: ${video.bunnyId}`);
        console.log(`    guid: ${video.guid}`);
        console.log(`    duration: ${video.duration}`);
        console.log('    ---');
      });
      return;
    }

    const testVideoGuid = existingMedia.bunnyId;
    console.log(`🎯 测试视频: ${testVideoGuid}`);
    console.log(`📋 视频标题: ${existingMedia.title}`);
    console.log(`⏱️  当前时长: ${existingMedia.duration} 秒`);
    
    // 3. 直接调用 Bunny API 获取视频信息
    console.log('\n📡 正在调用 Bunny Stream API...');
    const videoInfo = await bunny.video.get(testVideoGuid);
    
    console.log('\n📋 完整的视频信息:');
    console.log(JSON.stringify(videoInfo, null, 2));
    
    // 4. 分析各种可能的时长字段
    console.log('\n🔍 分析时长字段:');
    const durationFields = {
      'length': videoInfo.length,
      'duration': videoInfo.duration,
      'lengthInSeconds': videoInfo.lengthInSeconds,
      'meta?.duration': videoInfo.meta?.duration,
      'video?.duration': videoInfo.video?.duration,
      'statistics?.duration': videoInfo.statistics?.duration
    };
    
    for (const [field, value] of Object.entries(durationFields)) {
      console.log(`  ${field}: ${value} (Number: ${Number(value)}, Valid: ${!isNaN(Number(value)) && Number(value) > 0})`);
    }
    
    // 5. 测试现有的时长提取逻辑
    const lengthInSeconds =
      Number(videoInfo.length) ||
      Number(videoInfo.duration) ||
      Number(videoInfo.lengthInSeconds) ||
      Number(videoInfo.meta?.duration) ||
      0;
    
    console.log('\n⏱️ 提取的时长:', lengthInSeconds, '秒');
    
    // 6. 测试改进的提取逻辑
    const improvedExtraction = (() => {
      for (const [field, value] of Object.entries(durationFields)) {
        if (value != null) {
          const parsed = Number(value);
          if (!isNaN(parsed) && parsed > 0) {
            console.log(`✅ 使用 ${field} 作为时长来源: ${parsed} 秒`);
            return parsed;
          }
        }
      }
      console.log('❌ 未找到有效的时长值');
      return 0;
    })();
    
    // 7. 测试数据库更新
    console.log('\n📝 更新数据库记录...');
    const updatedMedia = await Media.findOneAndUpdate(
      { _id: existingMedia._id },
      { duration: improvedExtraction },
      { new: true }
    );
    
    console.log('✅ 更新成功:', {
      _id: updatedMedia._id,
      title: updatedMedia.title,
      oldDuration: existingMedia.duration,
      newDuration: updatedMedia.duration
    });
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 数据库连接已断开');
  }
}

// 运行测试
testBunnyDuration();