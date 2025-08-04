#!/usr/bin/env node
// 验证修复的脚本

const http = require('http');

console.log('=== 验证环境变量修复 ===');
console.log('正在访问调试端点...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/user/debug-env',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\n=== 调试端点响应 ===');
      console.log('消息:', response.message);
      console.log('\n=== SKU ID 映射 ===');
      
      const expectedMapping = {
        10: '685e6d3881b5e4938026c6aa',
        30: '6873aa8b5c04c69a131c7eca', 
        50: '6873ac2a5c04c69a131c7ede',
        100: '6873ac75b5a185839cca59c7',
        200: '6873ac935c04c69a131c7ee6',
        300: '6873acb7b5a185839cca59cd'
      };

      let allCorrect = true;
      
      for (const [coins, expectedSku] of Object.entries(expectedMapping)) {
        const actualSku = response.skuIds[coins];
        const isCorrect = actualSku === expectedSku;
        
        console.log(`${coins}金币: ${actualSku || '未定义'} ${isCorrect ? '✅' : '❌'}`);
        
        if (!isCorrect) {
          allCorrect = false;
          console.log(`  期望: ${expectedSku}`);
        }
      }

      console.log('\n=== 修复状态 ===');
      if (allCorrect) {
        console.log('✅ 所有SKU ID映射正确！');
        console.log('✅ 环境变量修复成功！');
      } else {
        console.log('❌ 仍存在SKU ID映射问题');
      }
      
    } catch (error) {
      console.error('解析响应失败:', error.message);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('请求失败:', error.message);
  console.log('请确保服务器正在运行 (npm run dev 或 pm2 start)');
});

req.end();