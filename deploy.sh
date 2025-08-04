#!/bin/bash

# 内容分发平台部署脚本
# 自动部署并设置进程管理

set -e  # 出错时退出

echo "🚀 开始部署内容分发平台..."

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 安装依赖
echo "📦 安装/更新依赖..."
npm install --production

# 创建必要目录
echo "📁 创建目录结构..."
mkdir -p logs
mkdir -p uploads
mkdir -p videos

# 设置脚本权限
echo "🔑 设置执行权限..."
chmod +x start.sh
chmod +x monitor.sh
chmod +x deploy.sh

# 停止现有服务
echo "🛑 停止现有服务..."
pm2 delete content-distribution 2>/dev/null || true

# 启动服务
echo "🔧 启动服务..."
./start.sh

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 健康检查
echo "🔍 执行健康检查..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败"
    pm2 logs content-distribution --lines 20
    exit 1
fi

# 设置PM2开机自启
echo "🔄 设置开机自启..."
pm2 startup || true
pm2 save

echo "🎉 部署完成！"
echo ""
echo "📊 服务状态:"
pm2 status

echo ""
echo "🔗 访问地址:"
echo "   主页: http://localhost:3000"
echo "   健康检查: http://localhost:3000/health"
echo ""
echo "📋 管理命令:"
echo "   ./start.sh          - 启动服务"
echo "   ./monitor.sh        - 监控服务"
echo "   pm2 logs content-distribution - 查看日志"
echo "   pm2 monit           - 实时监控界面"