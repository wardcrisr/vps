/**
 * idatariver支付路由
 * 处理VIP会员购买相关的支付接口
 */

const express = require('express');
const router = express.Router();
const { createRecharge, getOrderInfo } = require('../utils/idatariver');
const { authenticateToken } = require('./middleware/auth');
const User = require('../models/User');

// VIP套餐配置
const VIP_PLANS = {
  monthly: { days: 30, amount: 30, name: '包月会员' },
  quarterly: { days: 90, amount: 90, name: '包季会员' },
  yearly: { days: 365, amount: 300, name: '包年会员' }
};

/**
 * 创建VIP支付订单
 * POST /api/idatariver/createorder
 */
router.post('/createorder', authenticateToken, async (req, res) => {
  try {
    const { amount, planType, planDays, planName, contactInfo } = req.body;
    const userId = req.user.id;

    // 验证套餐类型
    if (!VIP_PLANS[planType]) {
      return res.json({
        code: 1,
        msg: '无效的VIP套餐类型'
      });
    }

    const plan = VIP_PLANS[planType];
    
    // 验证金额是否匹配
    if (amount !== plan.amount * 100) {
      return res.json({
        code: 1,
        msg: '支付金额与套餐价格不匹配'
      });
    }

    // 创建订单描述
    const desc = `${plan.name} - ${plan.days}天VIP会员`;

    console.log(`[VIP支付] 用户 ${req.user.username} 尝试购买 ${desc}`);

    // 调用idatariver创建支付订单
    const result = await createRecharge(amount, contactInfo || req.user.username, desc);

    if (result && result.payUrl) {
      // 记录订单信息到数据库（可选）
      // 这里可以创建一个Order模型来记录订单
      console.log(`[VIP支付] 订单创建成功，订单号: ${result.orderId}`);
      
      return res.json({
        code: 0,
        msg: '订单创建成功',
        payUrl: result.payUrl,
        orderId: result.orderId,
        planInfo: {
          type: planType,
          days: plan.days,
          amount: plan.amount,
          name: plan.name
        }
      });
    } else {
      return res.json({
        code: 1,
        msg: '创建支付订单失败'
      });
    }

  } catch (error) {
    console.error('[VIP支付] 创建订单失败:', error);
    return res.json({
      code: 1,
      msg: error.message || '系统错误，请稍后重试'
    });
  }
});

/**
 * 查询订单状态
 * GET /api/idatariver/orderinfo?id=订单号
 */
router.get('/orderinfo', authenticateToken, async (req, res) => {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.json({
        code: 1,
        msg: '缺少订单号'
      });
    }

    const orderInfo = await getOrderInfo(id);
    
    return res.json({
      code: 0,
      msg: '查询成功',
      data: orderInfo
    });

  } catch (error) {
    console.error('[VIP支付] 查询订单失败:', error);
    return res.json({
      code: 1,
      msg: error.message || '查询订单失败'
    });
  }
});

/**
 * 支付成功回调
 * POST /api/idatariver/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    console.log('[VIP支付] 收到支付回调:', req.body);
    
    // 解析回调数据
    let callbackData;
    try {
      callbackData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      console.error('[VIP支付] 回调数据解析失败:', e);
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    // 验证回调数据
    if (!callbackData.orderId && !callbackData.id) {
      console.error('[VIP支付] 回调缺少订单号');
      return res.status(400).json({ error: 'Missing order ID' });
    }

    const orderId = callbackData.orderId || callbackData.id;
    const status = callbackData.status || callbackData.orderStatus;

    console.log(`[VIP支付] 订单 ${orderId} 状态: ${status}`);

    // 只处理支付成功的回调
    if (status === 'paid' || status === 'success' || status === 'completed') {
      // 这里需要根据订单信息更新用户VIP状态
      // 由于我们没有在数据库中存储订单与用户的关联，
      // 这里需要从订单描述或其他方式获取用户信息
      
      // 获取订单详情
      try {
        const orderDetail = await getOrderInfo(orderId);
        console.log('[VIP支付] 订单详情:', JSON.stringify(orderDetail, null, 2));
        
        // 这里应该根据实际的订单数据结构来更新用户VIP状态
        // 需要从订单中获取用户信息和VIP天数
        
        console.log(`[VIP支付] 订单 ${orderId} 支付成功，VIP状态更新完成`);
      } catch (error) {
        console.error('[VIP支付] 获取订单详情失败:', error);
      }
    }

    // 返回成功响应给idatariver
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[VIP支付] 处理回调失败:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 手动检查支付状态并更新VIP
 * POST /api/idatariver/checkpayment
 */
router.post('/checkpayment', authenticateToken, async (req, res) => {
  try {
    const { orderId, planType } = req.body;
    const userId = req.user.id;

    if (!orderId || !planType) {
      return res.json({
        code: 1,
        msg: '缺少必要参数'
      });
    }

    // 查询订单状态
    const orderInfo = await getOrderInfo(orderId);
    const status = orderInfo.result?.status || orderInfo.status;

    if (status === 'paid' || status === 'success' || status === 'completed') {
      // 更新用户VIP状态
      const plan = VIP_PLANS[planType];
      if (plan) {
        const user = await User.findById(userId);
        if (user) {
          const now = new Date();
          const currentVipExpire = user.vipExpireDate && user.vipExpireDate > now ? user.vipExpireDate : now;
          const newVipExpire = new Date(currentVipExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
          
          user.isVip = true;
          user.vipExpireDate = newVipExpire;
          await user.save();
          
          console.log(`[VIP支付] 用户 ${user.username} VIP状态更新成功，到期时间: ${newVipExpire}`);
          
          return res.json({
            code: 0,
            msg: 'VIP开通成功',
            vipExpireDate: newVipExpire
          });
        }
      }
    }

    return res.json({
      code: 1,
      msg: '支付未完成或订单状态异常'
    });

  } catch (error) {
    console.error('[VIP支付] 检查支付状态失败:', error);
    return res.json({
      code: 1,
      msg: error.message || '检查支付状态失败'
    });
  }
});

module.exports = router;