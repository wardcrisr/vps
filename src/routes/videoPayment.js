const router = require('express').Router();
const { authenticateToken } = require('./middleware/auth');
const Media     = require('../models/Media');
const User      = require('../models/User');
const Purchase  = require('../models/Purchase');
const Log       = require('../models/Log');
const { ok, err }= require('../utils/response');
const crypto = require('crypto');

// GET /api/video/:id/preview  (无需登录)
router.get('/:id/preview', async (req, res) => {
  try {
    const video = await Media.findById(req.params.id);
    if (!video) return err(res,1,'video not found',404);

    // 优先使用 HLS 试看片段，其次回退到 CDN / 本地 URL。
    let previewUrl;
    if (video.streamUrl) {
      // 已有 HLS 地址，拼试看参数（30秒）
      previewUrl = `${video.streamUrl}?start=0&duration=30`;
    } else if (video.bunnyId) {
      // 构造 Bunny iframe 地址
      const libId = process.env.LIB_ID || process.env.BUNNY_VIDEO_LIBRARY || '461001';
      previewUrl = `https://iframe.mediadelivery.net/embed/${libId}/${video.bunnyId}?start=0&duration=30&muted=true&autoplay=true&playsinline=true`;
    } else if (video.cdnUrl && video.cdnUrl.startsWith('http')) {
      previewUrl = video.cdnUrl;
    } else {
      // 最后回退本地
      const fileKey = video.cloudFileName || video.filename;
      if(fileKey) previewUrl = `/vod/video/${encodeURIComponent(fileKey)}`;
    }

    // 统一签名逻辑（HLS 或 iframe 均适用）
    if(process.env.BUNNY_SECRET && previewUrl && previewUrl.includes('mediadelivery.net') && !previewUrl.includes('token=')){
      const expires = Math.floor(Date.now() / 1000) + 1800; // 30 分钟
      const raw   = `${process.env.BUNNY_SECRET}${video.bunnyId}${expires}`;
      const token = crypto.createHash('sha256').update(raw).digest('hex');
      previewUrl += `${previewUrl.includes('?') ? '&' : '?'}token=${token}&expires=${expires}`;
    }

    if(!previewUrl){
      return err(res,1,'preview url missing',500);
    }

    return ok(res,{ url: previewUrl });
  } catch(e){ console.error(e); return err(res,1,'server error',500); }
});

// POST /api/video/:id/purchase
router.post('/:id/purchase', authenticateToken, async (req,res)=>{
  try{
    const userId=req.user._id; const vid=req.params.id;
    const video=await Media.findById(vid);
    if(!video) return err(res,1,'video not found',404);

    const existed=await Purchase.findOne({ userId, videoId: vid });
    if(existed) return ok(res,{ purchased:true });

    const price = video.downloadPrice || 0;
    const user = await User.findById(userId);
    if(user.coins < price) return err(res,1,'insufficient balance',402);

    user.coins -= price; await user.save();
    await Purchase.create({ userId, videoId: vid, price });
    await Log.create({ userId, type:'purchase', amount:-price, remark:`buy ${vid}` });
    return ok(res,{ purchased:true, balance:user.coins });
  }catch(e){ console.error(e); return err(res,1,'server error',500);} 
});

// GET /api/video/:id/play
router.get('/:id/play', authenticateToken, async (req,res)=>{
  try{
    const user = await User.findById(req.user._id);
    const video = await Media.findById(req.params.id);

    if(!video) return err(res,1,'video not found',404);

    // 访问权限判断
    let hasAccess = false;
    if(video.isPremiumOnly){
      // 会员视频：仅会员可直接观看
      hasAccess = user && user.isPremium;
    }else{
      // 付费视频：检查是否已购买
      const purchased = await Purchase.findOne({ userId:user._id, videoId:req.params.id });
      hasAccess = !!purchased;
    }

    if(!hasAccess){
      return err(res,1,'no permission',403);
    }

    // 生成视频播放地址，按优先级处理
    let playUrl;
    
    // 1. 优先使用HLS流地址
    if (video.streamUrl) {
      playUrl = video.streamUrl;
    } 
    // 2. 使用Bunny Stream iframe
    else if (video.bunnyId) {
      const libId = process.env.BUNNY_VIDEO_LIBRARY || '461001';
      playUrl = `https://iframe.mediadelivery.net/embed/${libId}/${video.bunnyId}`;
      
      // 添加签名认证
      if (process.env.BUNNY_SECRET) {
        const expires = Math.floor(Date.now() / 1000) + 3600; // 1小时有效期
        const raw = `${process.env.BUNNY_SECRET}${video.bunnyId}${expires}`;
        const token = crypto.createHash('sha256').update(raw).digest('hex');
        playUrl += `?token=${token}&expires=${expires}`;
      }
    }
    // 3. 使用CDN地址
    else if (video.cdnUrl) {
      playUrl = video.cdnUrl;
    }
    // 4. 使用本地文件
    else if (video.cloudFileName || video.filename) {
      const fileKey = video.cloudFileName || video.filename;
      playUrl = `/vod/video/${encodeURIComponent(fileKey)}`;
    }
    
    if (!playUrl) {
      console.error(`视频播放地址生成失败: ${req.params.id}`, {
        streamUrl: video.streamUrl,
        bunnyId: video.bunnyId,
        cdnUrl: video.cdnUrl,
        filename: video.filename,
        cloudFileName: video.cloudFileName
      });
      return err(res, 1, 'video playback url unavailable', 500);
    }
    
    return ok(res, { url: playUrl });
  }catch(e){ 
    console.error('视频播放错误:', e); 
    return err(res,1,'server error',500);
  } 
});

module.exports = router; 