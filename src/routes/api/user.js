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
        isPremium: user.isPremium || false,
        premiumExpiry: user.premiumExpiry,
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
    // 从数据库获取最新的会员状态
    const user = await User.findById(req.user._id).select('isPremium premiumExpiry').lean();
    
    if (!user) {
      return res.json({
        code: 1,
        msg: '用户不存在'
      });
    }

    const now = new Date();
    const isPremiumActive = user.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > now);

    return res.json({
      code: 0,
      msg: '获取成功',
      data: {
        isPremium: isPremiumActive,
        premiumExpiry: user.premiumExpiry,
        daysLeft: isPremiumActive && user.premiumExpiry ? Math.ceil((new Date(user.premiumExpiry) - now) / (1000 * 60 * 60 * 24)) : 0
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

/**
 * 更新用户头像
 * POST /api/user/update-avatar
 */
router.post('/update-avatar', authenticateToken, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    
    if (!avatarUrl) {
      return res.json({
        code: 1,
        msg: '头像URL不能为空'
      });
    }

    // 验证头像URL是否为允许的CDN链接
    const allowedAvatars = [
      'https://fulijix.b-cdn.net/momo.jpg',
      'https://fulijix.b-cdn.net/devil%20momo.jpg'
    ];

    if (!allowedAvatars.includes(avatarUrl)) {
      return res.json({
        code: 1,
        msg: '无效的头像选择'
      });
    }

    // 更新用户头像
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { avatarUrl: avatarUrl },
      { new: true }
    );

    if (!updatedUser) {
      return res.json({
        code: 1,
        msg: '用户不存在'
      });
    }

    return res.json({
      code: 0,
      msg: '头像更新成功',
      data: {
        avatarUrl: updatedUser.avatarUrl
      }
    });

  } catch (error) {
    console.error('更新头像失败:', error);
    return res.json({
      code: 1,
      msg: '服务器错误，请稍后重试'
    });
  }
});

module.exports = router;