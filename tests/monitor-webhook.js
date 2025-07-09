// monitor-webhook.js
const express = require('express');
const app = express();

// 中间件：记录所有请求
app.use((req, res, next) => {
  console.log('\n📡 收到 Webhook 请求:');
  console.log('时间:', new Date().toISOString());
  console.log('方法:', req.method);
  console.log('路径:', req.path);
  console.log('Headers:', req.headers);
  next();
});

app.use(express.json());

// 监控 webhook 端点
app.post('/api/bunny/webhook', (req, res) => {
  console.log('\n📋 Webhook 数据:');
  console.log(JSON.stringify(req.body, null, 2));
  
  const { VideoGuid, Status } = req.body;
  console.log(`\n🎬 视频: ${VideoGuid}`);
  console.log(`📊 状态: ${Status}`);
  
  // 记录状态变化
  const statusMessages = {
    0: '队列中',
    1: '处理中',
    2: '编码中',
    3: '完成',
    4: '失败',
    5: '已准备好'
  };
  
  console.log(`📝 状态说明: ${statusMessages[Status] || '未知状态'}`);
  
  res.status(200).json({ success: true, received: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Webhook 监控服务器启动在端口 ${PORT}`);
  console.log(`📡 监控地址: http://localhost:${PORT}/api/bunny/webhook`);
});