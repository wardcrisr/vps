// fix-all-videos.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const bunny = require('./bunny');
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function fixAllVideos() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb');
    console.log('✅ 数据库连接成功');

    // 找到所有时长为0的视频
    const videosToFix = await Media.find({ 
      duration: { $lte: 0 },
      bunnyId: { $exists: true, $ne: null }
    });

    console.log(`🔍 找到 ${videosToFix.length} 个需要修复的视频`);

    let successCount = 0;
    let failCount = 0;

    for (const video of videosToFix) {
      try {
        console.log(`\n📡 处理视频: ${video.title}`);
        console.log(`  bunnyId: ${video.bunnyId}`);

        // 获取视频信息
        const videoInfo = await bunny.video.get(video.bunnyId);
        
        // 提取时长
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
                return parsed;
              }
            }
          }
          return 0;
        })();

        if (lengthInSeconds > 0) {
          // 更新数据库
          await Media.findByIdAndUpdate(video._id, { duration: lengthInSeconds });
          console.log(`✅ 更新成功: ${lengthInSeconds}s`);
          successCount++;
        } else {
          console.log(`⚠️  时长仍为0，跳过`);
          failCount++;
        }

        // 避免API限制，稍作延迟
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ 处理视频 ${video.title} 失败:`, error.message);
        failCount++;
      }
    }

    console.log(`\n📊 修复完成：`);
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${failCount}`);

  } catch (error) {
    console.error('❌ 批量修复失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 数据库连接已断开');
  }
}

fixAllVideos();