#!/bin/bash

echo "🚀 启动老金优品云存储系统..."

# 安装缺失的依赖
echo "📦 检查并安装依赖..."
npm install aws-sdk b2-cloud-storage dotenv >/dev/null 2>&1

# 停止可能存在的进程
pkill -f "node src/app.js" 2>/dev/null || true
sleep 1

# 启动服务器
echo "🚀 启动服务器..."
echo "访问地址: http://localhost:3000"
node src/app.js 