const fs = require('fs');
const path = require('path');
const axios = require('axios');
// 统一加载环境变量
require('../config/envloader');

// 读取环境变量，兼容两种命名
const SECRET = process.env.IDR_SECRET || process.env.IDATARIVER_SECRET;
const HOST   = process.env.IDATARIVER_HOST || 'https://open.idatariver.com';

if (!SECRET) {
  console.warn('[iDataRiver] 缺少 IDR_SECRET/IDATARIVER_SECRET，支付功能将不可用');
}

const http = axios.create({
  baseURL: HOST,
  timeout: 8000,
  headers: {
    Authorization: `Bearer ${SECRET}`,
    'Content-Type': 'application/json',
    'X-Idr-Locale': 'zh-cn'
  }
});

async function addOrder(amountFen, desc = '账户余额充值', currency = 'CNY') {
  let data;
  try {
    ({ data } = await http.post('/mapi/order/add', {
      amount: amountFen,
      currency,
      desc
    }));
  } catch (err) {
    console.error('[iDataRiver] addOrder axios error', err.response?.status, err.response?.data || err.message);
    throw err;
  }
  console.log('[iDataRiver] addOrder resp:', JSON.stringify(data, null, 2));
  if (data.code !== 0 && data.code !== undefined) throw new Error(`addOrderFail:${data.msg}`);
  return (data.result && (data.result.id || data.result.orderId)) || data.result || data.data;
}

async function payOrder(orderId, method = 'alipay_qr') {
  const { data } = await http.post('/mapi/order/pay', {
    id: orderId,
    method,
    callbackUrl: 'https://fulijix.com/api/idatariver/webhook',
    redirectUrl: 'https://fulijix.com/user/paysuccess'
  });
  // 打印完整返回体，方便确认收银台地址字段
  console.log('PAY-RESP-RAW', JSON.stringify(data, null, 2));
  
  if (data.code !== 0) throw new Error(`payOrderFail:${data.msg}`);
  return data.result.payUrl || data.result.pay_url || data.result.cashierUrl || data.result.cashier_url || data.result.url;
}

async function createRecharge(amountFen, desc='账户余额充值') {
  let data;
  try {
    // 优先尝试新版 merchant 接口
    ({ data } = await http.post('/mapi/merchant/createOrder', {
      amount: amountFen,
      currency: 'CNY',
      desc,
      notify_url: 'https://fulijix.com/api/idatariver/webhook'
    }));
    console.log('[iDataRiver] merchant/createOrder resp:', JSON.stringify(data, null, 2));
  } catch (err) {
    // 若网络/404 等异常，尝试旧版 add + pay 流程
    console.warn('[iDataRiver] merchant/createOrder failed, fallback to addOrder/payOrder', err.response?.status || err.message);
    return fallbackRecharge(amountFen, desc);
  }

  if (data.code !== 0 && data.code !== undefined) {
    console.warn('[iDataRiver] merchant/createOrder code!=0, fallback. resp=', JSON.stringify(data));
    return fallbackRecharge(amountFen, desc);
  }

  // 兼容不同返回格式
  const root = data.result || data.data || {};
  const payUrl =
    root.payUrl || root.pay_url || root.cashierUrl || root.cashier_url || root.url || root.qrcode || root.paymentUrl || root.payment_url || root.cashier ||
    data.payUrl || data.pay_url || data.cashierUrl || data.cashier_url || data.url || data.qrcode || data.paymentUrl || data.payment_url || data.cashier;

  if (!payUrl) {
    console.warn('[iDataRiver] merchant/createOrder returned no payUrl, fallback');
    return fallbackRecharge(amountFen, desc);
  }

  console.log('PAYRESPRAW', JSON.stringify(data, null, 2));
  return payUrl;

  // ===== 内部帮助函数 =====
  async function fallbackRecharge(amountFenLocal, descLocal) {
    try {
      const orderId = await addOrder(amountFenLocal, descLocal);
      const url = await payOrder(orderId);
      return url;
    } catch (e) {
      console.error('[iDataRiver] fallbackRecharge error', e.message);
      throw e;
    }
  }
}

module.exports = { addOrder, payOrder, createRecharge }; 