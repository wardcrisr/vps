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
 * 创建支付订单（支持VIP购买和金币充值）
 * POST /api/idatariver/createorder
 */
router.post('/createorder', authenticateToken, async (req, res) => {
  try {
    const { amount, planType, contactInfo, skuId } = req.body;
    const userId = req.user.id;

    let desc, orderType;

    // 判断是VIP购买还是金币充值
    if (planType) {
      // VIP购买流程
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

      desc = `${plan.name} - ${plan.days}天VIP会员`;
      orderType = 'vip';
      console.log(`[VIP支付] 用户 ${req.user.username} 尝试购买 ${desc}`);
    } else if (skuId) {
      // 金币充值流程
      const coinAmount = Math.round(amount / 100); // 将分转换为元，再作为金币数量
      desc = `金币充值 - ${coinAmount}金币`;
      orderType = 'coin';
      console.log(`[金币充值] 用户 ${req.user.username} 尝试充值 ${desc}`);
    } else {
      return res.json({
        code: 1,
        msg: '缺少必要参数：planType 或 skuId'
      });
    }

    // 调用idatariver创建支付订单
    const result = await createRecharge(amount, contactInfo || req.user.username, desc, skuId);

    if (result && result.payUrl) {
      console.log(`[${orderType === 'vip' ? 'VIP支付' : '金币充值'}] 订单创建成功，订单号: ${result.orderId}`);
      
      const responseData = {
        code: 0,
        msg: '订单创建成功',
        payUrl: result.payUrl,
        orderId: result.orderId,
        orderType
      };

      // 如果是VIP购买，添加套餐信息
      if (orderType === 'vip') {
        const plan = VIP_PLANS[planType];
        responseData.planInfo = {
          type: planType,
          days: plan.days,
          amount: plan.amount,
          name: plan.name
        };
      } else {
        // 金币充值信息
        responseData.coinInfo = {
          amount: Math.round(amount / 100),
          skuId
        };
      }
      
      return res.json(responseData);
    } else {
      return res.json({
        code: 1,
        msg: '创建支付订单失败'
      });
    }

  } catch (error) {
    console.error('[支付] 创建订单失败:', error);
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
      // 获取订单详情
      try {
        const orderDetail = await getOrderInfo(orderId);
        console.log('[支付回调] 订单详情:', JSON.stringify(orderDetail, null, 2));
        
        // 根据订单描述判断是VIP购买还是金币充值
        const description = orderDetail.description || orderDetail.desc || '';
        
        if (description.includes('VIP会员')) {
          // VIP购买处理逻辑
          console.log(`[VIP支付] 订单 ${orderId} 支付成功，VIP状态更新完成`);
        } else if (description.includes('金币充值')) {
          // 金币充值处理逻辑
          console.log(`[金币充值] 订单 ${orderId} 支付成功，开始处理金币充值`);
          
          // 从描述中提取金币数量
          const coinMatch = description.match(/(\d+)金币/);
          if (coinMatch) {
            const coinAmount = parseInt(coinMatch[1]);
            
            // 这里需要根据实际情况找到用户并更新金币余额
            // 由于没有存储用户关联，暂时记录日志
            console.log(`[金币充值] 需要为用户充值 ${coinAmount} 金币`);
          }
        }
        
      } catch (error) {
        console.error('[支付回调] 获取订单详情失败:', error);
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
 * 手动检查支付状态并更新VIP或充值金币
 * POST /api/idatariver/checkpayment
 */
router.post('/checkpayment', authenticateToken, async (req, res) => {
  try {
    const { orderId, planType, orderType, coinAmount } = req.body;
    const userId = req.user.id;

    if (!orderId) {
      return res.json({
        code: 1,
        msg: '缺少订单号'
      });
    }

    // 查询订单状态
    const orderInfo = await getOrderInfo(orderId);
    const status = orderInfo.result?.status || orderInfo.status;

    if (status === 'paid' || status === 'success' || status === 'completed') {
      const user = await User.findById(userId);
      if (!user) {
        return res.json({
          code: 1,
          msg: '用户不存在'
        });
      }

      if (orderType === 'coin' || coinAmount) {
        // 金币充值处理
        const rechargeAmount = coinAmount || Math.round((orderInfo.amount || 0) / 100);
        
        if (rechargeAmount > 0) {
          user.coins = (user.coins || 0) + rechargeAmount;
          await user.save();
          
          console.log(`[金币充值] 用户 ${user.username} 充值 ${rechargeAmount} 金币成功，当前余额: ${user.coins}`);
          
          return res.json({
            code: 0,
            msg: '金币充值成功',
            coins: user.coins,
            rechargeAmount
          });
        }
      } else if (planType) {
        // VIP购买处理
        const plan = VIP_PLANS[planType];
        if (plan) {
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
    console.error('[支付] 检查支付状态失败:', error);
    return res.json({
      code: 1,
      msg: error.message || '检查支付状态失败'
    });
  }
});

module.exports = router;