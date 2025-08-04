// 加载环境变量
require('dotenv').config();

// 测试环境变量加载
console.log('=== SKU ID 环境变量测试 ===');
console.log('10金币 (IDR_SKU_ID_1):', process.env.IDR_SKU_ID_1);
console.log('30金币 (IDR_SKU_ID_2):', process.env.IDR_SKU_ID_2);
console.log('50金币 (IDR_SKU_ID_3):', process.env.IDR_SKU_ID_3);
console.log('100金币 (IDR_SKU_ID_4):', process.env.IDR_SKU_ID_4);
console.log('200金币 (IDR_SKU_ID_5):', process.env.IDR_SKU_ID_5);
console.log('300金币 (IDR_SKU_ID_6):', process.env.IDR_SKU_ID_6);

const skuIds = {
  10  : process.env.IDR_SKU_ID_1,
  30  : process.env.IDR_SKU_ID_2,
  50  : process.env.IDR_SKU_ID_3,
  100 : process.env.IDR_SKU_ID_4,
  200 : process.env.IDR_SKU_ID_5,
  300 : process.env.IDR_SKU_ID_6,
};

console.log('\n=== 映射结果 ===');
Object.entries(skuIds).forEach(([amount, skuId]) => {
  console.log(`${amount}金币 -> ${skuId || '未定义'}`);
});