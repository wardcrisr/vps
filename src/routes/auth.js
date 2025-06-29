const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const { authenticateToken } = require('./middleware/auth');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || '请设为复杂字符串';

// ——— 显示登录页面 ———
router.get('/login', (req, res) => {
  res.render('auth/login', { title: '用户登录 - X福利姬' });
});

// ——— 显示注册页面 ———
router.get('/register', (req, res) => {
  res.render('auth/register', { title: '用户注册 - X福利姬' });
});

// ——— 显示用户资料页面 ———
router.get('/profile', async (req, res) => {
  // 从token获取用户信息
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  
  // 如果URL参数中没有token，尝试从localStorage获取（前端会传递）
  if (!token && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.redirect('/api/auth/login');
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const JWT_SECRET = process.env.JWT_SECRET || '请设为复杂字符串';
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.redirect('/api/auth/login');
    }
    
    res.render('auth/profile', { title: '个人中心 - X福利姬', user: user });
  } catch (error) {
    return res.redirect('/api/auth/login');
  }
});

// ——— 注册 ———
router.post('/register', [
  body('username').isLength({ min: 2, max: 20 }).withMessage('用户名长度应在2-20字符之间'),
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '注册信息有误', 
      errors: errors.array() 
    });
  }

  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 12);   // 盐轮次12
  
  try {
    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: existingUser.username === username ? '用户名已存在' : '邮箱已被注册' 
      });
    }

    const user = new User({ 
      username, 
      email, 
      password: hash 
    });
    
    await user.save();
    res.json({ success: true, message: '注册成功，请登录' });
  } catch (e) {
    console.error('注册错误:', e);
    res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
  }
});

// ——— 登录 ———
router.post('/login', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').notEmpty().withMessage('请输入密码')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '登录信息有误', 
      errors: errors.array() 
    });
  }

  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: '邮箱或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: '邮箱或密码错误' });
    }

    // 更新最后登录时间
    user.lastLogin = new Date();
    await user.save();

    const payload = { id: user._id, role: user.role, username: user.username, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    
    // 设置 Cookie，以便 EJS 模板能够识别登录状态
    res.cookie('token', token, {
      httpOnly: true,      // 防止 XSS 攻击
      secure: false,       // 本地开发设为 false，生产环境设为 true
      sameSite: 'lax',     // CSRF 保护
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7天过期
    });
    
    res.json({ 
      success: true, 
      message: '登录成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isPremium: user.isPremiumUser()
      }
    });
  } catch (e) {
    console.error('登录错误:', e);
    res.status(500).json({ success: false, message: '登录失败，请稍后重试' });
  }
});

// ——— 登出 ———
router.post('/logout', (req, res) => {
  // 清除 Cookie
  res.clearCookie('token');
  res.json({ success: true, message: '已退出登录' });
});

// ——— 退出登录页面路由 ———
router.get('/logout', (req, res) => {
  // 清除 Cookie
  res.clearCookie('token');
  res.redirect('/');
});

// ——— 更新用户资料 ———
router.post('/update-profile', authenticateToken, [
  body('displayName').optional().isLength({ min: 1, max: 50 }).withMessage('显示昵称长度应在1-50字符之间'),
  body('qq').optional().isNumeric().withMessage('QQ号应为数字'),
  body('bio').optional().isLength({ max: 500 }).withMessage('个人介绍不能超过500字符'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '更新失败', 
      errors: errors.array() 
    });
  }

  try {
    const { displayName, qq, bio } = req.body;
    const user = await User.findById(req.user._id);
    
    if (displayName) user.displayName = displayName;
    if (qq) user.qq = qq;
    if (bio !== undefined) user.bio = bio;
    
    await user.save();
    
    res.json({ success: true, message: '资料更新成功' });
  } catch (e) {
    console.error('更新资料错误:', e);
    res.status(500).json({ success: false, message: '更新失败，请稍后重试' });
  }
});

// ——— 修改密码 ———
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('请输入当前密码'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: '密码修改失败', 
      errors: errors.array() 
    });
  }

  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ success: false, message: '当前密码错误' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    user.password = hash;
    await user.save();
    
    res.json({ success: true, message: '密码修改成功' });
  } catch (e) {
    console.error('修改密码错误:', e);
    res.status(500).json({ success: false, message: '密码修改失败，请稍后重试' });
  }
});

module.exports = router;
