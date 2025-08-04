const express = require('express');
const router = express.Router();

const { optionalAuth } = require('./middleware/auth');
const User = require('../models/User');

// 个人中心首页
router.get('/', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.redirect('/api/auth/login');
  }

  try {
    // 优化：直接使用optionalAuth中间件已查询的用户数据
    // 避免重复数据库查询，显著提升响应速度
    let userData = req.user;
    
    // 仅在用户数据不完整或需要最新关键数据时才重新查询
    if (!userData.coins && userData.coins !== 0) {
      console.log('🔄 需要补充用户金币数据，执行单次查询');
      const coinData = await User.findById(req.user._id)
        .select('coins isVip vipExpireDate')
        .lean();
      userData = { ...userData, ...coinData };
    }

    // 优化缓存控制：允许短时间缓存，减少服务器压力
    res.set({
      'Cache-Control': 'private, max-age=30', // 30秒私有缓存
      'Last-Modified': new Date().toUTCString()
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

    // VIP会员套餐对应的 SKU ID
    const vipSkuIds = {
      monthly   : process.env.IDR_SKU_ID_2,  // 月度会员 = 30金币
      quarterly : process.env.IDR_SKU_ID_7,  // 季度会员 = 新SKU
      yearly    : process.env.IDR_SKU_ID_6,  // 年度会员 = 300金币
    };

    res.render('user/profile', {
      title: '个人中心',
      user: userData,
      current: 'profile',
      skuIds,
      vipSkuIds
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return res.redirect('/api/auth/login');
  }
});

// 我的余额页面
router.get('/coin', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.redirect('/api/auth/login');
  }

  try {
    // 优化：复用optionalAuth中的用户数据，避免重复查询
    let userData = req.user;
    
    // 仅在金币数据缺失时才补充查询
    if (!userData.coins && userData.coins !== 0) {
      const coinData = await User.findById(req.user._id)
        .select('coins')
        .lean();
      userData = { ...userData, coins: coinData.coins };
    }

    // 优化缓存控制：金币页面允许短时间缓存
    res.set({
      'Cache-Control': 'private, max-age=15', // 15秒私有缓存
      'Last-Modified': new Date().toUTCString()
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
      user: userData,
      current: 'coin',
      skuIds
    });
  } catch (error) {
    console.error('获取用户余额信息失败:', error);
    return res.redirect('/api/auth/login');
  }
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

// 临时调试路由 - 检查环境变量
router.get('/debug-env', (req, res) => {
  const skuIds = {
    10  : process.env.IDR_SKU_ID_1,
    30  : process.env.IDR_SKU_ID_2,
    50  : process.env.IDR_SKU_ID_3,
    100 : process.env.IDR_SKU_ID_4,
    200 : process.env.IDR_SKU_ID_5,
    300 : process.env.IDR_SKU_ID_6,
  };
  res.json({
    message: '环境变量检查',
    skuIds: skuIds,
    nodeEnv: process.env.NODE_ENV
  });
});

module.exports = router; 