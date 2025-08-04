#!/usr/bin/env node

require('dotenv').config();
const { createRecharge } = require('./src/utils/idatariver');

console.log('=== 测试应用调用逻辑 ===');

async function testAppCall() {
  try {
    console.log('调用 createRecharge(3000, "test@example.com", "金币充值 - 30金币", "6873aa8b5c04c69a131c7eca")');
    
    const result = await createRecharge(
      3000,  // amountFen
      'test@example.com',  // contactInfo
      '金币充值 - 30金币',  // desc
      '6873aa8b5c04c69a131c7eca'  // skuId (30金币)
    );
    
    console.log('应用调用成功:', result);
    
  } catch (error) {
    console.error('应用调用失败:', error.message);
    console.error('错误详情:', error);
  }
}

testAppCall();