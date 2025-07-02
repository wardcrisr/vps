const express = require('express');
require('dotenv').config();

const router = express.Router();
router.use(express.json());

// 创建订单并返回 payUrl
// POST /api/idatariver/createorder { quantity?: number, contact?: string }
const { createRecharge } = require('../services/iDataRiverService');

router.post('/createorder', async (req, res) => {
  try {
    let { amount } = req.body || {};
    amount = Number(amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'invalid amount' });
    }

    const payUrl = await createRecharge(amount);
    if (!payUrl) {
      console.error('[iDataRiver] create-order resp invalid');
      return res.status(502).json({ success: false, message: 'PAY_URL_EMPTY' });
    }
    return res.json({ success: true, payUrl });
  } catch (err) {
    console.error('[iDataRiver] createorder error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'IDR_INTERNAL' });
  }
});

router.post('/create-order', async (req, res) => {
  try {
    let { amount } = req.body || {};
    amount = Number(amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'invalid amount' });
    }

    const payUrl = await createRecharge(amount);
    if (!payUrl) {
      console.error('[iDataRiver] create-order resp invalid');
      return res.status(502).json({ success: false, message: 'PAY_URL_EMPTY' });
    }
    return res.json({ success: true, payUrl });
  } catch (err) {
    console.error('[iDataRiver] createorder error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'IDR_INTERNAL' });
  }
});

// Webhook 回调
// POST /api/idatariver/webhook
router.post('/webhook', async (req, res) => {
  const evt = req.body;
  try {
    if (evt.status === 'PAID') {
      // 这里根据业务调整字段，假设 evt.extra.user_id 保存用户ID
      const userId = evt.extra?.user_id || evt.user_id;
      const amount = Number(evt.amount) || 0;
      if (userId && amount > 0) {
        const User = require('../models/User');
        await User.findByIdAndUpdate(userId, { $inc: { coins: amount / 100 } }); // 充值金币=分/100
      }
    }
  } catch (e) {
    console.error('iDataRiver webhook process error:', e);
    // 仍返回 200 让平台不重试，视需要写入日志
  }
  res.sendStatus(200);
});

router.get('/ping', (req,res)=>res.json({pong:true}));

// 临时调试接口，回显 body
router.post('/echo', (req,res)=>res.json({body:req.body}));

module.exports = router; 