const express = require('express');
const User = require('../models/User');
const Media = require('../models/Media');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const router = express.Router();
const path = require('path');
const fs   = require('fs');
const multer = require('multer');

// ——— 显示管理员后台页面（不需要token验证，由前端JavaScript处理） ———
router.get('/dashboard', (req, res) => {
  // 为管理员后台页面提供一个默认用户对象
  const defaultUser = { username: 'Admin', role: 'admin' };
  res.render('admin/dashboard', { title: '管理员后台 - X福利姬', user: defaultUser });
});

// 应用认证中间件到其他管理员API路由
router.use(authenticateToken);
router.use(requireAdmin);

// ========== 文件上传（封面图片） ==========
// 复用 app.js 中的 uploads 静态目录，保存到 /uploads/covers
const baseUploadDir = path.join(__dirname, '../uploads');
const coversDir = path.join(baseUploadDir, 'covers');
fs.mkdirSync(coversDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, coversDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const uploadCover = multer({ storage });

// POST /api/admin/upload-cover  ->  返回 { success, url }
router.post('/upload-cover', uploadCover.single('cover'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未检测到封面文件' });
    }
    // 静态访问路径 /uploads/covers/<filename>
    const publicUrl = `/uploads/covers/${req.file.filename}`;
    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('上传封面失败:', err);
    res.status(500).json({ success: false, message: '上传封面失败' });
  }
});

// ========== 新增视频（保存元数据） ==========
// POST /api/admin/videos  { title, videoUrl, coverUrl, category, uploaderId }
router.post('/videos', async (req, res) => {
  try {
    const { title, videoUrl, coverUrl, category, videoId, uploaderId, priceCoin } = req.body;

    if (!title || !videoUrl || !coverUrl || !category || !videoId) {
      return res.status(400).json({ success: false, message: '缺少必要字段' });
    }

    const updateFields = {
      title,
      originalName: title,
      mimetype: 'video/mp4',
      size: 0,
      type: 'video',
      url: videoUrl,
      coverUrl,
      category,
      cloudStatus: 'uploaded',
      isPublic: true
    };

    // 添加UP主信息
    if (uploaderId) {
      updateFields.uploader = uploaderId;
    }

    // 添加金币价格
    if (priceCoin && priceCoin > 0) {
      updateFields.priceCoins = priceCoin;
    }

    const media = await Media.findOneAndUpdate(
      { bunnyId: videoId },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: media });
  } catch (err) {
    console.error('保存视频记录失败:', err);
    res.status(500).json({ success: false, message: '保存视频记录失败' });
  }
});

// ——— 视频管理相关 API ———

// 获取视频列表
router.get('/videos', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const type = req.query.type || '';
    const category = req.query.category || '';
    
    // 构建查询条件
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { originalName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (type) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    
    const totalVideos = await Media.countDocuments(query);
    const videos = await Media.find(query)
      .populate('uploader', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    res.json({
      success: true,
      data: {
        videos,
        pagination: {
          current: page,
          total: Math.ceil(totalVideos / limit),
          count: totalVideos
        }
      }
    });
  } catch (error) {
    console.error('获取视频列表错误:', error);
    res.status(500).json({ success: false, message: '获取视频列表失败' });
  }
});

// 获取单个视频详情
router.get('/videos/:id', async (req, res) => {
  try {
    const video = await Media.findById(req.params.id)
      .populate('uploader', 'username email');
    
    if (!video) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }
    
    res.json({ success: true, data: video });
  } catch (error) {
    console.error('获取视频详情错误:', error);
    res.status(500).json({ success: false, message: '获取视频详情失败' });
  }
});

// 更新视频信息
router.put('/videos/:id', async (req, res) => {
  try {
    const { title, description, category, isPremiumOnly, downloadPrice, isPublic } = req.body;
    const updateData = {};
    
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (isPremiumOnly !== undefined) updateData.isPremiumOnly = isPremiumOnly;
    if (downloadPrice !== undefined) updateData.downloadPrice = downloadPrice;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    
    const video = await Media.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('uploader', 'username email');
    
    if (!video) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }
    
    res.json({ success: true, message: '视频信息更新成功', data: video });
  } catch (error) {
    console.error('更新视频信息错误:', error);
    res.status(500).json({ success: false, message: '更新视频信息失败' });
  }
});

// 删除视频
router.delete('/videos/:id', async (req, res) => {
  try {
    const video = await Media.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }
    
    // 这里可以添加删除云存储文件的逻辑
    // 如果是云存储文件，需要先从云端删除
    
    await Media.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '视频删除成功' });
  } catch (error) {
    console.error('删除视频错误:', error);
    res.status(500).json({ success: false, message: '删除视频失败' });
  }
});

