const router = require('express').Router();
const { createRecharge, getOrderInfo } = require('../services/iDataRiverService');

// 创建订单 + 获取 payUrl
router.post('/createorder', async (req, res) => {
  try {
    const { amount, contactInfo } = req.body;
    const { payUrl, orderId } = await createRecharge(amount, contactInfo);
    res.json({ code: 0, payUrl, orderId });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

// 订单状态查询（前端轮询用，避免暴露 Bearer Token）
router.get('/orderinfo', async (req, res) => {
  try {
    const orderId = req.query.id;
    if(!orderId){
      return res.status(400).json({ code: 400, msg: 'missing id' });
    }
    const info = await getOrderInfo(orderId);
    res.json(info);
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

// 支付回调 Webhook
router.post('/webhook', async (req, res) => {
  /* 验签（可选），再查 order/info 校验 DONE */
  res.sendStatus(200);     // 必须 200，否则 iDataRiver 会重试
});

module.exports = router;

 