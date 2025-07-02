const crypto = require('crypto');

module.exports = function verifySignature(req, res, next) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('⚠️ PAYMENT_WEBHOOK_SECRET 未配置, 跳过签名校验');
    return next();
  }
  const sigHeader = req.headers['x-signature'];
  if (!sigHeader) return res.status(403).json({ code:1, message:'signature header missing' });

  const payload = JSON.stringify(req.body);
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (digest !== sigHeader) {
    return res.status(403).json({ code:1, message:'invalid signature' });
  }
  next();
}; 