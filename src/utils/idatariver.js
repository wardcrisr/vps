/**
 * idatariver支付工具类
 * 处理与idatariver支付平台的交互
 */

const axios = require('axios');

// 读取环境变量，兼容两种命名
const SECRET = process.env.IDR_SECRET || process.env.IDATARIVER_SECRET;
const HOST = process.env.IDATARIVER_HOST || 'https://open.idatariver.com';
const PROJECT_ID = process.env.IDR_PROJECT_ID;
const SKU_ID = process.env.IDR_SKU_ID;

if (!SECRET) {
  console.warn('[iDataRiver] 缺少 IDR_SECRET/IDATARIVER_SECRET，支付功能将不可用');
}

// 创建HTTP客户端
const http = axios.create({
  baseURL: `${HOST}/mapi`,
  timeout: 8000,
  headers: {
    Authorization: `Bearer ${SECRET}`,
    'Content-Type': 'application/json',
    'X-Idr-Locale': 'zh-cn'
  }
});

// 根据订单信息动态选择可用支付方式
async function getEnabledMethod(orderId) {
  try {
    const { data } = await http.get('/order/info', { params: { id: orderId } });
    const payments = data.result?.mPayments || data.result?.payments || [];
    const p = payments.find(it => it && (it.enabled === true || it.enable === true));
    return p?.method || p?.paymentMethod || 'alipay';
  } catch (err) {
    console.warn('[iDataRiver] getValidMethod error', err.response?.status || err.message);
    return 'alipay';
  }
}

// 生成安全回调/跳转地址，仅允许白名单域名
const WHITE_DOMAINS = ['fulijix.com'];
function safeUrl(urlObj) {
  try {
    const ok = WHITE_DOMAINS.some(d => urlObj.hostname.endsWith(d));
    return ok ? urlObj.href : '';
  } catch (e) {
    return '';
  }
}

// 添加订单
async function addOrder(amountFen, desc = 'VIP会员充值', contactInfo = '', currency = 'CNY', skuId = null) {
  let data;
  const addBody = {
    projectId: PROJECT_ID,
    orderInfo: {
      quantity: 1,
      contactInfo: contactInfo || 'anonymous',   // iDataRiver 要求 5-100 字符
      coupon: ''
    },
    desc
  };

  // 如果有SKU ID，只传SKU相关参数，不传amount
  if (skuId) {
    addBody.skuId = skuId;
    // SKU模式不传amount，让iDataRiver使用SKU预设价格
  } else {
    // 无SKU时，使用自定义金额
    addBody.amount = amountFen;
    addBody.currency = currency;
  }
  
  try {
    ({ data } = await http.post('/order/add', addBody));
  } catch (err) {
    console.error('[iDataRiver] addOrder axios error', err.response?.status, err.response?.data || err.message);
    throw err;
  }
  
  console.log('[iDataRiver] addOrder resp:', JSON.stringify(data, null, 2));
  if (data.code !== 0 && data.code !== undefined) throw new Error(data.msg || 'addOrderFailException');
  return (data.result && (data.result.id || data.result.orderId)) || data.result || data.data;
}

// 支付订单
async function payOrder(orderId, method = 'alipay') {
  async function requestPay(methodName) {
    const CALLBACK_DEFAULT = process.env.PAY_CALLBACK || 'https://fulijix.com/api/idatariver/webhook';
    const REDIRECT_DEFAULT = process.env.PAY_REDIRECT || 'https://fulijix.com/user/paysuccess';
    const payBody = {
      id: orderId,
      method: methodName,
      callbackUrl: safeUrl(new URL(CALLBACK_DEFAULT)),
      redirectUrl: safeUrl(new URL(REDIRECT_DEFAULT))
    };
    const { data } = await http.post('/order/pay', payBody);
    console.log('PAY-RESP-RAW', methodName, JSON.stringify(data, null, 2));
    if (data.code !== 0) throw new Error(`payOrderFail:${data.msg}`);
    return data.result;
  }

  try {
    const res = await requestPay(method);
    return res.payUrl || res.pay_url || res.cashierUrl || res.cashier_url || res.url || res.paymentUrl || res.payment_url;
  } catch (e) {
    if (method !== 'alipay') {
      // 使用官方通用枚举重试
      const res = await requestPay('alipay');
      return res.payUrl || res.pay_url || res.cashierUrl || res.cashier_url || res.url || res.paymentUrl || res.payment_url;
    }
    console.error('IDR payOrder ERR :', e.response?.data || e);
    throw new Error(e.response?.data?.msg || e.message || 'idr_pay_exception');
  }
}

