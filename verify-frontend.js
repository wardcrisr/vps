// verify-frontend.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const Media = require('./src/models/Media');
const mongoose = require('mongoose');

async function verifyFrontend() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb');
    console.log('✅ 数据库连接成功');

    // 获取所有视频的时长信息
    const videos = await Media.find({}).select('title duration bunnyId').sort({ createdAt: -1 });

    console.log(`\n📋 当前视频时长状态：`);
    
    let zeroCount = 0;
    let validCount = 0;

    videos.forEach((video, index) => {
      const formattedDuration = formatDuration(video.duration);
      console.log(`${index + 1}. ${video.title}`);
      console.log(`   时长: ${video.duration}s (${formattedDuration})`);
      
      if (video.duration > 0) {
        validCount++;
      } else {
        zeroCount++;
      }
    });

    console.log(`\n📊 统计：`);
    console.log(`✅ 有效时长: ${validCount}`);
    console.log(`❌ 零时长: ${zeroCount}`);

    // 测试时长格式化函数
    console.log(`\n🔍 时长格式化测试：`);
    const testDurations = [0, 30, 60, 90, 300, 3600, 7200];
    testDurations.forEach(seconds => {
      console.log(`  ${seconds}s → ${formatDuration(seconds)}`);
    });

  } catch (error) {
    console.error('❌ 验证失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ 数据库连接已断开');
  }
}

// 时长格式化函数（与前端保持一致）
function formatDuration(seconds) {
  if (!seconds || seconds <= 0 || isNaN(seconds)) return '00:00';
  
  const totalSeconds = Math.floor(Number(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

verifyFrontend();