// 批量操作视频
router.post('/videos/batch', async (req, res) => {
  try {
    const { action, videoIds, data } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的视频' });
    }
    
    let updateData = {};
    let message = '';
    
    switch (action) {
      case 'setCategory':
        updateData.category = data.category;
        message = `已将 ${videoIds.length} 个视频的分类设置为 ${data.category}`;
        break;
      case 'setPremium':
        updateData.isPremiumOnly = data.isPremiumOnly;
        if (data.downloadPrice !== undefined) {
          updateData.downloadPrice = data.downloadPrice;
        }
        message = `已将 ${videoIds.length} 个视频的付费状态设置为 ${data.isPremiumOnly ? '付费' : '免费'}`;
        break;
      case 'setPublic':
        updateData.isPublic = data.isPublic;
        message = `已将 ${videoIds.length} 个视频的公开状态设置为 ${data.isPublic ? '公开' : '私有'}`;
        break;
      case 'delete':
        await Media.deleteMany({ _id: { $in: videoIds } });
        return res.json({ success: true, message: `已删除 ${videoIds.length} 个视频` });
      default:
        return res.status(400).json({ success: false, message: '不支持的操作类型' });
    }
    
    await Media.updateMany(
      { _id: { $in: videoIds } },
      updateData
    );
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('批量操作视频错误:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

// 按文件名删除视频
router.delete('/videos/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const video = await Media.findOne({ filename });
    if (!video) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }

    // 删除云端文件（如果存在）
    if (video.cloudFileName) {
              // B2存储服务已移除，无需删除云端文件
        console.log('云端文件删除已跳过（B2服务已移除）');
    }

    await Media.deleteOne({ _id: video._id });
    res.json({ success: true, message: '视频删除成功' });
  } catch (error) {
    console.error('按文件名删除视频错误:', error);
    res.status(500).json({ success: false, message: '删除视频失败' });
  }
});

// 清理视频，只保留最新一条
router.delete('/videos/cleanup', async (req, res) => {
  try {
    // 找到最新创建的视频（按 createdAt 或 _id 排序）
    const latestVideo = await Media.findOne().sort({ createdAt: -1 });
    if (!latestVideo) {
      return res.status(404).json({ success: false, message: '没有可删除的视频' });
    }

    // 删除除最新视频以外的所有记录
    const result = await Media.deleteMany({ _id: { $ne: latestVideo._id }, type: 'video' });

    res.json({
      success: true,
      message: `已删除 ${result.deletedCount} 条旧视频记录，只保留最新视频 ${latestVideo.title}`
    });
  } catch (error) {
    console.error('清理视频错误:', error);
    res.status(500).json({ success: false, message: '清理视频失败' });
  }
});

// 管理员删除指定ID视频（MongoDB Atlas）
router.delete('/videos/byid/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const video = await Media.findById(id);
    if (!video) {
      return res.status(404).json({ success: false, message: '视频不存在' });
    }
    await Media.deleteOne({ _id: id });
    res.json({ success: true, message: '视频已从数据库删除' });
  } catch (error) {
    console.error('按ID删除视频错误:', error);
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

// 管理员批量删除所有视频（慎用！）
router.delete('/videos/all', async (req, res) => {
  try {
    const result = await Media.deleteMany({ type: 'video' });
    res.json({ success: true, message: `已删除 ${result.deletedCount} 条视频数据` });
  } catch (error) {
    console.error('批量删除视频错误:', error);
    res.status(500).json({ success: false, message: '批量删除失败' });
  }
});

// ——— 用户管理相关 API ———

// 获取用户列表
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const role = req.query.role || '';
    
    // 构建查询条件
    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) {
      query.role = role;
    }
    
    const totalUsers = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password') // 不返回密码字段
      .sort({ joinDate: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: page,
          total: Math.ceil(totalUsers / limit),
          count: totalUsers
        }
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// ——— 获取用户详情 ———
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ success: false, message: '获取用户详情失败' });
  }
});

// ——— 更新用户信息 ———
router.put('/users/:id', async (req, res) => {
  try {
    const { role, isPremium, premiumExpiry, dailyDownloadLimit, avatarUrl } = req.body;
    const updateData = {};
    
    if (role) updateData.role = role;
    if (isPremium !== undefined) updateData.isPremium = isPremium;
    if (premiumExpiry) updateData.premiumExpiry = new Date(premiumExpiry);
    if (dailyDownloadLimit !== undefined) updateData.dailyDownloadLimit = dailyDownloadLimit;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    res.json({ success: true, message: '用户信息更新成功', data: user });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ success: false, message: '更新用户信息失败' });
  }
});

