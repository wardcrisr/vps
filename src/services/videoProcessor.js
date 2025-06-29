const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const b2DirectUpload = require('./b2DirectUpload');

/**
 * 生成随机文件名
 */
function randomFileName(ext = '') {
  const id = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}_${id}${ext}`;
}

/**
 * 从 Backblaze B2 生成缩略图并上传至同一 Bucket
 * @param {String} fileKey 视频在 B2 中的 Key (例如 video/2025/06/xxx.mp4)
 * @param {Object} [options]
 * @param {Number} [options.timestamp=3] 截帧时间点(秒)
 * @returns {Promise<{thumbKey:string, thumbUrl:string}>}
 */
async function generateThumbnail(fileKey, options = {}) {
  const { timestamp = 3 } = options;

  // 1. 获取 10 分钟有效的临时下载地址
  const dl = await b2DirectUpload.generateDownloadUrl(fileKey, 600);
  if (!dl.success) {
    throw new Error(`无法生成下载链接: ${dl.error}`);
  }

  // 2. 准备临时文件路径
  const tmpDir = os.tmpdir();
  const tmpVideo = path.join(tmpDir, randomFileName(path.extname(fileKey)));
  const tmpThumb = path.join(tmpDir, randomFileName('.jpg'));

  // 3. 下载视频到本地临时文件
  await new Promise((resolve, reject) => {
    axios({ method: 'get', url: dl.url, responseType: 'stream' })
      .then(res => {
        const write = fs.createWriteStream(tmpVideo);
        res.data.pipe(write);
        write.on('finish', resolve);
        write.on('error', reject);
      })
      .catch(reject);
  });

  // 4. 使用 ffmpeg 截取缩略图
  await new Promise((resolve, reject) => {
    ffmpeg(tmpVideo)
      .on('error', reject)
      .on('end', resolve)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(tmpThumb),
        folder: path.dirname(tmpThumb),
        size: '640x360'
      });
  });

  // 5. 上传缩略图到 B2 (使用与视频对应的路径)
  const thumbKey = fileKey
    .replace(/^video\//, 'thumb/')
    .replace(path.extname(fileKey), '.jpg');

  await b2DirectUpload.s3
    .upload({
      Bucket: b2DirectUpload.bucketName,
      Key: thumbKey,
      Body: fs.createReadStream(tmpThumb),
      ContentType: 'image/jpeg'
    })
    .promise();

  // 6. 清理临时文件
  fs.unlink(tmpVideo, () => {});
  fs.unlink(tmpThumb, () => {});

  const thumbUrl = b2DirectUpload.cdnBaseUrl
    ? `${b2DirectUpload.cdnBaseUrl}/${thumbKey}`
    : `https://${b2DirectUpload.bucketName}.s3.${process.env.B2_ENDPOINT}/${thumbKey}`;

  return { thumbKey, thumbUrl };
}

module.exports = { generateThumbnail }; 