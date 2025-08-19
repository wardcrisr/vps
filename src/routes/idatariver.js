/**
 * idatariver支付路由
 * 处理VIP会员购买相关的支付接口
 */

const express = require('express');
const router = express.Router();
const { createRecharge, getOrderInfo } = require('../utils/idatariver');
const querystring = require('querystring');
const { authenticateToken } = require('./middleware/auth');
const User = require('../models/User');

// VIP套餐配置
const VIP_PLANS = {
  monthly: { days: 30, amount: 30, name: '包月会员' },
  quarterly: { days: 90, amount: 90, name: '包季会员' },
  yearly: { days: 365, amount: 300, name: '包年会员' }
};

// 月度VIP对应SKU（与前端 `skuIds[30]` 保持一致）
const VIP_MONTHLY_SKU = process.env.IDR_SKU_ID_2 || process.env.IDR_SKU_VIP_MONTHLY || '';

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
      // 当使用月度VIP的SKU下单时，按VIP购买处理
      if (VIP_MONTHLY_SKU && String(skuId) === String(VIP_MONTHLY_SKU)) {
        const plan = VIP_PLANS.monthly;
        desc = `${plan.name} - ${plan.days}天VIP会员`;
        orderType = 'vip';
        console.log(`[VIP支付] 用户 ${req.user.username} 通过SKU(${skuId}) 购买 ${desc}`);
      } else {
        // 金币充值流程
        const coinAmount = Math.round(amount / 100); // 将分转换为元，再作为金币数量
        desc = `金币充值 - ${coinAmount}金币`;
        orderType = 'coin';
        console.log(`[金币充值] 用户 ${req.user.username} 尝试充值 ${desc}`);
      }
    } else {
      return res.json({
        code: 1,
        msg: '缺少必要参数：planType 或 skuId'
      });
    }

    // 调用idatariver创建支付订单
    // 直接透传 contactInfo（通常为注册邮箱）；若缺失则回退到用户邮箱/用户名
    const safeContact = (contactInfo || req.user.email || req.user.username || 'anonymous')
      .toString()
      .slice(0, 80);
    const result = await createRecharge(amount, safeContact, desc, skuId);

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
        const plan = VIP_PLANS[planType] || VIP_PLANS.monthly;
        responseData.planInfo = {
          type: planType || 'monthly',
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
router.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    console.log('[VIP支付] 收到支付回调:', req.body);
    
    // 解析回调数据
    let callbackData;
    try {
      // 统一拿到原始文本
      let rawText;
      if (Buffer.isBuffer(req.body)) {
        rawText = req.body.toString('utf8');
      } else if (typeof req.body === 'string') {
        rawText = req.body;
      } else if (typeof req.body === 'object' && req.body !== null && Object.keys(req.body).length > 0) {
        // 已被上游 json/urlencoded 解析过
        callbackData = req.body;
      }

      if (!callbackData) {
        // 根据 content-type 再次尝试解析
        const contentType = (req.headers['content-type'] || '').toLowerCase();
        if (rawText && rawText.trim().length > 0) {
          if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
            callbackData = JSON.parse(rawText);
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            callbackData = querystring.parse(rawText);
          } else {
            // 尝试先按 JSON，失败再按表单
            try {
              callbackData = JSON.parse(rawText);
            } catch {
              callbackData = querystring.parse(rawText);
            }
          }
        }
      }
    } catch (e) {
      console.error('[VIP支付] 回调数据解析失败:', e);
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // 验证回调数据
    // 兼容多层结构字段
    const tryGet = (obj, paths) => {
      for (const p of paths) {
        try {
          const val = p.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
          if (val !== undefined && val !== null && String(val).length > 0) return val;
        } catch (_) {}
      }
      return undefined;
    };

    const orderIdCandidate = tryGet(callbackData, [
      'orderId','id','result.orderId','result.id','data.orderId','data.id','order.id','order.orderId'
    ]);

    if (!orderIdCandidate) {
      console.error('[VIP支付] 回调缺少订单号，payload=', JSON.stringify(callbackData));
      return res.status(400).json({ error: 'Missing order ID' });
    }

    const orderId = orderIdCandidate;
    const status = tryGet(callbackData, ['status','orderStatus','result.status','data.status']);
    const rawDesc = tryGet(callbackData, ['description','desc','result.description','result.desc','data.description','data.desc']) || '';
    const contactInfo = tryGet(callbackData, ['contactInfo','contact','result.contactInfo','data.contactInfo']) || '';
    const skuIdFromCallback = tryGet(callbackData, ['skuId','sku','result.skuId','data.skuId']) || '';

    console.log(`[VIP支付] 订单 ${orderId} 状态: ${status}`);

    // 只处理支付成功的回调
    if (status === 'paid' || status === 'success' || status === 'completed') {
      // 获取订单详情
      try {
        const orderDetail = await getOrderInfo(orderId);
        console.log('[支付回调] 订单详情:', JSON.stringify(orderDetail, null, 2));
        
        // 根据订单描述判断是VIP购买还是金币充值
        const description = orderDetail.description || orderDetail.desc || rawDesc || '';
        const skuId = orderDetail.result?.skuId || orderDetail.skuId || skuIdFromCallback || '';
        const contact = orderDetail.result?.contactInfo || orderDetail.contactInfo || contactInfo || '';
        
        if (description.includes('VIP会员') || (VIP_MONTHLY_SKU && String(skuId) === String(VIP_MONTHLY_SKU))) {
          // VIP购买处理逻辑：通过 contactInfo 定位用户（优先邮箱，回退用户名）
          if (contact) {
            const user = await User.findOne({ $or: [ { email: contact }, { username: contact } ] });
            if (user) {
              const now = new Date();
              const base = user.premiumExpiry && user.premiumExpiry > now ? user.premiumExpiry : now;
              const newExpiry = new Date(base.getTime() + VIP_PLANS.monthly.days * 24 * 60 * 60 * 1000);
              user.isPremium = true;
              user.premiumExpiry = newExpiry;
              await user.save();
              console.log(`[VIP支付] 用户 ${user.username}(${user._id}) 月度VIP开通成功，到期时间: ${newExpiry.toISOString()}`);
            } else {
              console.warn(`[VIP支付] 未找到与 contactInfo 匹配的用户: ${contact}`);
            }
          } else {
            console.warn('[VIP支付] 回调缺少 contactInfo，无法自动更新VIP状态');
          }
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
          const base = user.premiumExpiry && user.premiumExpiry > now ? user.premiumExpiry : now;
          const newExpiry = new Date(base.getTime() + plan.days * 24 * 60 * 60 * 1000);
          
          user.isPremium = true;
          user.premiumExpiry = newExpiry;
          await user.save();
          
          console.log(`[VIP支付] 用户 ${user.username} VIP状态更新成功，到期时间: ${newExpiry}`);
          
          return res.json({
            code: 0,
            msg: 'VIP开通成功',
            premiumExpiry: newExpiry
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