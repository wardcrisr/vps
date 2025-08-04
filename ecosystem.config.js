module.exports = {
  apps: [{
    name: 'content-distribution',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // 健康检查配置
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true,
    
    // 重启策略 - 防止无限重启循环
    min_uptime: '10s',        // 应用必须运行至少10秒才算成功启动
    max_restarts: 10,         // 15分钟内最多重启10次
    restart_delay: 4000,      // 重启延迟4秒
    
    // 进程管理
    kill_timeout: 5000,       // 强制杀死进程前等待5秒
    listen_timeout: 3000,     // 端口监听超时3秒
    
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // 环境变量
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000
    }
  }]
};