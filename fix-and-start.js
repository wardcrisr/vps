#!/usr/bin/env node

/**
 * 修复并启动X福利姬云存储系统
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 X福利姬 - 系统修复与启动\n');

// 1. 检查并修复环境配置
function fixEnvironment() {
  console.log('📋 检查环境配置...');
  
  const envPath = './src/config/production.env';
  if (!fs.existsSync(envPath)) {
    console.error('❌ 环境配置文件不存在');
    process.exit(1);
  }
  
  console.log('✅ 环境配置文件存在');
  
  // 加载环境变量
  require('dotenv').config({ path: envPath });
  
  // 检查关键环境变量
  const required = ['MONGO_URI', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log('⚠️  部分环境变量未设置:', missing.join(', '));
  } else {
    console.log('✅ 基础环境变量已设置');
  }
  
  console.log('');
}

// 2. 安装必要依赖
function installDependencies() {
  console.log('📦 安装依赖包...');
  
  const requiredPackages = ['aws-sdk', 'dotenv'];
  
  try {
    console.log('正在安装:', requiredPackages.join(', '));
    execSync(`npm install ${requiredPackages.join(' ')} --no-optional`, { 
      stdio: 'inherit',
      timeout: 60000 // 60秒超时
    });
    console.log('✅ 依赖安装完成\n');
  } catch (error) {
    console.log('⚠️  依赖安装失败，但会继续尝试启动\n');
  }
}

// 3. 检查B2配置
function checkB2Config() {
  console.log('☁️  检查B2配置...');
  
  if (process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY) {
    console.log('✅ B2凭证已配置');
    console.log(`- Bucket: ${process.env.B2_BUCKET_NAME}`);
    console.log(`- Endpoint: ${process.env.B2_ENDPOINT}`);
  } else {
    console.log('⚠️  B2凭证未配置，将使用本地存储模式');
  }
  
  console.log('');
}

// 4. 启动服务器
function startServer() {
  console.log('🚀 启动服务器...');
  console.log('访问地址: http://localhost:3000');
  console.log('按 Ctrl+C 停止服务器\n');
  
  try {
    // 使用spawn启动服务器，保持输出
    const server = spawn('node', ['src/app.js'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    server.on('error', (error) => {
      console.error('❌ 服务器启动失败:', error.message);
      process.exit(1);
    });
    
    server.on('exit', (code) => {
      if (code !== 0) {
        console.log(`\n⚠️  服务器退出，代码: ${code}`);
      }
    });
    
    // 处理Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n🛑 正在停止服务器...');
      server.kill('SIGINT');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    
    // 提供手动启动建议
    console.log('\n💡 手动启动建议:');
    console.log('1. npm install aws-sdk dotenv');
    console.log('2. node src/app.js');
    
    process.exit(1);
  }
}

// 主函数
async function main() {
  try {
    fixEnvironment();
    installDependencies();
    checkB2Config();
    startServer();
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 运行
main(); 