// middleware/auth.js

const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const JWT_SECRET = process.env.JWT_SECRET || '请设为复杂字符串';

// JWT token验证中间件
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    // 如果 header 中没有，则尝试从 cookie 获取
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ code: 1, msg: '访问被拒绝，请提供有效的token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ code: 1, msg: '用户不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ code: 1, msg: '无效的token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ code: 1, msg: 'Token已过期，请重新登录' });
    }
    return res.status(500).json({ code: 1, msg: '服务器错误' });
  }
};

// 可选的认证中间件（不强制要求登录）
const optionalAuth = async (req, res, next) => {
  try {
    // 尝试从多个来源获取 token
    let token = null;
    
    // 1. 从 Authorization header 获取
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    
    // 2. 从 Cookie 获取（如果 header 中没有）
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      // 性能优化：只查询必要的基础字段，减少数据传输
      const user = await User.findById(decoded.id)
        .select('username email displayName avatarUrl role isVip vipExpireDate coins')
        .lean(); // 使用lean()返回普通对象，性能更好
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // 即使token无效，也继续执行，只是不设置req.user
    next();
  }
};

// 管理员权限检查中间件
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ code: 1, msg: '请先登录' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 1, msg: '需要管理员权限' });
  }
  
  next();
};

// VIP权限检查中间件
const requireVIP = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ code: 1, msg: '请先登录' });
  }
  
  if (!req.user.isPremiumUser() && req.user.role !== 'admin') {
    return res.status(403).json({ code: 1, msg: '需要VIP会员权限' });
  }
  
  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAdmin,
  requireVIP
};
