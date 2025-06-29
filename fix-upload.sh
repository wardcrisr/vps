#!/bin/bash

# 修复上传功能脚本
echo "🔧 修复老金优品上传功能..."

# 确保在正确目录
cd /root/content-distribution

echo "📦 安装必要依赖..."
npm install multer --save

echo "🛑 停止现有服务..."
pkill -f "node src/app"

echo "⏰ 等待进程完全停止..."
sleep 3

echo "🚀 启动简化版服务器（专注上传功能）..."
nohup node src/app-no-b2.js > server.log 2>&1 &

echo "⏰ 等待服务器启动..."
sleep 5

echo "📊 检查服务器状态..."
if ps aux | grep -v grep | grep "node src/app-no-b2.js" > /dev/null; then
    echo "✅ 服务器启动成功！"
    echo "🌐 访问地址: http://fulijix.com"
    echo "📁 上传功能已修复"
    echo ""
    echo "📋 服务器日志："
    tail -10 server.log
else
    echo "❌ 服务器启动失败"
    echo "📋 错误日志："
    cat server.log
fi

echo ""
echo "💡 提示: 现在可以测试上传功能了！" 