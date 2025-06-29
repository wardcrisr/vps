const express = require('express');
const router = express.Router();

// B2直传服务已移除，所有相关功能已停用

/**
 * POST /api/direct-upload/create
 * B2直传功能已移除
 */
router.post('/create', async (req, res) => {
  res.status(503).json({
    success: false,
    message: 'B2直传功能已移除，请使用其他上传方式'
  });
});

/**
 * POST /api/direct-upload/complete
 * B2直传功能已移除
 */
router.post('/complete', async (req, res) => {
  res.status(503).json({
    success: false,
    message: 'B2直传功能已移除，请使用其他上传方式'
  });
});

/**
 * POST /api/direct-upload/generate-download-url
 * B2下载功能已移除
 */
router.post('/generate-download-url', async (req, res) => {
  res.status(503).json({
    success: false,
    message: 'B2下载功能已移除，请使用本地存储'
  });
});

/**
 * POST /api/direct-upload/abort
 * B2直传功能已移除
 */
router.post('/abort', async (req, res) => {
  res.status(503).json({
    success: false,
    message: 'B2直传功能已移除'
  });
});

module.exports = router; 