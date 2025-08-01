const Media = require('../models/Media');
const User = require('../models/User');

/**
 * 首页控制器 - 展示推荐视频列表（B站风格）
 */
exports.renderIndex = async (req, res) => {
  try {
    // 联表查询视频和UP主信息
    const videos = await Media.aggregate([
      // 只查询视频类型且公开的内容
      {
        $match: {
          type: 'video',
          isPublic: true
        }
      },
      // 联表查询UP主信息
      {
        $lookup: {
          from: 'users',
          localField: 'uploader',
          foreignField: '_id',
          as: 'uploaderInfo'
        }
      },
      // 展开UP主信息
      {
        $unwind: {
          path: '$uploaderInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      // 选择需要的字段，明确排除旧字段
      {
        $project: {
          _id: 1,
          id: '$_id',
          title: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
          likes: 1,
          danmakuCount: 1,
          isPremiumOnly: 1,
          bunnyId: 1,
          guid: 1,
          up: {
            uid: '$uploaderInfo.uid',
            name: {
              $ifNull: [
                '$uploaderInfo.name',
                {
                  $ifNull: [
                    '$uploaderInfo.displayName',
                    '$uploaderInfo.username'
                  ]
                }
              ]
            }
          }
        }
      },
      // 按创建时间降序排列
      {
        $sort: { createdAt: -1 }
      },
      // 限制数量
      {
        $limit: 20
      }
    ]);

    // 处理没有UP主信息的视频
    const processedVideos = videos.map(video => {
      // 删除旧的封面字段
      delete video.coverUrl;
      delete video.thumbnail;
      
      // 添加 previewUrl 字段
      if (video.bunnyId || video.guid) {
        const videoGuid = video.bunnyId || video.guid;
        video.previewUrl = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.webp`;
      }

      if (!video.up.uid) {
        video.up = {
          uid: 'anonymous',
          name: '匿名用户'
        };
      }
      return video;
    });

    // 调试断言：确保输出无旧字段
    if (processedVideos.some(x => x.coverUrl || x.thumbnail)) {
      console.warn('❌ indexController renderIndex still contains cover/thumbnail');
    }

    // ==================== 新增：获取 UP 主头像数据 ====================
    // 仅查询 isUploader: true 的用户，按粉丝数倒序取前 12 个
    const uploaders = await User.find(
      { isUploader: true },
      {
        _id: 1,
        uid: 1,
        username: 1,
        displayName: 1,
        name: 1,
        avatarUrl: 1,
        fansCount: 1
      }
    )
      .sort({ fansCount: -1 })
      // 取消限制，展示全部UP主头像
      .lean();
    // ===============================================================

    // 渲染首页
    res.render('index', {
      title: 'X福利姬 - 视频分享平台',
      videos: processedVideos,
      uploaders, // 传递到模板
      activeTag: 'home',
      disableDynamicLoad: false,
      user: req.user || null
    });

  } catch (error) {
    console.error('首页数据查询失败:', error);
    res.status(500).render('error', {
      title: '服务器错误',
      message: '页面加载失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
};

/**
 * 获取更多视频（AJAX接口）
 */
exports.getMoreVideos = async (req, res) => {
  try {
    const { page = 1, limit = 20, category = 'all' } = req.query;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const matchCondition = {
      type: 'video',
      isPublic: true
    };

    if (category && category !== 'all') {
      matchCondition.category = category;
    }

    const videos = await Media.aggregate([
      { $match: matchCondition },
      {
        $lookup: {
          from: 'users',
          localField: 'uploader',
          foreignField: '_id',
          as: 'uploaderInfo'
        }
      },
      {
        $unwind: {
          path: '$uploaderInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          id: '$_id',
          title: 1,
          duration: 1,
          createdAt: 1,
          views: 1,
          likes: 1,
          danmakuCount: 1,
          isPremiumOnly: 1,
          bunnyId: 1,
          guid: 1,
          up: {
            uid: '$uploaderInfo.uid',
            name: {
              $ifNull: [
                '$uploaderInfo.name',
                {
                  $ifNull: [
                    '$uploaderInfo.displayName',
                    '$uploaderInfo.username'
                  ]
                }
              ]
            }
          }
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: parseInt(skip) },
      { $limit: parseInt(limit) }
    ]);

    // 处理数据
    const processedVideos = videos.map(video => {
      // 删除旧的封面字段
      delete video.coverUrl;
      delete video.thumbnail;
      
      // 添加 previewUrl 字段
      if (video.bunnyId || video.guid) {
        const videoGuid = video.bunnyId || video.guid;
        video.previewUrl = `https://vz-48ed4217-ce4.b-cdn.net/${videoGuid}/preview.webp`;
      }

      if (!video.up.uid) {
        video.up = {
          uid: 'anonymous',
          name: '匿名用户'
        };
      }
      return video;
    });

    // 调试断言：确保输出无旧字段
    if (processedVideos.some(x => x.coverUrl || x.thumbnail)) {
      console.warn('❌ indexController getMoreVideos still contains cover/thumbnail');
    }

    res.json({
      success: true,
      videos: processedVideos,
      hasMore: videos.length === parseInt(limit)
    });

  } catch (error) {
    console.error('获取更多视频失败:', error);
    res.status(500).json({
      success: false,
      message: '获取视频失败'
    });
  }
}; 