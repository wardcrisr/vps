// debug-frontend.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const axios = require('axios');

async function debugFrontend() {
  try {
    console.log('🔍 调试前端页面...');
    
    // 1. 检查主页HTML
    const htmlResponse = await axios.get('http://localhost:3000/', {
      timeout: 5000
    });
    
    console.log('✅ 主页响应成功');
    
    // 2. 检查HTML中是否包含视频时长
    const html = htmlResponse.data;
    const durationMatches = html.match(/video-duration[^>]*>([^<]+)</g);
    
    if (durationMatches) {
      console.log('📋 页面中找到的时长显示:');
      durationMatches.forEach((match, index) => {
        console.log(`  ${index + 1}. ${match}`);
      });
    } else {
      console.log('❌ 页面中未找到时长显示');
    }
    
    // 3. 检查是否有JavaScript错误
    const jsErrors = html.match(/error|Error|ERROR/g);
    if (jsErrors) {
      console.log('⚠️  可能的JavaScript错误:', jsErrors.length);
    }
    
  } catch (error) {
    console.error('❌ 前端调试失败:', error.message);
  }
}

debugFrontend();