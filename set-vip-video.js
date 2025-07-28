#!/usr/bin/env node

/**
 * 批量设置所有视频为会员专属的工具脚本
 * 使用方法：node set-vip-video.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('./src/models/Media');

async function setAllVideosVip() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb');
    console.log('✅ 已连接到MongoDB');

    // 查询所有视频
    const totalVideos = await Media.countDocuments({ type: 'video' });
    console.log(`📹 找到 ${totalVideos} 个视频`);

    if (totalVideos === 0) {
      console.log('❌ 没有找到任何视频');
      process.exit(1);
    }

    // 查询当前会员视频数量
    const currentVipVideos = await Media.countDocuments({ 
      type: 'video', 
      isPremiumOnly: true 
    });
    console.log(`当前会员专属视频数量: ${currentVipVideos}`);

    // 批量更新所有视频为会员专属
    const result = await Media.updateMany(
      { type: 'video' },
      {
        isPremiumOnly: true,
        category: 'member'
      }
    );

    console.log('✅ 批量更新完成');
    console.log(`更新了 ${result.modifiedCount} 个视频`);
    
    // 验证更新结果
    const updatedVipVideos = await Media.countDocuments({ 
      type: 'video', 
      isPremiumOnly: true,
      category: 'member'
    });
    console.log(`验证结果: 现在有 ${updatedVipVideos} 个会员专属视频`);

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

setAllVideosVip(); 