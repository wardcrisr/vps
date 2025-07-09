// test-fixed-webhook.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const bunny = require('./bunny');
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function testFixedWebhook() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb');
    console.log('✅ 数据库连接成功');

    // 测试修复后的 bunny 客户端
    console.log('\n🔍 测试修复后的 bunny 客户端...');
    console.log('bunny.video.get:', typeof bunny.video.get);
    console.log('bunny.video.list:', typeof bunny.video.list);

    // 获取一个测试视频
    const testVideoGuid = '18d67e3f-a170-4adc-95bc-f681217fd19f';
    console.log(`\n📡 测试获取视频: ${testVideoGuid}`);
    
    const videoInfo = await bunny.video.get(testVideoGuid);
    console.log('✅ 视频信息获取成功:');
    console.log('  length:', videoInfo.length);
    console.log('  duration:', videoInfo.duration);
    console.log('  status:', videoInfo.status);

    // 模拟 webhook 逻辑
    console.log('\n🔄 模拟 webhook 时长提取...');
    const lengthInSeconds = (() => {
      const candidates = [
        videoInfo.length,
        videoInfo.duration,
        videoInfo.lengthInSeconds,
        videoInfo.meta?.duration
      ];
      
      for (const candidate of candidates) {
        if (candidate != null) {
          const parsed = Number(candidate);
          if (!isNaN(parsed) && parsed > 0) {
            console.log(`✅ 使用时长: ${parsed}s`);
            return parsed;
          }
        }
      }
      return 0;
    })();

    // 更新数据库
    console.log('\n📝 更新数据库...');
    const updatedMedia = await Media.findOneAndUpdate(
      { bunnyId: testVideoGuid },
      { duration: lengthInSeconds },
      { new: true }
    );

    if (updatedMedia) {
      console.log('✅ 数据库更新成功:');
      console.log(`  标题: ${updatedMedia.title}`);
      console.log(`  新时长: ${updatedMedia.duration}s`);
    } else {
      console.log('❌ 未找到对应的媒体记录');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 数据库连接已断开');
  }
}

testFixedWebhook();