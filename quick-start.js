/**
 * 快速启动脚本 - X福利姬云存储系统
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 X福利姬 - 云存储系统启动\n');

// 检查并安装依赖
function checkAndInstallDependencies() {
  console.log('📦 检查依赖包...');
  
  const requiredPackages = [
    'dotenv'
  ];
  
  const missingPackages = [];
  
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
      console.log(`✅ ${pkg} - 已安装`);
    } catch (error) {
      console.log(`❌ ${pkg} - 缺失`);
      missingPackages.push(pkg);
    }
  }
  
  if (missingPackages.length > 0) {
    console.log(`\n📥 安装缺失的依赖包: ${missingPackages.join(', ')}`);
    try {
      execSync(`npm install ${missingPackages.join(' ')}`, { stdio: 'inherit' });
      console.log('✅ 依赖安装完成\n');
    } catch (error) {
      console.error('❌ 依赖安装失败:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ 所有依赖已安装\n');
  }
}

// 检查环境配置
function checkEnvironment() {
  console.log('🔧 检查环境配置...');
  
  const envPath = './src/config/production.env';
  if (!fs.existsSync(envPath)) {
    console.error('❌ 环境配置文件不存在:', envPath);
    console.log('💡 请确保 src/config/production.env 文件存在并包含B2凭证');
    return false;
  }
  
  // 加载环境变量
  require('dotenv').config({ path: envPath });
  
  console.log('✅ 环境配置文件检查通过');
  return true;
}

// 系统检查完成

// 启动服务器
function startServer() {
  console.log('🚀 启动服务器...');
  try {
    require('./src/app.js');
  } catch (error) {
    console.error('❌ 服务器启动失败:', error.message);
    process.exit(1);
  }
}

// 主启动流程
async function main() {
  try {
    // 1. 检查并安装依赖
    checkAndInstallDependencies();
    
    // 2. 检查环境配置
    if (!checkEnvironment()) {
      process.exit(1);
    }
    
    // 3. 系统环境检查完成
    console.log('✅ 系统环境检查完成\n');
    
    // 4. 启动服务器
    startServer();
    
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 运行
main(); 