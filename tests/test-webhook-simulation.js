// test-webhook-simulation.js
const express = require('express');
const request = require('supertest');
const bunnyWebhookRouter = require('./src/routes/bunnyWebhook');

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/bunny', bunnyWebhookRouter);

async function testWebhookCall() {
  const testPayload = {
    VideoGuid: 'YOUR_TEST_VIDEO_GUID', // 替换为实际GUID
    Status: 3 // 测试不同状态值: 1, 2, 3, 4, 5
  };
  
  console.log('📡 模拟 Webhook 调用...');
  console.log('Payload:', testPayload);
  
  try {
    const response = await request(app)
      .post('/api/bunny/webhook')
      .send(testPayload)
      .expect(200);
    
    console.log('✅ Webhook 调用成功:', response.body);
  } catch (error) {
    console.error('❌ Webhook 调用失败:', error);
  }
}

// 运行测试
testWebhookCall();