// ——— 删除用户 ———
router.delete('/users/:id', async (req, res) => {
  try {
    // 防止删除管理员账户
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }
    
    if (targetUser.role === 'admin') {
      return res.status(403).json({ success: false, message: '不能删除管理员账户' });
    }
    
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(403).json({ success: false, message: '不能删除自己的账户' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

// ——— 获取统计信息 ———
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const premiumUsers = await User.countDocuments({ isPremium: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const todayUsers = await User.countDocuments({
      joinDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
    });
    
    // 最近7天注册统计
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await User.countDocuments({
        joinDate: { $gte: date, $lt: nextDate }
      });
      
      last7Days.push({
        date: date.toLocaleDateString('zh-CN'),
        count
      });
    }
    
    res.json({
      success: true,
      data: {
        summary: {
          totalUsers,
          premiumUsers,
          adminUsers,
          todayUsers
        },
        chart: {
          last7Days
        }
      }
    });
  } catch (error) {
    console.error('获取统计信息错误:', error);
    res.status(500).json({ success: false, message: '获取统计信息失败' });
  }
});

// ——— 批量操作用户 ———
router.post('/users/batch', async (req, res) => {
  try {
    const { action, userIds, data } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的用户' });
    }
    
    let updateData = {};
    let message = '';
    
    switch (action) {
      case 'setRole':
        updateData.role = data.role;
        message = `已将 ${userIds.length} 个用户的角色设置为 ${data.role}`;
        break;
      case 'setPremium':
        updateData.isPremium = data.isPremium;
        if (data.premiumExpiry) {
          updateData.premiumExpiry = new Date(data.premiumExpiry);
        }
        message = `已将 ${userIds.length} 个用户的会员状态设置为 ${data.isPremium ? '开启' : '关闭'}`;
        break;
      case 'delete':
        // 防止删除管理员和自己
        const usersToDelete = await User.find({
          _id: { $in: userIds },
          role: { $ne: 'admin' },
          _id: { $ne: req.user._id }
        });
        
        await User.deleteMany({
          _id: { $in: usersToDelete.map(u => u._id) }
        });
        
        return res.json({ 
          success: true, 
          message: `已删除 ${usersToDelete.length} 个用户` 
        });
      default:
        return res.status(400).json({ success: false, message: '不支持的操作' });
    }
    
    // 防止修改管理员账户
    const result = await User.updateMany(
      { 
        _id: { $in: userIds },
        role: { $ne: 'admin' }
      },
      updateData
    );
    
    res.json({ 
      success: true, 
      message: `${message}（实际操作了 ${result.modifiedCount} 个用户）` 
    });
  } catch (error) {
    console.error('批量操作用户错误:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

// ========== 获取UP主列表API ==========
router.get('/uploaders', async (req, res) => {
  try {
    const uploaders = await User.find({ 
      isUploader: true 
    }).select('_id username displayName uid bio').sort({ username: 1 });
    
    res.json({ success: true, uploaders });
  } catch (err) {
    console.error('获取UP主列表失败:', err);
    res.status(500).json({ success: false, message: '获取UP主列表失败' });
  }
});

// ========== 创建UP主空间API ==========
router.post('/space/:username', async (req, res) => {
  const username = req.params.username;
  console.log('收到创建UP主空间请求，username:', username);
  
  try {
    let user = await User.findOne({ username });
    console.log('查找现有用户结果:', user ? '找到' : '未找到');
    
    if (!user) {
      // 创建新用户
      console.log('开始创建新用户...');
      user = new User({ 
        username,
        email: `${username}@example.com`, // 临时邮箱
        password: 'temp_password', // 临时密码  
        displayName: username,
        bio: '这位UP主还没有填写个人简介。',
        isUploader: true,
        uid: username // 使用username作为uid
      });
      console.log('新用户对象创建，保存前的_id:', user._id);
      await user.save();
      console.log('新用户保存完成，保存后的_id:', user._id);
    } else {
      // 更新已存在的用户为UP主
      console.log('更新现有用户为UP主，原_id:', user._id);
      user.isUploader = true;
      if (!user.uid) {
        user.uid = username;
      }
      if (!user.bio) {
        user.bio = '这位UP主还没有填写个人简介。';
      }
      await user.save();
      console.log('用户更新完成，更新后的_id:', user._id);
    }
    
    // 确保用户对象有_id字段
    if (!user._id) {
      console.error('用户保存后仍然没有_id字段:', user);
      return res.status(500).json({ success: false, message: '用户创建失败，无法获取用户ID' });
    }
    
    const objectId = user._id.toString();
    console.log('创建UP主空间成功，objectId:', objectId); // 调试信息
    console.log('准备返回的数据:', { success: true, objectId });
    res.json({ success: true, user, objectId });
  } catch (err) {
    console.error('创建UP主空间失败:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

module.exports = router; 