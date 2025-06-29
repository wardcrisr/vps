#!/bin/bash

# 简单启动脚本 - 老金优品
echo "🚀 老金优品启动脚本"

# 确保在正确目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 当前目录: $(pwd)"

# 检查关键文件
if [ ! -f "src/app.js" ]; then
    echo "❌ 找不到 src/app.js 文件"
    echo "请确保在 /root/content-distribution 目录中运行此脚本"
    exit 1
fi

if [ ! -f "package.json" ]; then
    echo "❌ 找不到 package.json 文件"
    exit 1
fi

echo "✅ 文件检查通过"

# 检查依赖
echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules 不存在，正在安装依赖..."
    npm install
fi

# 检查关键依赖
if [ ! -d "node_modules/aws-sdk" ]; then
    echo "📦 安装 aws-sdk..."
    npm install aws-sdk
fi

if [ ! -d "node_modules/dotenv" ]; then
    echo "📦 安装 dotenv..."
    npm install dotenv
fi

echo "✅ 依赖检查完成"

# 启动应用
echo "🚀 启动应用..."
echo "访问地址: http://localhost:3000"
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动
exec node src/app.js 