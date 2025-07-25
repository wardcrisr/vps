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

  // 前端充值面额对应的 SKU ID
  const skuIds = {
    10  : process.env.IDR_SKU_ID_1,
    30  : process.env.IDR_SKU_ID_2,
    50  : process.env.IDR_SKU_ID_3,
    100 : process.env.IDR_SKU_ID_4,
    200 : process.env.IDR_SKU_ID_5,
    300 : process.env.IDR_SKU_ID_6,
  };

  res.render('user/coin', {
    title: '我的余额',
    user: req.user,
    current: 'coin',
    skuIds
  });
});

// 支付结果页面
router.get('/pay-result', optionalAuth, (req, res) => {
  // 支付完成后第三方将跳回此页，使用前端脚本轮询订单状态
  res.render('user/pay-result', {
    title: '支付结果',
    user: req.user,
    current: 'pay-result'
  });
});

module.exports = router; 