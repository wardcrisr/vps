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
    'aws-sdk',
    'b2-cloud-storage', 
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
  
  const requiredEnvs = [
    'B2_APPLICATION_KEY_ID',
    'B2_APPLICATION_KEY', 
    'B2_BUCKET_NAME',
    'B2_ENDPOINT'
  ];
  
  const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
  
  if (missingEnvs.length > 0) {
    console.error('❌ 缺失环境变量:', missingEnvs.join(', '));
    return false;
  }
  
  console.log('✅ 环境配置检查通过');
  console.log(`- B2 Endpoint: ${process.env.B2_ENDPOINT}`);
  console.log(`- Bucket: ${process.env.B2_BUCKET_NAME}\n`);
  return true;
}

// 测试B2连接
async function testB2Connection() {
  console.log('🔄 测试 Backblaze B2 连接...');
  
  try {
    const AWS = require('aws-sdk');
    
    const s3 = new AWS.S3({
      endpoint: `https://${process.env.B2_ENDPOINT}`,
      accessKeyId: process.env.B2_APPLICATION_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
      region: 'us-east-005',
      s3ForcePathStyle: true,
      signatureVersion: 'v4'
    });
    
    // 测试存储桶访问
    await s3.headBucket({ Bucket: process.env.B2_BUCKET_NAME }).promise();
    console.log('✅ B2连接测试成功!\n');
    return true;
  } catch (error) {
    console.error('❌ B2连接测试失败:', error.message);
    console.log('💡 请检查B2凭证是否正确\n');
    return false;
  }
}

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
    
    // 3. 测试B2连接
    const b2Connected = await testB2Connection();
    if (!b2Connected) {
      console.log('⚠️  B2连接失败，但服务器仍会启动（仅支持本地存储）\n');
    }
    
    // 4. 启动服务器
    startServer();
    
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 运行
main(); 