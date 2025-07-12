// security-audit.js - 系统安全审计脚本
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');

function checkEnvironmentSecurity() {
  console.log('🔐 系统安全审计报告');
  console.log('========================');
  
  const securityIssues = [];
  const recommendations = [];
  
  // 检查JWT Secret
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === '请设为复杂字符串' || jwtSecret.length < 32) {
    securityIssues.push('JWT_SECRET 未设置或过于简单');
    recommendations.push('设置复杂的JWT_SECRET (至少32位随机字符)');
  }
  
  // 检查Bunny API密钥
  const bunnyApiKey = process.env.BUNNY_API_KEY;
  if (!bunnyApiKey) {
    securityIssues.push('BUNNY_API_KEY 未设置');
  }
  
  // 检查其他敏感配置
  const sensitiveKeys = [
    'IDR_SECRET',
    'MONGO_URI',
    'BUNNY_SECRET'
  ];
  
  sensitiveKeys.forEach(key => {
    const value = process.env[key];
    if (!value) {
      securityIssues.push(`${key} 未设置`);
    }
  });
  
  // 检查.env文件权限
  try {
    const envStats = fs.statSync('.env');
    const permissions = (envStats.mode & parseInt('777', 8)).toString(8);
    if (permissions !== '600') {
      securityIssues.push(`.env 文件权限不安全 (当前: ${permissions}, 建议: 600)`);
      recommendations.push('运行: chmod 600 .env');
    }
  } catch (err) {
    securityIssues.push('.env 文件不存在或无法访问');
  }
  
  console.log(`📊 发现 ${securityIssues.length} 个安全问题:`);
  securityIssues.forEach((issue, index) => {
    console.log(`${index + 1}. ❌ ${issue}`);
  });
  
  if (recommendations.length > 0) {
    console.log('\n💡 安全建议:');
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ✅ ${rec}`);
    });
  }
  
  return { securityIssues, recommendations };
}

function generateSecureKeys() {
  console.log('\n🔑 生成安全密钥:');
  console.log('========================');
  
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  const bunnySecret = crypto.randomBytes(32).toString('hex');
  const idrSecret = crypto.randomBytes(32).toString('hex');
  
  console.log('# 将以下配置添加到 .env 文件中:');
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log(`BUNNY_SECRET=${bunnySecret}`);
  console.log(`IDR_SECRET=${idrSecret}`);
  console.log('');
  console.log('⚠️  重要提醒:');
  console.log('1. 保存这些密钥到安全的地方');
  console.log('2. 更新密钥后需要重启应用程序');
  console.log('3. 定期更换这些密钥（建议3-6个月）');
}

function checkSystemSecurity() {
  console.log('\n🛡️  系统安全检查:');
  console.log('========================');
  
  // 检查Node.js版本
  const nodeVersion = process.version;
  console.log(`Node.js 版本: ${nodeVersion}`);
  
  // 检查包漏洞 (简化版)
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    console.log(`依赖包数量: ${dependencies.length}`);
    console.log('建议定期运行: npm audit');
  } catch (err) {
    console.log('无法读取 package.json');
  }
  
  // 检查重要文件
  const importantFiles = [
    'package.json',
    'package-lock.json',
    '.env',
    'src/app.js'
  ];
  
  console.log('\n📁 重要文件检查:');
  importantFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} - 存在`);
    } else {
      console.log(`❌ ${file} - 缺失`);
    }
  });
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'audit':
      checkEnvironmentSecurity();
      checkSystemSecurity();
      break;
      
    case 'keys':
      generateSecureKeys();
      break;
      
    default:
      console.log('系统安全审计工具');
      console.log('');
      console.log('用法:');
      console.log('  node security-audit.js audit    # 执行安全审计');
      console.log('  node security-audit.js keys     # 生成安全密钥');
      console.log('');
      console.log('安全最佳实践:');
      console.log('  1. 定期更新依赖包 (npm update)');
      console.log('  2. 运行安全审计 (npm audit)');
      console.log('  3. 使用强密码和密钥');
      console.log('  4. 限制文件权限');
      console.log('  5. 监控登录活动');
      console.log('  6. 定期备份数据');
      console.log('  7. 启用HTTPS');
      console.log('  8. 配置防火墙');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentSecurity,
  generateSecureKeys,
  checkSystemSecurity
}; 