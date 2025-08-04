#!/bin/bash

# 内容分发平台监控脚本
# 检查应用健康状态并发送告警

APP_NAME="content-distribution"
LOG_FILE="./logs/monitor.log"
HEALTH_URL="http://localhost:3000"

# 创建日志文件
touch $LOG_FILE

# 获取当前时间
timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# 记录日志
log() {
    echo "[$(timestamp)] $1" | tee -a $LOG_FILE
}

# 检查PM2进程状态
check_pm2_status() {
    local status=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status" 2>/dev/null)
    echo $status
}

# 检查HTTP响应
check_http_response() {
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 --max-time 10 $HEALTH_URL 2>/dev/null)
    echo $http_code
}

# 检查内存使用
check_memory_usage() {
    local memory=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.axm_monitor.\"Used Heap Size\".value" 2>/dev/null)
    echo $memory
}

# 主监控逻辑
main() {
    log "开始健康检查..."
    
    # 检查PM2状态
    pm2_status=$(check_pm2_status)
    log "PM2状态: $pm2_status"
    
    if [ "$pm2_status" != "online" ]; then
        log "⚠️  警告: 应用状态异常 ($pm2_status)，尝试重启..."
        pm2 restart $APP_NAME
        sleep 5
        pm2_status=$(check_pm2_status)
        log "重启后状态: $pm2_status"
    fi
    
    # 检查HTTP响应
    http_code=$(check_http_response)
    log "HTTP响应码: $http_code"
    
    if [ "$http_code" != "200" ]; then
        log "⚠️  警告: HTTP响应异常 ($http_code)，尝试重启..."
        pm2 restart $APP_NAME
        sleep 5
        http_code=$(check_http_response)
        log "重启后HTTP响应: $http_code"
    fi
    
    # 检查内存使用
    memory=$(check_memory_usage)
    if [ ! -z "$memory" ]; then
        log "内存使用: ${memory}MB"
    fi
    
    # 显示最近错误日志
    if [ -f "./logs/err.log" ]; then
        error_count=$(tail -n 100 ./logs/err.log | wc -l)
        if [ $error_count -gt 0 ]; then
            log "⚠️  发现 $error_count 条最近错误，请检查 ./logs/err.log"
        fi
    fi
    
    log "健康检查完成 ✅"
    echo "---"
}

# 如果传入参数 --cron，则只运行一次（用于crontab）
if [ "$1" = "--cron" ]; then
    main
else
    # 交互模式，持续监控
    echo "🔍 启动持续监控模式..."
    echo "按 Ctrl+C 停止监控"
    while true; do
        main
        sleep 60  # 每分钟检查一次
    done
fi