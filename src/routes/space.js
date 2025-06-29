const express = require('express');
const router = express.Router();
const spaceController = require('../controllers/spaceController');
const { optionalAuth } = require('./middleware/auth');

// UP主空间页面路由
router.get('/:uid', optionalAuth, spaceController.spacePage);

// API路由 - 获取UP主视频列表
router.get('/:uid/videos', spaceController.getUploaderVideos);

// API路由 - 获取UP主合集列表  
router.get('/:uid/collections', spaceController.getUploaderCollections);

module.exports = router; 