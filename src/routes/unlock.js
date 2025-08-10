const express = require('express');
const crypto  = require('crypto');
const mongoose = require('mongoose');

const Media    = require('../models/Media');
const User     = require('../models/User');
const Purchase = require('../models/Purchase');
const { authenticateToken } = require('./middleware/auth');
const { ensureAllowedUA } = require('../middleware/uaGuard');

const router = express.Router();

/**
 * POST /api/unlock/:videoId
 * Header: Authorization: Bearer <JWT>
 * Body: { hoursValid?: number }
 * Response: { iframe: string }
 */
router.post('/:videoId', ensureAllowedUA(), authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  const { videoId }  = req.params;
  const hoursValid   = Number(req.body.hoursValid) || 72; // 默认72小时
  const userId       = req.user._id;

  try {
    await session.withTransaction(async () => {
      // 1. 获取视频与用户信息
      const [video, user] = await Promise.all([
        Media.findById(videoId).session(session),
        User.findById(userId).session(session),
      ]);

      if (!video) {
        return res.status(404).json({ message: '视频不存在' });
      }
      if (!user) {
        return res.status(401).json({ message: '用户不存在' });
      }

      // 2. 查找购买记录
      let purchase = await Purchase.findOne({ userId, videoId }).session(session);
      const now = new Date();
      const newExpiry = new Date(now.getTime() + hoursValid * 3600_000);

      // 统一价格逻辑：付费分类且未设置价格时，默认10金币
      let price = (video.priceCoins ?? video.downloadPrice ?? 0);
      if (price <= 0 && video.category === 'paid') {
        price = 10;
      }

      if (!purchase || purchase.expiresAt < now) {
        if (user.coins < price) {
          return res.status(402).json({ message: '金币不足' });
        }
        // 扣费
        user.coins -= price;
        await user.save({ session });

        // 插入/更新购买记录
        purchase = await Purchase.findOneAndUpdate(
          { userId, videoId },
          { $set: { price, expiresAt: newExpiry } },
          { upsert: true, new: true, session }
        );
      }

      // 3. 生成 Bunny Token
      const expires = Math.floor(purchase.expiresAt.getTime() / 1000);
      const raw     = `${process.env.BUNNY_SECRET}${video.bunnyId}${expires}`;
      const token   = crypto.createHash('sha256').update(raw).digest('hex');
      const iframe  = `https://iframe.mediadelivery.net/embed/${process.env.LIB_ID || process.env.BUNNY_VIDEO_LIBRARY}/${video.bunnyId}?token=${token}&expires=${expires}`;

      return res.json({ iframe });
    });
  } catch (error) {
    console.error('unlock error:', error);
    // 并发/事务冲突
    if (error.codeName === 'WriteConflict') {
      return res.status(409).json({ message: '事务冲突，请重试' });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

module.exports = router; 