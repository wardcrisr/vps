// analyze-video-duration.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const axios = require('axios');

async function analyzeVideoDuration() {
  try {
    const apiKey = process.env.BUNNY_API_KEY;
    const videoLibrary = process.env.BUNNY_VIDEO_LIBRARY;
    
    console.log('📡 分析视频时长信息...');
    
    // 1. 获取视频列表
    const listResponse = await axios.get(`https://video.bunnycdn.com/library/${videoLibrary}/videos`, {
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ 找到 ${listResponse.data.items.length} 个视频`);
    
    // 2. 分析每个视频的时长信息
    console.log('\n📋 详细时长分析:');
    listResponse.data.items.forEach((video, index) => {
      console.log(`\n🎬 视频 ${index + 1}: ${video.title}`);
      console.log('  guid:', video.guid);
      console.log('  status:', video.status);
      console.log('  🔍 时长字段分析:');
      
      // 检查所有可能的时长字段
      const allFields = Object.keys(video);
      console.log('  所有可用字段:', allFields);
      
      // 重点关注时长相关字段
      const durationFields = {
        'length': video.length,
        'duration': video.duration,
        'lengthInSeconds': video.lengthInSeconds,
        'meta': video.meta,
        'videoInfo': video.videoInfo,
        'statistics': video.statistics
      };
      
      for (const [field, value] of Object.entries(durationFields)) {
        if (value !== undefined) {
          console.log(`    ${field}: ${value} (类型: ${typeof value})`);
          if (typeof value === 'object' && value !== null) {
            console.log(`      ${field} 内容:`, JSON.stringify(value, null, 6));
          }
        }
      }
      
      // 尝试提取有效的时长值
      const extractedDuration = 
        Number(video.length) ||
        Number(video.duration) ||
        Number(video.lengthInSeconds) ||
        Number(video.meta?.duration) ||
        0;
      
      console.log(`  ⏱️  提取的时长: ${extractedDuration} 秒`);
      
      if (extractedDuration === 0) {
        console.log('  ⚠️  时长为0，需要进一步检查！');
      }
    });
    
    // 3. 尝试不同的API端点获取单个视频信息
    const testVideo = listResponse.data.items[0];
    if (testVideo) {
      console.log(`\n🔍 尝试不同的API端点获取视频详情...`);
      console.log(`测试视频: ${testVideo.guid}`);
      
      // 尝试不同的API路径
      const apiPaths = [
        `/library/${videoLibrary}/videos/${testVideo.guid}`,
        `/library/${videoLibrary}/video/${testVideo.guid}`,
        `/videos/${testVideo.guid}`,
        `/video/${testVideo.guid}`
      ];
      
      for (const path of apiPaths) {
        try {
          console.log(`\n📡 尝试: https://video.bunnycdn.com${path}`);
          const response = await axios.get(`https://video.bunnycdn.com${path}`, {
            headers: {
              'AccessKey': apiKey,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ 成功! 返回数据:');
          console.log(JSON.stringify(response.data, null, 2));
          break; // 成功后跳出循环
          
        } catch (error) {
          console.log(`❌ 失败: ${error.response?.status} - ${error.response?.statusText}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 分析失败:', error.response?.data || error.message);
  }
}

analyzeVideoDuration();