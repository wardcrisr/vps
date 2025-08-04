#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

console.log('=== SKU ID 调试信息 ===');
console.log('项目ID:', process.env.IDR_PROJECT_ID);
console.log('30金币 SKU ID:', process.env.IDR_SKU_ID_2);

// 测试直接调用iDataRiver API
async function testSKU() {
  try {
    const http = axios.create({
      baseURL: `${process.env.IDATARIVER_HOST}/mapi`,
      timeout: 8000,
      headers: {
        Authorization: `Bearer ${process.env.IDR_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('\n=== 测试直接调用iDataRiver ===');
    
    const testBody = {
      projectId: process.env.IDR_PROJECT_ID,
      skuId: process.env.IDR_SKU_ID_2,
      orderInfo: {
        quantity: 1,
        contactInfo: 'test@example.com',
        coupon: ''
      },
      desc: '测试30金币SKU'
    };
    
    console.log('发送的请求体:', JSON.stringify(testBody, null, 2));
    
    const { data } = await http.post('/order/add', testBody);
    console.log('iDataRiver响应:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('错误:', error.response?.data || error.message);
  }
}

testSKU();