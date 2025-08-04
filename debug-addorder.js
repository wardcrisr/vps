#!/usr/bin/env node

require('dotenv').config();
const { addOrder } = require('./src/utils/idatariver');

console.log('=== 测试addOrder函数 ===');

async function testAddOrder() {
  try {
    console.log('调用 addOrder(3000, "金币充值 - 30金币", "test@example.com", "CNY", "6873aa8b5c04c69a131c7eca")');
    
    const orderId = await addOrder(
      3000,  // amountFen
      '金币充值 - 30金币',  // desc
      'test@example.com',  // contactInfo
      'CNY',  // currency
      '6873aa8b5c04c69a131c7eca'  // skuId (30金币)
    );
    
    console.log('addOrder调用成功，订单ID:', orderId);
    
  } catch (error) {
    console.error('addOrder调用失败:', error.message);
  }
}

testAddOrder();