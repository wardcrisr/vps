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
      // 选择需要的字段
      {
        $project: {
          _id: 1,
          id: '$_id',
          title: 1,
          coverUrl: {
            $ifNull: ['$coverUrl', '$thumbnail']
          },
          duration: 1,
          createdAt: 1,
          views: 1,
          likes: 1,
          danmakuCount: 1,
          isPremiumOnly: 1,
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
      // 修复缺失或相对路径封面 URL
      if (!video.coverUrl || video.coverUrl.trim() === '') {
        video.coverUrl = '/api/placeholder/video-thumbnail';
      } else if (!video.coverUrl.startsWith('http') && !video.coverUrl.startsWith('/')) {
        video.coverUrl = '/' + video.coverUrl.replace(/^\/+/, '');
      }

      if (!video.up.uid) {
        video.up = {
          uid: 'anonymous',
          name: '匿名用户'
        };
      }
      return video;
    });

    // 渲染首页
    res.render('index', {
      title: 'X福利姬 - 视频分享平台',
      videos: processedVideos,
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
          coverUrl: {
            $ifNull: ['$coverUrl', '$thumbnail']
          },
          duration: 1,
          createdAt: 1,
          views: 1,
          likes: 1,
          danmakuCount: 1,
          isPremiumOnly: 1,
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
      // 修复缺失或相对路径封面 URL
      if (!video.coverUrl || video.coverUrl.trim() === '') {
        video.coverUrl = '/api/placeholder/video-thumbnail';
      } else if (!video.coverUrl.startsWith('http') && !video.coverUrl.startsWith('/')) {
        video.coverUrl = '/' + video.coverUrl.replace(/^\/+/, '');
      }

      if (!video.up.uid) {
        video.up = {
          uid: 'anonymous',
          name: '匿名用户'
        };
      }
      return video;
    });

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