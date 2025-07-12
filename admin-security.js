// admin-security.js - 管理员账号安全管理脚本
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb';

// 检查当前管理员账号
async function checkAdminUsers() {
  console.log('🔍 检查当前管理员账号...');
  const admins = await User.find({ role: 'admin' });
  
  if (admins.length === 0) {
    console.log('⚠️  警告：系统中没有管理员账号！');
    return [];
  }
  
  console.log(`📊 找到 ${admins.length} 个管理员账号：`);
  admins.forEach((admin, index) => {
    console.log(`${index + 1}. 用户名: ${admin.username}`);
    console.log(`   邮箱: ${admin.email}`);
    console.log(`   角色: ${admin.role}`);
    console.log(`   最后登录: ${admin.lastLogin || '从未登录'}`);
    console.log(`   创建时间: ${admin.joinDate}`);
    console.log('---');
  });
  
  return admins;
}

// 创建新的管理员账号
async function createAdmin(username, email, password) {
  console.log(`🔐 创建新的管理员账号: ${username}`);
  
  // 检查是否已存在
  const existing = await User.findOne({ 
    $or: [{ username }, { email }] 
  });
  
  if (existing) {
    throw new Error(`账号已存在: ${existing.username === username ? '用户名' : '邮箱'}`);
  }
  
  const hashedPassword = await bcrypt.hash(password, 12);
  const admin = new User({
    username,
    email,
    password: hashedPassword,
    role: 'admin',
    isPremium: true,
    coins: 9999999
  });
  
  await admin.save();
  console.log('✅ 管理员账号创建成功！');
  return admin;
}

// 更新管理员密码
async function updateAdminPassword(identifier, newPassword) {
  console.log(`🔑 更新管理员密码: ${identifier}`);
  
  const admin = await User.findOne({
    $and: [
      { role: 'admin' },
      { $or: [{ username: identifier }, { email: identifier }] }
    ]
  });
  
  if (!admin) {
    throw new Error('管理员账号不存在');
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  admin.password = hashedPassword;
  admin.lastLogin = new Date(); // 更新最后登录时间
  
  await admin.save();
  console.log('✅ 管理员密码更新成功！');
  return admin;
}

// 删除管理员账号（谨慎操作）
async function deleteAdmin(identifier) {
  console.log(`🗑️  删除管理员账号: ${identifier}`);
  
  const adminCount = await User.countDocuments({ role: 'admin' });
  if (adminCount <= 1) {
    throw new Error('不能删除最后一个管理员账号！');
  }
  
  const result = await User.deleteOne({
    $and: [
      { role: 'admin' },
      { $or: [{ username: identifier }, { email: identifier }] }
    ]
  });
  
  if (result.deletedCount === 0) {
    throw new Error('管理员账号不存在');
  }
  
  console.log('✅ 管理员账号已删除');
}

// 生成安全密码
function generateSecurePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  let password = '';
  
  // 确保包含每种类型的字符
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // 填充剩余长度
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// 主函数
async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('📱 连接到数据库成功');
    
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'check':
        await checkAdminUsers();
        break;
        
      case 'create':
        const username = args[1];
        const email = args[2];
        const password = args[3] || generateSecurePassword();
        
        if (!username || !email) {
          console.log('用法: node admin-security.js create <用户名> <邮箱> [密码]');
          return;
        }
        
        await createAdmin(username, email, password);
        console.log(`📋 登录信息:`);
        console.log(`   用户名: ${username}`);
        console.log(`   邮箱: ${email}`);
        console.log(`   密码: ${password}`);
        break;
        
      case 'update':
        const identifier = args[1];
        const newPassword = args[2] || generateSecurePassword();
        
        if (!identifier) {
          console.log('用法: node admin-security.js update <用户名或邮箱> [新密码]');
          return;
        }
        
        await updateAdminPassword(identifier, newPassword);
        console.log(`📋 新的登录信息:`);
        console.log(`   账号: ${identifier}`);
        console.log(`   新密码: ${newPassword}`);
        break;
        
      case 'delete':
        const toDelete = args[1];
        
        if (!toDelete) {
          console.log('用法: node admin-security.js delete <用户名或邮箱>');
          return;
        }
        
        await deleteAdmin(toDelete);
        break;
        
      case 'generate':
        const length = parseInt(args[1]) || 16;
        const generatedPassword = generateSecurePassword(length);
        console.log(`🔐 生成的安全密码 (${length}位): ${generatedPassword}`);
        break;
        
      default:
        console.log('管理员账号安全管理工具');
        console.log('');
        console.log('用法:');
        console.log('  node admin-security.js check                     # 检查当前管理员账号');
        console.log('  node admin-security.js create <用户名> <邮箱> [密码]  # 创建新管理员');
        console.log('  node admin-security.js update <账号> [新密码]       # 更新管理员密码');
        console.log('  node admin-security.js delete <账号>              # 删除管理员账号');
        console.log('  node admin-security.js generate [长度]            # 生成安全密码');
        console.log('');
        console.log('安全建议:');
        console.log('  1. 使用强密码（至少16位，包含大小写字母、数字、特殊字符）');
        console.log('  2. 定期更换密码（建议3个月一次）');
        console.log('  3. 不要使用相同密码在多个系统');
        console.log('  4. 考虑启用两步验证');
        console.log('  5. 监控管理员账号的登录活动');
        break;
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkAdminUsers,
  createAdmin,
  updateAdminPassword,
  deleteAdmin,
  generateSecurePassword
}; 