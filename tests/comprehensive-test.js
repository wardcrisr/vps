// comprehensive-test.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const bunny = require('./bunny');
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function comprehensiveTest() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/content-distribution');
  
  try {
    // 1. 从数据库找到一个有 bunnyId 的视频
    const mediaWithBunnyId = await Media.findOne({ bunnyId: { $exists: true, $ne: null } });
    
    if (!mediaWithBunnyId) {
      console.log('❌ 数据库中没有找到带有 bunnyId 的视频');
      return;
    }
    
    const testGuid = mediaWithBunnyId.bunnyId;
    console.log(`🎯 测试视频: ${testGuid}`);
    console.log(`📋 视频标题: ${mediaWithBunnyId.title}`);
    console.log(`⏱️  当前时长: ${mediaWithBunnyId.duration} 秒`);
    
    // 2. 调用 Bunny API
    console.log('\n📡 调用 Bunny Stream API...');
    const videoInfo = await bunny.video.get(testGuid);
    
    // 3. 分析 API 响应
    console.log('\n🔍 API 响应分析:');
    console.log('完整响应:', JSON.stringify(videoInfo, null, 2));
    
    // 4. 测试各种时长提取方式
    console.log('\n⏱️  时长字段分析:');
    const durationSources = {
      'length': videoInfo.length,
      'duration': videoInfo.duration,
      'lengthInSeconds': videoInfo.lengthInSeconds,
      'meta.duration': videoInfo.meta?.duration,
      'video.duration': videoInfo.video?.duration,
      'statistics.duration': videoInfo.statistics?.duration
    };
    
    for (const [source, value] of Object.entries(durationSources)) {
      console.log(`  ${source}: ${value} (Number: ${Number(value)}, Valid: ${!isNaN(Number(value)) && Number(value) > 0})`);
    }
    
    // 5. 使用改进的提取逻辑
    const extractedDuration = (() => {
      for (const [source, value] of Object.entries(durationSources)) {
        if (value != null) {
          const parsed = Number(value);
          if (!isNaN(parsed) && parsed > 0) {
            console.log(`✅ 使用 ${source} 作为时长来源: ${parsed} 秒`);
            return parsed;
          }
        }
      }
      console.log('❌ 未找到有效的时长值');
      return 0;
    })();
    
    // 6. 模拟 webhook 更新
    console.log('\n📝 模拟数据库更新...');
    const updatedMedia = await Media.findOneAndUpdate(
      { _id: mediaWithBunnyId._id },
      { duration: extractedDuration },
      { new: true }
    );
    
    console.log(`✅ 更新结果: ${updatedMedia.duration} 秒`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

comprehensiveTest();