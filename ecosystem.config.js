module.exports = {
  apps: [{
    name: 'content-distribution',
    script: 'src/app.js',
    cwd: '/root/content-distribution',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/content-distribution.log',
    out_file: '/var/log/content-distribution-out.log',
    error_file: '/var/log/content-distribution-error.log',
    merge_logs: true,
    time: true
  }]
}; 