const router = require('express').Router();
const User = require('../models/User');
const Log  = require('../models/Log');
const verifySignature = require('../middleware/verifySignature');
const { ok, err } = require('../utils/response');

// POST /api/payment/topup
router.post('/topup', verifySignature, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount || amount <= 0) return err(res, 1, 'invalid params');
    const user = await User.findByIdAndUpdate(userId, { $inc: { coins: amount } }, { new: true });
    if (!user) return err(res, 1, 'user not found', 404);

    await Log.create({ userId, type:'topup', amount, remark:'第三方支付充值' });
    return ok(res, { balance: user.coins });
  } catch (e) {
    console.error('topup error', e);
    return err(res, 1, 'server error', 500);
  }
});

module.exports = router; 