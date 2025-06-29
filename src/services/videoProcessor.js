const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

/**
 * 生成随机文件名
 */
function randomFileName(ext = '') {
  const id = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}_${id}${ext}`;
}

/**
 * 从本地视频文件生成缩略图
 * @param {String} videoPath 本地视频文件路径
 * @param {String} outputDir 输出目录
 * @param {Object} [options]
 * @param {Number} [options.timestamp=3] 截帧时间点(秒)
 * @returns {Promise<{thumbPath:string, thumbUrl:string}>}
 */
async function generateThumbnail(videoPath, outputDir, options = {}) {
  const { timestamp = 3 } = options;

  if (!fs.existsSync(videoPath)) {
    throw new Error(`视频文件不存在: ${videoPath}`);
  }

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 生成缩略图文件名
  const thumbFileName = randomFileName('.jpg');
  const thumbPath = path.join(outputDir, thumbFileName);

  // 使用 ffmpeg 截取缩略图
  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on('error', reject)
      .on('end', resolve)
      .screenshots({
        timestamps: [timestamp],
        filename: thumbFileName,
        folder: outputDir,
        size: '640x360'
      });
  });

  return { 
    thumbPath, 
    thumbFileName,
    thumbUrl: `/uploads/thumbs/${thumbFileName}` 
  };
}

/**
 * 获取视频信息
 * @param {String} videoPath 视频文件路径
 * @returns {Promise<Object>} 视频信息
 */
async function getVideoInfo(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          width: videoStream?.width,
          height: videoStream?.height,
          codec: videoStream?.codec_name
        });
      }
    });
  });
}

module.exports = { 
  generateThumbnail,
  getVideoInfo
}; 