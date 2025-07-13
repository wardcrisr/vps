/**
 * src/app.js
 * 内容分发平台入口（Express + EJS + 付费下载）
 */

// 先加载默认 .env，再加载 production 覆盖（如有）

require('dotenv').config();
require('dotenv').config({ path: './src/config/production.env' });

const path           = require('path');
const express        = require('express');
const morgan         = require('morgan');
const cookieParser   = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const mongoose       = require('mongoose');
const multer         = require('multer');
const fs             = require('fs');
const { Types: MongooseTypes } = require('mongoose');

// 引入模型
const Post           = require('./models/Post');
const Comment        = require('./models/comment');
const User           = require('./models/User');
const Media          = require('./models/Media');
const Collection     = require('./models/Collection');

// 引入服务 - 使用简化版B2服务
// B2存储服务已移除

// 引入认证中间件
const { optionalAuth, authenticateToken, requireVIP } = require('./routes/middleware/auth');

// AdminJS 相关 - 临时注释掉避免ES模块错误
// const AdminJS        = require('adminjs');
// const AdminJSExpress = require('@adminjs/express');
// AdminJS.registerAdapter(require('@adminjs/mongoose'));

// 创建 Express 实例
const app = express();
app.set('view cache', false);

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

// ============================================================
// Cookie 解析中间件
app.use(cookieParser());

// 静态文件服务（本地文件）
app.use('/uploads', express.static(uploadDir));

// 静态文件服务（CSS、JS等）
app.use(express.static(path.join(__dirname, 'public')));

// 静态文件服务（根目录）
app.use('/static', express.static(path.join(__dirname, '../..')));

// 专门处理logo文件
app.use('/assets', express.static(path.join(__dirname, 'public')));

// 全局将 req.user 注入到模板变量 user 中
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// 全局 :id 参数验证，避免无效 ObjectId 导致服务器错误
app.param('id', (req, res, next, id) => {
  if (!MongooseTypes.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID format' });
  }
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
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb')
  .then(() => console.log('✅ MongoDB 已连接'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

// 挂载 AdminJS 后台管理 - 临时注释掉
// const adminJs = new AdminJS({
//   resources: [Post, User, Comment],
//   rootPath:  '/admin',
// });
// app.use(adminJs.options.rootPath, AdminJSExpress.buildRouter(adminJs));

// 使用本地存储模式
console.log('📁 存储模式：本地存储');

// 认证路由（注册/登录）
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// 管理员路由
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Bunny Stream 签名直传路由 (前端直传使用)
const bunnySignRoutes = require('./routes/bunnySign');
app.use('/api/bunny-sign', bunnySignRoutes);

// Bunny Stream 上传完成状态更新
const bunnyUpdateRoutes = require('./routes/bunnyUpdate');
app.use('/api/bunny-update', bunnyUpdateRoutes);

// 新增：Bunny Stream Webhook 回调
const bunnyWebhookRoutes = require('./routes/bunnyWebhook');
app.use('/api/bunny', bunnyWebhookRoutes);

// 金币解锁观看路由
const unlockRoutes = require('./routes/unlock');
app.use('/api/unlock', unlockRoutes);

// 视频预览路由
// const previewRoutes = require('./routes/preview');
// app.use('/api/preview', previewRoutes);

const adminCoinRoutes  = require('./routes/adminCoin');
app.use('/api/admin', adminCoinRoutes);

// VOD视频点播路由
const vodRoutes = require('./routes/vod');
app.use('/vod', vodRoutes);

// 视频详情页路由
const videoRoutes = require('./routes/video');
app.use('/video', videoRoutes);

// 视频统计等路由
const videosRoutes = require('./routes/videos');
app.use('/api/videos', videosRoutes);

// 视频付费相关路由（预览、购买、播放）
const videoPaymentRoutes = require('./routes/videoPayment');
app.use('/api/video', videoPaymentRoutes);

// 新增：用户API路由（实时资料）
const userApiRoutes = require('./routes/userApi');
app.use('/api/user', userApiRoutes);

// 用户个人中心路由
const userRoutes = require('./routes/user');
app.use('/user', userRoutes);

// UP主空间页路由
const spaceRoutes = require('./routes/space');
app.use('/space', spaceRoutes);

// 首页控制器
const indexController = require('./controllers/indexController');
// 新增：标签页控制器（免费视频/付费/VIP）
const tagController   = require('./controllers/tagController');

// API健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'X福利姬服务器运行正常',
    timestamp: new Date().toISOString()
  });
});

