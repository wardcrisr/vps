/**
 * src/app.js
 * 内容分发平台入口（Express + EJS + Backblaze B2 + 付费下载）
 */

// 加载环境变量 - 优先使用生产配置
require('dotenv').config({ path: './src/config/production.env' });

const path           = require('path');
const express        = require('express');
const morgan         = require('morgan');
const cookieParser   = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const mongoose       = require('mongoose');
const multer         = require('multer');
const fs             = require('fs');

// 引入模型
const Post           = require('./models/Post');
const Comment        = require('./models/comment');
const User           = require('./models/User');
const Media          = require('./models/Media');
const Collection     = require('./models/Collection');

// 引入服务 - 使用简化版B2服务
const b2Storage      = require('./services/b2Storage-simple');

// 引入认证中间件
const { optionalAuth, authenticateToken, requireVIP } = require('./routes/middleware/auth');

// AdminJS 相关 - 临时注释掉避免ES模块错误
// const AdminJS        = require('adminjs');
// const AdminJSExpress = require('@adminjs/express');
// AdminJS.registerAdapter(require('@adminjs/mongoose'));

// 创建 Express 实例
const app = express();

// 确保上传目录存在（临时存储）
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 用于文件上传（临时存储）
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024, // 增加到 1GB 限制
    fieldSize: 50 * 1024 * 1024,  // 50MB 字段大小限制
    fields: 20,                   // 限制字段数量
    parts: 100                    // 限制部分数量
  },
  fileFilter: function (req, file, cb) {
    // 只检查文件类型，不检查文件大小（file.size在此阶段为undefined）
    // 文件大小限制由 limits.fileSize 处理
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片和视频文件!'), false);
    }
  }
});

// 支持 JSON body 和 URL encoded (增加body大小限制)
app.use(express.json({ limit: '1gb' }));
app.use(express.urlencoded({ extended: true, limit: '1gb' }));

// Cookie 解析中间件
app.use(cookieParser());

// 增加原始body处理支持
app.use(express.raw({ type: 'application/octet-stream', limit: '500mb' }));

// 静态文件服务（本地文件）
app.use('/uploads', express.static(uploadDir));

// 静态文件服务（CSS、JS等）
app.use(express.static(path.join(__dirname, 'public')));

// 全局将 req.user 注入到模板变量 user 中
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// 视图引擎 & 布局 & 日志
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');
app.use(expressLayouts);
app.use(morgan('dev'));
app.locals.title = 'X福利姬';

// 连接 MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb', {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB 已连接'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

// 挂载 AdminJS 后台管理 - 临时注释掉
// const adminJs = new AdminJS({
//   resources: [Post, User, Comment],
//   rootPath:  '/admin',
// });
// app.use(adminJs.options.rootPath, AdminJSExpress.buildRouter(adminJs));

// 初始化B2连接
b2Storage.initialize().then(connected => {
  if (connected) {
    console.log('☁️ 云存储模式：Backblaze B2');
  } else {
    console.log('📁 本地存储模式：文件将保存在本地');
  }
});

// 认证路由（注册/登录）
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// 管理员路由
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// B2 视频管理路由
const b2VideoRoutes = require('./routes/b2Videos');
app.use('/api/admin/b2-videos', b2VideoRoutes);

// 直传上传路由
const directUploadRoutes = require('./routes/directUpload');
app.use('/api/direct-upload', directUploadRoutes);

// Bunny Stream 签名直传路由 (前端直传使用)
const bunnySignRoutes = require('./routes/bunnySign');
app.use('/api/bunny-sign', bunnySignRoutes);

// Bunny Stream 上传完成状态更新
const bunnyUpdateRoutes = require('./routes/bunnyUpdate');
app.use('/api/bunny-update', bunnyUpdateRoutes);

// VOD视频点播路由
const vodRoutes = require('./routes/vod');
app.use('/vod', vodRoutes);

// 视频详情页路由
const videoRoutes = require('./routes/video');
app.use('/video', videoRoutes);

// 视频统计等路由
const videosRoutes = require('./routes/videos');
app.use('/api/videos', videosRoutes);

// UP主空间页路由
const spaceRoutes = require('./routes/space');
app.use('/space', spaceRoutes);

// 首页控制器
const indexController = require('./controllers/indexController');

