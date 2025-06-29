#!/bin/bash

echo "🚀 启动老金优品上传服务器..."

# 确保在正确目录
cd /root/content-distribution

# 停止所有Node进程
echo "🛑 停止现有服务..."
killall node 2>/dev/null || true
sleep 2

# 启动服务器
echo "📁 启动上传服务器..."
echo "访问地址: http://fulijix.com"

# 直接启动，不后台运行
node src/app-no-b2.js 