// 测试logo文件是否存在
app.get('/api/test/logo', (req, res) => {
  const logoPath = path.join(__dirname, 'public', 'logo-black.jpg');
  const fs = require('fs');
  
  fs.access(logoPath, fs.constants.F_OK, (err) => {
    if (err) {
      res.json({
        success: false,
        message: 'Logo file not found',
        path: logoPath,
        error: err.message
      });
    } else {
      fs.stat(logoPath, (statErr, stats) => {
        res.json({
          success: true,
          message: 'Logo file exists',
          path: logoPath,
          size: stats ? stats.size : 'unknown',
          assets_url: '/assets/logo-black.jpg'
        });
      });
    }
  });
});

// 直接提供logo文件
app.get('/logo-black.jpg', (req, res) => {
  const logoPath = path.join(__dirname, 'public', 'logo-black.jpg');
  res.sendFile(logoPath, (err) => {
    if (err) {
      console.error('Error sending logo file:', err);
      res.status(404).send('Logo not found');
    }
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// 测试视频ID有效性
app.get('/api/test/video/:id', async (req, res) => {
  const mongoose = require('mongoose');
  const videoId = req.params.id;
  
  try {
    // 检查是否是有效的ObjectId
    const isValidId = mongoose.Types.ObjectId.isValid(videoId);
    
    if (!isValidId) {
      return res.json({
        success: false,
        message: 'Invalid video ID format',
        providedId: videoId,
        expectedLength: 24,
        actualLength: videoId.length
      });
    }
    
    // 尝试查找视频
    const video = await Media.findById(videoId);
    
    res.json({
      success: true,
      isValidId: isValidId,
      videoExists: !!video,
      videoTitle: video ? video.title : null
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      providedId: videoId
    });
  }
});

// 调试：检查所有视频ID格式
app.get('/api/debug/video-ids', async (req, res) => {
  try {
    const videos = await Media.find({ type: 'video' }).limit(20);
    const videoIds = videos.map(v => ({
      _id: v._id.toString(),
      title: v.title,
      isValidId: mongoose.Types.ObjectId.isValid(v._id),
      idLength: v._id.toString().length
    }));
    
    // 查找格式异常的ID
    const invalidIds = videoIds.filter(v => v.idLength !== 24);
    
    res.json({
      success: true,
      totalVideos: videoIds.length,
      invalidIds: invalidIds,
      sampleIds: videoIds.slice(0, 5)
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// 调试页面：显示所有视频链接
app.get('/debug/videos', async (req, res) => {
  try {
    const videos = await Media.find({ type: 'video' }).limit(50);
    res.render('debug-videos', {
      title: '视频调试页面',
      videos: videos,
      user: null
    });
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

// 测试特定视频ID的清理
app.get('/debug/test-id/:id', (req, res) => {
  const originalId = req.params.id;
  const cleanedId = originalId.replace(/[^a-fA-F0-9]/g, '').substring(0, 24);
  
  res.json({
    originalId: originalId,
    originalLength: originalId.length,
    cleanedId: cleanedId,
    cleanedLength: cleanedId.length,
    isValidOriginal: mongoose.Types.ObjectId.isValid(originalId),
    isValidCleaned: mongoose.Types.ObjectId.isValid(cleanedId),
    removedChars: originalId.replace(cleanedId, ''),
    analysis: {
      hasLetters: /[a-zA-Z]/.test(originalId),
      hasNumbers: /[0-9]/.test(originalId),
      hasSpecialChars: /[^a-fA-F0-9]/.test(originalId),
      suspiciousPart: originalId.slice(24)
    }
  });
});

// 调试首页视频数据
app.get('/debug/homepage-videos', async (req, res) => {
  try {
    const indexController = require('./controllers/indexController');
    const videos = await Media.aggregate([
      { $match: { type: 'video', isPublic: true } },
      { $limit: 5 },
      { $project: {
          _id: 1,
          id: '$_id',
          title: 1,
          'idAsString': { $toString: '$_id' }
        }
      }
    ]);
    
    res.json({
      success: true,
      videos: videos.map(v => ({
        _id: v._id,
        id: v.id,
        idType: typeof v.id,
        idAsString: v.idAsString,
        title: v.title,
        analysis: {
          isObjectId: v._id instanceof mongoose.Types.ObjectId,
          idLength: v.idAsString.length,
          hasInvalidChars: /[^a-fA-F0-9]/.test(v.idAsString)
        }
      }))
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 首页路由
app.get('/', optionalAuth, indexController.renderIndex);

// 标签页路由
app.get('/free', optionalAuth, tagController.renderFree);
app.get('/paid', optionalAuth, tagController.renderPaid);
app.get('/vip',  optionalAuth, tagController.renderVIP);

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

    // 使用本地文件路径
    const downloadUrl = media.url;

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

// 下载令牌功能已移除（使用本地存储）

// 搜索功能
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    
    // 只搜索视频类型的媒体
    const mediaItems = await Media.find({
      type: 'video',
      isPublic: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 }).limit(20);

    // 为每个视频添加预览URL
    const results = mediaItems.map(video => {
      const obj = video.toObject();
      
      // 添加 previewUrl 字段
      if (obj.bunnyId || obj.guid) {
        const videoGuid = obj.bunnyId || obj.guid;
        obj.previewVideo = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.mp4`;
        obj.previewUrl = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.webp`;
      }
      
      return obj;
    });

    res.render('search', {
      title: '搜索结果',
      query: query,
      results: results,
      formatDate: (date => {
        if (!date) return '';
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        return `${y}/${m}/${day}`;
      }),
      layout: false
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: 'InternalServerError',
      message: '服务器内部错误,请稍后重试'
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

// B2视频管理页面路由已移除

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

// 简易 favicon 处理，避免浏览器 403/404
app.get('/favicon.ico', (req, res) => {
  try {
    const iconPath = path.join(__dirname, '../public/favicon.ico');
    return res.sendFile(iconPath);
  } catch (e) {
    // 若文件不存在则返回204
    return res.status(204).end();
  }
});

app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));
app.use(express.static(path.join(__dirname, '../public')));
// === iDataRiver 支付路由 ===
// ① 先让 Express 能解析 JSON / 表单
app.use(express.json());                // application/json
app.use(express.urlencoded({ extended: true })); // application/x-www-form-urlencoded


const idatariverRoutes = require('./routes/idataRiver');  
app.use('/api/idatariver', idatariverRoutes);

// ③ 一切路由都匹配失败后，才落到 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error  : 'NotFound',
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

// 禁用etag
app.disable('etag');


 module.exports = app;

// …前面已有 express.json()、路由等配置…

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  // 显式绑定到所有 IPv4 和 IPv6 接口（0.0.0.0 可兼容大多数 Linux 双栈环境）
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务已启动，监听在 http://0.0.0.0:${PORT}`);
  });
}
// 导出 app 实例，供 Supertest 或其它模块引用
module.exports = app;

const bunnyEmbedRoutes = require('./routes/bunnyEmbed');
app.use('/api/bunny-embed', bunnyEmbedRoutes);




