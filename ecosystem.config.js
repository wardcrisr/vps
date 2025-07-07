module.exports = {
  apps: [{
    name: 'content-distribution',
    script: 'src/app.js',
    cwd: '/root/content-distribution',

    /* 建议在生产跑 cluster 提升并发；如只需单进程可继续用 fork */
    instances: 'max',
    exec_mode: 'cluster',

    watch: false,
    max_memory_restart: '1G',

    env: {
      NODE_ENV: 'production',
      PORT: 3000,

      /* iDataRiver 必备 */
      IDR_SECRET:       'sk_dd369cf8391ef8c7841cde49beeaa5a1',
      IDR_PROJECT_ID:   '685e041e9a39b8585ce9fe0a',
      IDR_SKU_ID:       '685e6d3881b5e4938026c6aa',
      IDATARIVER_HOST:  'https://open.idatariver.com',
      PAY_CALLBACK:     'https://fulijix.com/api/idatariver/webhook',
      PAY_REDIRECT:     'https://fulijix.com/user/paysuccess',

      /* Bunny 相关 */
      BUNNY_API_KEY:        '0811767b-c5f6-4b79-b94bd422582d-6729-4826',
      BUNNY_VIDEO_LIBRARY:  '461001'
    },

    /* 日志 */
    log_file:   '/var/log/content-distribution.log',
    out_file:   '/var/log/content-distribution-out.log',
    error_file: '/var/log/content-distribution-error.log',
    merge_logs: true,
    time: true
  }]
};

