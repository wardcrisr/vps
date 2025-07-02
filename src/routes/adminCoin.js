const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const User  = require('../models/User');
const Media = require('../models/Media');
const { ok, err } = require('../utils/response');

router.use(authenticateToken, requireAdmin);

// GET /api/admin/users/:id/coins
router.get('/users/:id/coins', async (req,res)=>{
  const user = await User.findById(req.params.id, 'coins');
  if(!user) return err(res,1,'user not found',404);
  return ok(res,{ coins: user.coins });
});

// PUT /api/admin/video/:id/price
router.put('/video/:id/price', async (req,res)=>{
  const { price } = req.body;
  if(price==null || price<0) return err(res,1,'invalid price');
  const video = await Media.findByIdAndUpdate(req.params.id,{ downloadPrice: price },{ new:true });
  if(!video) return err(res,1,'video not found',404);
  return ok(res,{ price: video.downloadPrice });
});

module.exports = router; 