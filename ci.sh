#!/usr/bin/env bash
set -e

# 1. 环境变量配置
export NODE_ENV=test
export STRIPE_SECRET_KEY=sk_test_dummy
export MONGODB_URI=mongodb://127.0.0.1:27017/citest

# 2. 进入项目目录
cd content-distribution

# 3. 安装依赖（忽略安装脚本，跳过 audit 和 fund 提示）
npm ci --ignore-scripts --no-audit --no-fund

# 4. 释放 3000 端口（如有进程占用，则强制杀掉）
lsof -ti:3000 | xargs -r kill -9

# 5. 启动服务并重定向日志
node src/app.js > ciserver.log 2>&1 &
PID=$!
echo "服务启动，PID=$PID"
sleep 3

# 6. 健康检查：Curl 调用并重定向日志
curl -i -X POST http://127.0.0.1:3000/api/createpaymentintent \
     -H "Content-Type: application/json" \
     -d "{\"amount\":500,\"currency\":\"usd\"}" > cicurl.log 2>&1
echo "已执行健康检查，结果保存在 cicurl.log"

# 7. 运行 Jest 自动化测试并重定向日志
npx jest --detectOpenHandles --verbose tests/payment.test.js > cijest.log 2>&1
echo "已执行 Jest 测试，结果保存在 cijest.log"

# 8. 停止服务
kill -9 $PID
echo "已停止服务，PID=$PID"

# 9. 打包所有日志
tar czf cilogs.tar.gz ciserver.log cicurl.log cijest.log
echo "日志已打包：$(pwd)/cilogs.tar.gz"
