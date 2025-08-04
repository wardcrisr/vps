#!/bin/bash

# 内容分发平台启动脚本
# 使用PM2进程管理器启动应用

echo "🚀 启动内容分发平台..."

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2未安装，正在安装..."
    npm install -g pm2
fi

# 创建日志目录
mkdir -p logs

# 停止现有进程
echo "🛑 停止现有进程..."
pm2 delete content-distribution 2>/dev/null || true

# 清空日志
echo "🧹 清空旧日志..."
pm2 flush

# 使用ecosystem配置启动
echo "🔧 使用PM2启动应用..."
pm2 start ecosystem.config.js --env production

# 显示状态
echo "📊 应用状态："
pm2 status

# 显示日志
echo "📋 最近日志："
pm2 logs content-distribution --lines 10

echo "✅ 启动完成！"
echo "💡 使用以下命令管理应用："
echo "   pm2 status                  - 查看状态"
echo "   pm2 logs content-distribution - 查看日志"
echo "   pm2 restart content-distribution - 重启应用"
echo "   pm2 stop content-distribution - 停止应用"
echo "   pm2 monit                   - 实时监控"