// 创建VIP充值订单
async function createRecharge(amountFen, contactInfo = '', desc = 'VIP会员充值', skuId = null) {
  let data;
  try {
    // 优先尝试新版 merchant 接口
    // 根据是否传入skuId决定订单创建方式
    let orderData;
    if (skuId) {
      // SKU下单，不需要显式amount，由平台根据skuID价格生成
      orderData = {
        skuId,
        quantity: 1,
        desc,
        notify_url: 'https://fulijix.com/api/idatariver/webhook',
        ...(contactInfo ? { contactInfo } : {})
      };
    } else {
      // 指定金额下单
      orderData = {
        amount: +(amountFen / 100).toFixed(2), // 元为单位
        currency: 'CNY',
        desc,
        notify_url: 'https://fulijix.com/api/idatariver/webhook',
        ...(contactInfo ? { contactInfo } : {})
      };
    }
    ({ data } = await http.post('/merchant/createOrder', orderData));
    console.log('[iDataRiver] merchant/createOrder resp:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('[iDataRiver] merchant/createOrder failed, fallback to addOrder/payOrder', err.response?.status || err.message);
    return fallbackRecharge(amountFen, contactInfo, desc, skuId);
  }

  if (data.code !== 0 && data.code !== undefined) {
    console.warn('[iDataRiver] merchant/createOrder code!=0, fallback. resp=', JSON.stringify(data));
    return fallbackRecharge(amountFen, contactInfo, desc, skuId);
  }

  // 兼容不同返回格式
  const root = data.result || data.data || {};
  const payUrl =
    root.payUrl || root.pay_url || root.cashierUrl || root.cashier_url || root.url || root.qrcode || root.paymentUrl || root.payment_url || root.cashier ||
    data.payUrl || data.pay_url || data.cashierUrl || data.cashier_url || data.url || data.qrcode || data.paymentUrl || data.payment_url || data.cashier;

  if (!payUrl) {
    console.warn('[iDataRiver] merchant/createOrder returned no payUrl, fallback');
    return fallbackRecharge(amountFen, contactInfo, desc, skuId);
  }

  console.log('PAYRESPRAW', JSON.stringify(data, null, 2));
  return {
    payUrl: payUrl,
    orderId: root.orderId || root.id || data.orderId || data.id
  };

  // ===== 内部帮助函数 =====
  async function fallbackRecharge(amountFenLocal, contactInfoLocal, descLocal, skuIdLocal) {
    try {
      const orderId = await addOrder(amountFenLocal, descLocal, contactInfoLocal, 'CNY', skuIdLocal);
      const method = await getEnabledMethod(orderId);
      const url = await payOrder(orderId, method);
      return {
        payUrl: url,
        orderId: orderId
      };
    } catch (e) {
      console.error('[iDataRiver] fallbackRecharge error', e.message);
      throw e;
    }
  }
}

// 查询订单状态
async function getOrderInfo(orderId) {
  try {
    const { data } = await http.get('/order/info', { params: { id: orderId } });
    return data;
  } catch (err) {
    console.error('[iDataRiver] getOrderInfo error', err.response?.status || err.message);
    throw err;
  }
}

module.exports = { 
  addOrder, 
  payOrder, 
  createRecharge, 
  getOrderInfo,
  getEnabledMethod 
};