/**
 * 脚本：迁移历史 isVip/vipExpireDate 到 isPremium/premiumExpiry，并清理旧字段
 * 用法：
 *   node scripts/migrateVipToPremium.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb';
    await mongoose.connect(uri);
    const User = require('../src/models/User');

    const now = new Date();
    const users = await User.find({ $or: [ { isVip: true }, { vipExpireDate: { $ne: null } } ] }).lean(false);
    console.log(`发现 ${users.length} 条需要迁移的用户记录`);

    let migrated = 0;
    for (const u of users) {
      const wasVip = !!u.isVip;
      const oldExpire = u.vipExpireDate ? new Date(u.vipExpireDate) : null;
      const active = wasVip && (!oldExpire || oldExpire > now);

      if (active) {
        u.isPremium = true;
        // 若旧字段有到期时间，则迁移；否则视为永久
        if (oldExpire) {
          u.premiumExpiry = oldExpire;
        } else {
          u.premiumExpiry = null;
        }
      } else {
        // 非激活或过期，清空为非会员
        u.isPremium = false;
        u.premiumExpiry = null;
      }

      // 清理旧字段（保留字段但置为默认）
      u.isVip = undefined;
      u.vipExpireDate = undefined;

      await u.save();
      migrated++;
    }

    console.log(`迁移完成：${migrated}/${users.length}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('迁移失败:', e);
    process.exit(1);
  }
})();


