const express = require('express');
const router  = express.Router();

const { authenticateToken } = require('./middleware/auth');
const User = require('../models/User');

// GET /api/user/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 禁用缓存
    res.set({
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('profile api error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 