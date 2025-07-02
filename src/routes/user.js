const express = require('express');
const router = express.Router();

const { optionalAuth } = require('./middleware/auth');

// 个人中心首页
router.get('/', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.redirect('/api/auth/login');
  }

  res.render('user/profile', {
    title: '个人中心',
    user: req.user,
    current: 'profile'
  });
});

// 我的余额页面
router.get('/coin', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.redirect('/api/auth/login');
  }

  // 禁用缓存，始终获取最新余额
  res.set({
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  res.render('user/coin', {
    title: '我的余额',
    user: req.user,
    current: 'coin'
  });
});

module.exports = router; 