// API健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'X福利姬服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 首页路由
app.get('/', optionalAuth, indexController.renderIndex);

// 获取更多视频API
app.get('/api/videos', indexController.getMoreVideos);

// 占位图片API
app.get('/api/placeholder/video-thumbnail', (req, res) => {
  // 创建简单的SVG占位图
  const svg = `
  <svg width="280" height="160" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f0f0f0"/>
    <text x="50%" y="45%" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#999">
      视频缩略图
    </text>
    <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#999">
      正在加载...
    </text>
  </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存24小时
  res.send(svg);
});

// 默认头像现在使用静态文件 /public/images/default-avatar.png

// 首页上传功能已删除，请使用管理员后台进行视频上传

// 首页分片上传功能已删除，请使用管理员后台进行视频上传

// 媒体文件下载API（付费验证）
app.get('/api/media/:id/download', authenticateToken, async (req, res) => {
  try {
    const mediaId = req.params.id;
    const userId = req.user._id;

    // 获取媒体文件信息
    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json({ error: '文件不存在' });
    }

    // 获取用户信息
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ error: '用户验证失败' });
    }

    // 权限检查
    if (media.isPremiumOnly && !user.isPremiumUser()) {
      return res.status(403).json({ 
        error: '此文件仅限付费用户下载',
        upgradeUrl: '/upgrade'
      });
    }

    // 下载次数检查
    if (!user.canDownload()) {
      return res.status(429).json({ 
        error: '今日下载次数已用完',
        resetTime: new Date(user.lastDownloadReset.getTime() + 24 * 60 * 60 * 1000),
        upgradeUrl: '/upgrade'
      });
    }

    // 生成下载令牌
    let downloadUrl;
    if (media.isInCloud()) {
      const tokenResult = await b2Storage.generateDownloadToken(
        media.cloudFileName,
        userId,
        24 // 24小时有效期
      );

      if (!tokenResult.success) {
        return res.status(500).json({ error: '生成下载链接失败' });
      }

      downloadUrl = tokenResult.downloadUrl;
    } else {
      // 本地文件直接返回
      downloadUrl = media.url;
    }

    // 更新统计数据
    await Promise.all([
      media.incrementDownload(),
      user.incrementDownload()
    ]);

    res.json({
      success: true,
      downloadUrl: downloadUrl,
      filename: media.originalName,
      size: media.size,
      expiresIn: '24小时'
    });

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: '下载失败: ' + error.message });
  }
});

// 使用下载令牌获取文件
app.get('/api/download/:token', async (req, res) => {
  try {
    const token = req.params.token;
    
    const fileResult = await b2Storage.getFileWithToken(token);
    if (!fileResult.success) {
      return res.status(400).json({ error: fileResult.error });
    }

    // 重定向到实际下载链接
    res.redirect(fileResult.downloadUrl);

  } catch (error) {
    console.error('Token download error:', error);
    res.status(500).json({ error: '下载失败: ' + error.message });
  }
});

// 搜索功能
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const mediaItems = await Media.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 }).limit(20);

    res.render('search', {
      title: '搜索结果',
      query: query,
      results: mediaItems,
      layout: false
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).render('error', {
      title: '搜索错误',
      message: '搜索时发生错误',
      layout: false
    });
  }
});

// 分类页面
app.get('/category/:type', async (req, res) => {
  try {
    const categoryType = req.params.type;
    const mediaItems = await Media.find({ category: categoryType })
      .sort({ createdAt: -1 })
      .limit(50);

    const categoryNames = {
      'new': '新片速递',
      'exclusive': '独家银影师专栏',
      'resources': '独家资源',
      'models': '国模私拍',
      'show': '秀人网'
    };

    res.render('category', {
      title: categoryNames[categoryType] || '分类',
      category: categoryType,
      categoryName: categoryNames[categoryType],
      items: mediaItems,
      layout: false
    });
  } catch (error) {
    console.error('Category error:', error);
    res.status(500).render('error', {
      title: '分类错误',
      message: '加载分类时发生错误',
      layout: false
    });
  }
});

// 评论路由：必须登录
app.post('/comments', authenticateToken, async (req, res) => {
  const { postId, content } = req.body;
  const comment = new Comment({
    post:   postId,
    author: req.user._id,
    content,
  });
  await comment.save();
  res.json({ message: '评论成功', comment });
});

// B2视频管理页面 - 管理员专用React应用
app.get('/admin/b2-videos', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// VIP升级页面
app.get('/upgrade', (req, res) => {
  res.render('upgrade', { 
    title: 'X福利姬', 
    user: req.user || null,
    layout: false 
  });
});

// 上传页面
app.get('/upload', (req, res) => {
  res.render('upload', {
    title: '上传内容',
    user: req.user || null,
    layout: false
  });
});

// 登录页面
app.get('/login', (req, res) => {
  res.render('login', {
    title: '登录',
    user: null,
    layout: false
  });
});

// 注册页面
app.get('/register', (req, res) => {
  res.render('register', {
    title: '注册',
    user: null,
    layout: false
  });
});

// 模拟VIP升级API
app.post('/api/upgrade-simulate', authenticateToken, async (req, res) => {
      try {
      const userId = req.user._id;
    const { plan, price } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 计算VIP到期时间
    let expiryDate = new Date();
    switch (plan) {
      case 'monthly':
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        break;
      case 'quarterly':
        expiryDate.setMonth(expiryDate.getMonth() + 3);
        break;
      case 'yearly':
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        break;
      default:
        return res.status(400).json({ success: false, message: '无效的套餐类型' });
    }

    // 更新用户VIP状态
    user.isPremium = true;
    user.premiumExpiry = expiryDate;
    user.dailyDownloadLimit = 999999; // VIP用户实际无限制
    await user.save();

    res.json({
      success: true,
      message: 'VIP升级成功',
      expiryDate: expiryDate,
      plan: plan,
      price: price
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ success: false, message: '升级失败: ' + error.message });
  }
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
  console.error('全局错误捕获:', error);
  
  // 处理文件大小超限错误
  if (error.code === 'LIMIT_FILE_SIZE' || error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'FileTooLarge',
      message: '上传文件超过允许的最大尺寸，请上传小于 500 MB 的文件。'
    });
  }
  
  // 处理Multer错误
  if (error.code === 'LIMIT_PART_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'TooManyFiles',
      message: '文件数量超过限制，最多可以上传 10 个文件。'
    });
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'UnexpectedFile',
      message: '不支持的文件字段名，请检查上传参数。'
    });
  }
  
  // 处理其他错误
  if (error.status && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      error: error.name || 'ClientError',
      message: error.message || '请求错误'
    });
  }
  
  // 服务器内部错误
  res.status(500).json({
    success: false,
    error: 'InternalServerError',
    message: '服务器内部错误，请稍后重试'
  });
});

// 直传演示页面路由
app.get('/direct-upload-demo', (req, res) => {
  res.render('direct-upload-demo', {
    title: 'X福利姬',
    user: req.user || null
  });
});

// 静态文件服务（必须在404处理之前）
// 为JavaScript文件添加no-cache头部
app.use('/js', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
}, express.static(path.join(__dirname, '../public/js')));

app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use(express.static(path.join(__dirname, '../public')));

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NotFound',
    message: '请求的资源不存在'
  });
});

// 添加 EJS 模板辅助函数供服务器端渲染使用
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}
function formatNumber(num) {
  if (!num || num === 0) return '0';
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
  if (num >= 10000) return (num / 10000).toFixed(1) + '万';
  return num.toString();
}
function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const target = new Date(date);
  const diffSec = Math.floor((now - target) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMon = Math.floor(diffDay / 30);
  const diffYr  = Math.floor(diffDay / 365);
  if (diffSec < 60) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24)  return `${diffHr}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  if (diffMon < 12) return `${diffMon}个月前`;
  return `${diffYr}年前`;
}
function truncateText(text, maxLength = 30) {
  if (!text) return '';
  return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
}

const templateHelpers = { formatDuration, formatNumber, formatRelativeTime, truncateText };

// 全局可用（index.ejs 通过 <%= %> 直接调用）
Object.assign(app.locals, templateHelpers);

// 每个请求也都可在 res.locals 访问
app.use((req, res, next) => {
  Object.assign(res.locals, templateHelpers);
  next();
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`🔗 直传演示 - http://localhost:${PORT}/direct-upload-demo`);
  // console.log(`🔧 AdminJS at http://localhost:${PORT}${adminJs.options.rootPath}`);
});

module.exports = app;


