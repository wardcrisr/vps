// services/idatariverservice.js
require('dotenv').config();                   // 读取 .env
const axios  = require('axios');

const http = axios.create({
  baseURL: `${process.env.IDATARIVER_HOST}/mapi`,
  timeout: 8000,
  headers: {
    Authorization: `Bearer ${process.env.IDR_SECRET}`,
    'Content-Type': 'application/json'
  }
});

// ↓ 下单（已验证成功）
async function addOrder(amountFen, contactInfo, skuId) {
  const body = {
    projectId : process.env.IDR_PROJECT_ID,
    skuId     : skuId || process.env.IDR_SKU_ID,
    orderInfo : {
      quantity    : 1,
      contactInfo,
      coupon      : '',
      affCode     : ''
    },
    amount   : amountFen,      // 单位：分
    currency : 'CNY',
    desc     : '账户余额充值'
  };
  const { data } = await http.post('/order/add', body);
  if (data.code !== 0) throw new Error(data.msg);
  return data.result.orderId;
}

// ↓ 支付，返回收银台 URL
async function payOrder(orderId, method='alipay') {
  const body = {
    id          : orderId,
    method,
    callbackUrl : process.env.PAY_CALLBACK,
    redirectUrl : process.env.PAY_REDIRECT || 'https://fulijix.com/user/pay-result'
  };
  const { data } = await http.post('/order/pay', body);
  if (data.code !== 0) throw new Error(data.msg);
  return data.result.payUrl;
}

// 聚合：前端只需要这一函数
async function createRecharge(amountFen, contactInfo, skuId) {
  const orderId = await addOrder(amountFen, contactInfo, skuId);
  const payUrl  = await payOrder(orderId, 'alipay'); // 可按需动态选择
  return { payUrl, orderId };
}

// 查询订单状态（供前端轮询）
async function getOrderInfo(orderId){
  if(!orderId) throw new Error('orderId required');
  const { data } = await http.get('/order/info', { params: { id: orderId } });
  if(data.code !== 0) throw new Error(data.msg);
  return data.result || { status: data.status };
}

module.exports = { createRecharge, getOrderInfo };

