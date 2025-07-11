const Media = require('../models/Media');
const User = require('../models/User');

/**
 * 公共函数：根据筛选条件查询视频并渲染到 index.ejs
 * @param {Object} res - Express Response
 * @param {Object} req - Express Request
 * @param {String} title - 页面标题
 * @param {Object} matchCondition - MongoDB $match 条件
 * @param {String} activeTag - 在导航中高亮的标签
 */
async function renderByCondition(req, res, title, matchCondition, activeTag) {
  try {
    // 基础条件：仅公开视频
    const baseMatch = {
      type: 'video',
      isPublic: true,
      ...matchCondition
    };

    const videos = await Media.aggregate([
      { $match: baseMatch },
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
                { $ifNull: ['$uploaderInfo.displayName', '$uploaderInfo.username'] }
              ]
            }
          }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 20 }
    ]);

    // 数据后处理：添加 previewUrl & 补全UP主信息
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
        video.up = { uid: 'anonymous', name: '匿名用户' };
      }
      return video;
    });

    // 调试断言：确保输出无旧字段
    if (processedVideos.some(x => x.coverUrl || x.thumbnail)) {
      console.warn('❌ tagController still contains cover/thumbnail');
    }

    res.render('index', {
      title,
      videos: processedVideos,
      activeTag,
      disableDynamicLoad: true,
      user: req.user || null
    });
  } catch (error) {
    console.error(`${title} 页面渲染失败:`, error);
    res.status(500).render('error', {
      title: '服务器错误',
      message: '页面加载失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
}

// 免费视频（完全免费）
exports.renderFree = (req, res) => {
  const match = {
    category: 'free'
  };
  return renderByCondition(req, res, '免费视频 - X福利姬', match, 'free');
};

// 付费视频（单片付费）
exports.renderPaid = (req, res) => {
  const match = {
    category: 'paid'
  };
  return renderByCondition(req, res, '付费视频 - X福利姬', match, 'paid');
};

// VIP 视频（会员专享）
exports.renderVIP = (req, res) => {
  const match = {
    category: 'member'
  };
  return renderByCondition(req, res, '会员视频 - X福利姬', match, 'vip');
}; 