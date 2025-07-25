const User = require('../models/User');
const Media = require('../models/Media');
const Collection = require('../models/Collection');
const mongoose = require('mongoose');

// 辅助函数：构建用户查询条件，支持ObjectId、uid或用户名
const buildUserQueryConditions = (uid) => {
  const queryConditions = [
    { uid: uid },
    { username: uid.toLowerCase() }
  ];
  
  // 如果uid是有效的ObjectId格式，也添加到查询条件中
  if (mongoose.Types.ObjectId.isValid(uid)) {
    queryConditions.push({ _id: new mongoose.Types.ObjectId(uid) });
  }
  
  return queryConditions;
};

// UP主空间页面
exports.spacePage = async (req, res) => {
  try {
    const { uid } = req.params;
    
    // 查找UP主信息（兼容 ObjectId、uid 或用户名），并放宽 isUploader 限制
    const uploader = await User.findOne({
      $or: buildUserQueryConditions(uid)
    });
    if (!uploader) {
      return res.status(404).render('error', { 
        message: 'UP主不存在',
        error: { status: 404 }
      });
    }

    // 获取默认视频列表（最新发布，分页）
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // 每页12个视频
    const skip = (page - 1) * limit;

    let videos = await Media.find({ 
      uploader: uploader._id, 
      type: 'video',
      isPublic: true 
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
          .populate('uploader', 'uid name');

    // 为SSR视频添加预览字段
    videos = videos.map(v => {
      const obj = v.toObject();
      if (obj.bunnyId || obj.guid) {
        const guid = obj.bunnyId || obj.guid;
        obj.previewImage = `https://vz-48ed4217-ce4.b-cdn.net/${guid}/preview.webp`;
        obj.previewUrl   = `https://vz-48ed4217-ce4.b-cdn.net/${guid}/preview.mp4`;
      }
      return obj;
    });

    // 获取视频总数（用于分页）
    const totalVideos = await Media.countDocuments({ 
      uploader: uploader._id, 
      type: 'video',
      isPublic: true 
    });

    // 获取合集列表
    const collections = await Collection.find({ 
      uid: uploader.uid, 
      isPublic: true 
    })
    .sort({ order: 1, createdAt: -1 })
    .populate('videoIds', 'title coverUrl thumbnail duration views')
    .limit(6); // 最多显示6个合集

    // 计算分页信息
    const totalPages = Math.ceil(totalVideos / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.render('space', {
      layout: false, // 禁用布局，因为页面已包含完整HTML结构
      uploader,
      videos,
      collections,
      pagination: {
        current: page,
        total: totalPages,
        hasNext: hasNextPage,
        hasPrev: hasPrevPage,
        totalVideos
      },
      activeTab: 'newest',
      currentUser: req.user || null
    });

  } catch (error) {
    console.error('Space page error:', error);
    res.status(500).render('error', { 
      message: '服务器错误',
      error: { status: 500 }
    });
  }
};

// 获取UP主视频列表API
exports.getUploaderVideos = async (req, res) => {
  try {
    const { uid } = req.params;
    const { sort = 'newest', page = 1, limit = 12 } = req.query;
    
    // 查找UP主（兼容 ObjectId、uid 或用户名），并放宽 isUploader 限制
    const uploader = await User.findOne({
      $or: buildUserQueryConditions(uid)
    });
    if (!uploader) {
      return res.status(404).json({ success: false, message: 'UP主不存在' });
    }

    // 构建排序条件
    let sortCondition;
    switch (sort) {
      case 'plays':
        sortCondition = { views: -1 };
        break;
      case 'favorites':
        sortCondition = { favoriteCount: -1 };
        break;
      case 'newest':
      default:
        sortCondition = { createdAt: -1 };
        break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 查询视频
    const videos = await Media.find({ 
      uploader: uploader._id, 
      type: 'video',
      isPublic: true 
    })
    .sort(sortCondition)
    .limit(parseInt(limit))
    .skip(skip)
            .populate('uploader', 'uid name')
    .select('title duration views danmakuCount favoriteCount createdAt url bunnyId guid');

    // 获取总数
    const total = await Media.countDocuments({ 
      uploader: uploader._id, 
      type: 'video',
      isPublic: true 
    });

    // 处理视频数据，若可用则添加预览字段（保留 coverUrl/thumbnail 以便前端回退）
    const processedVideos = videos.map(video => {
      const obj = video.toObject();
      
      // 仅在 Bunny 视频存在时才生成预览
      if (obj.bunnyId || obj.guid) {
        const videoGuid = obj.bunnyId || obj.guid;
        // 静态 WebP 预览
        obj.previewImage = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.webp`;
        // 动态 MP4/WebM 预览
        obj.previewUrl = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.mp4`;
      }
      
      return obj;
    });

    // 调试断言：确保输出无旧字段
    if (processedVideos.some(x => x.coverUrl || x.thumbnail)) {
      console.warn('❌ spaceController API still contains cover/thumbnail');
    }

    res.json({
      success: true,
      data: {
        videos: processedVideos,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + videos.length < total,
          hasPrev: parseInt(page) > 1,
          totalCount: total
        }
      }
    });

  } catch (error) {
    console.error('Get uploader videos error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

// 获取UP主合集列表API
exports.getUploaderCollections = async (req, res) => {
  try {
    const { uid } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // 查找UP主（兼容 ObjectId、uid 或用户名），并放宽 isUploader 限制
    const uploader = await User.findOne({
      $or: buildUserQueryConditions(uid)
    });
    if (!uploader) {
      return res.status(404).json({ success: false, message: 'UP主不存在' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 查询合集
    const collections = await Collection.find({ 
      uid: uploader.uid, 
      isPublic: true 
    })
    .sort({ order: 1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .populate({
      path: 'videoIds',
      select: 'title coverUrl thumbnail duration views',
      options: { limit: 3 } // 每个合集最多显示3个视频预览
    });

    // 获取总数
    const total = await Collection.countDocuments({ 
      uid: uploader.uid, 
      isPublic: true 
    });

    res.json({
      success: true,
      data: {
        collections,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          hasNext: skip + collections.length < total,
          hasPrev: parseInt(page) > 1,
          totalCount: total
        }
      }
    });

  } catch (error) {
    console.error('Get uploader collections error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}; 