const Media = require('../models/Media');
const User = require('../models/User');

/**
 * 首页控制器 - 展示推荐视频列表（B站风格）
 */
exports.renderIndex = async (req, res) => {
  try {
    // 性能优化：使用索引查询 + 并行处理
    const [videos, uploaders] = await Promise.all([
      // 联表查询视频和UP主信息 - 优化版
      Media.aggregate([
        // 使用复合索引：type + isPublic + createdAt
        {
          $match: {
            type: 'video',
            isPublic: true
          }
        },
        // 按创建时间降序排列（索引优化）
        {
          $sort: { createdAt: -1 }
        },
        // 限制数量，减少数据传输
        {
          $limit: 20
        },
        // 联表查询UP主信息（只查询必要字段）
        {
          $lookup: {
            from: 'users',
            localField: 'uploader',
            foreignField: '_id',
            as: 'uploaderInfo',
            pipeline: [
              {
                $project: {
                  uid: 1,
                  name: 1,
                  displayName: 1,
                  username: 1,
                  uploaderAvatarUrl: 1
                }
              }
            ]
          }
        },
        // 展开UP主信息
        {
          $unwind: {
            path: '$uploaderInfo',
            preserveNullAndEmptyArrays: true
          }
        },
        // 选择需要的字段，减少内存使用
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
              },
              avatarUrl: '$uploaderInfo.uploaderAvatarUrl'
            }
          }
        }
      ]),
      
      // 并行查询UP主头像数据
      User.find({ isUploader: true })
        .select('uid name displayName username uploaderAvatarUrl')
        .lean()
        .limit(50) // 限制数量，提升性能
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