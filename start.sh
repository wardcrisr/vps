#!/bin/bash

echo "🚀 老金优品 - 启动脚本"
echo "=========================="

# 检查 node_modules 是否存在 aws-sdk
if [ ! -d "node_modules/aws-sdk" ]; then
    echo "📦 安装 AWS SDK..."
    npm install aws-sdk
fi

# 停止之前的进程
echo "🛑 停止之前的进程..."
pkill -f "node src/app.js" 2>/dev/null || true
sleep 2

# 测试 B2 连接
echo "🔧 测试 Backblaze B2 连接..."
node test-b2.js

# 启动服务器
echo ""
echo "🚀 启动服务器..."
node src/app.js

echo "✅ 启动完成!" 