require('dotenv').config();
const app = require('./app');
const PORT = process.env.PORT || 3000;

// 新增：集成 Socket.io
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// 将 io 实例注入到 app 中，方便路由内部调用
app.set('io', io);

io.on('connection', (socket) => {
  console.log('📡 前端已连接 Socket.io');
});

if (process.env.NODE_ENV !== 'test') {
  const httpServer = server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server…');
    httpServer.close(async () => {
      console.log('HTTP server closed');
      // 关闭数据库连接
      try {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
      } catch (e) {
        console.error('Error closing MongoDB connection:', e);
      }
      process.exit(0);
    });
  });
}
