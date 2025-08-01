/**
 * 用户相关API接口
 * 提供获取用户信息、更新用户信息等功能
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../../models/User');

/**
 * 获取用户信息
 * GET /api/user/info
 */
router.get('/info', authenticateToken, async (req, res) => {
  try {
    // 从数据库获取最新的用户信息
    const user = await User.findById(req.user._id).select('-password').lean();
    
    if (!user) {
      return res.json({
        code: 1,
        msg: '用户不存在'
      });
    }

    return res.json({
      code: 0,
      msg: '获取成功',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        coins: user.coins || 0,
        isVip: user.isVip || false,
        vipExpireDate: user.vipExpireDate,
        role: user.role,
        joinDate: user.joinDate,
        totalDownloads: user.totalDownloads || 0
      }
    });

  } catch (error) {
    console.error('获取用户信息失败:', error);
    return res.json({
      code: 1,
      msg: '服务器错误'
    });
  }
});

/**
 * 获取用户金币余额
 * GET /api/user/coins
 */
router.get('/coins', authenticateToken, async (req, res) => {
  try {
    // 从数据库获取最新的金币余额
    const user = await User.findById(req.user._id).select('coins').lean();
    
    if (!user) {
      return res.json({
        code: 1,
        msg: '用户不存在'
      });
    }

    return res.json({
      code: 0,
      msg: '获取成功',
      data: {
        coins: user.coins || 0
      }
    });

  } catch (error) {
    console.error('获取用户金币失败:', error);
    return res.json({
      code: 1,
      msg: '服务器错误'
    });
  }
});

/**
 * 获取VIP状态
 * GET /api/user/vip-status
 */
router.get('/vip-status', authenticateToken, async (req, res) => {
  try {
    // 从数据库获取最新的VIP状态
    const user = await User.findById(req.user._id).select('isVip vipExpireDate').lean();
    
    if (!user) {
      return res.json({
        code: 1,
        msg: '用户不存在'
      });
    }

    const now = new Date();
    const isVipActive = user.isVip && user.vipExpireDate && new Date(user.vipExpireDate) > now;

    return res.json({
      code: 0,
      msg: '获取成功',
      data: {
        isVip: isVipActive,
        vipExpireDate: user.vipExpireDate,
        daysLeft: isVipActive ? Math.ceil((new Date(user.vipExpireDate) - now) / (1000 * 60 * 60 * 24)) : 0
      }
    });

  } catch (error) {
    console.error('获取VIP状态失败:', error);
    return res.json({
      code: 1,
      msg: '服务器错误'
    });
  }
});

module.exports = router;