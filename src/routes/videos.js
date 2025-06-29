const express = require('express');
const Media = require('../models/Media');

const router = express.Router();

// 增加浏览次数
router.post('/:filename/view', async (req, res) => {
  try {
    const { filename } = req.params;
    const media = await Media.findOne({
      $or: [
        { filename },
        { cloudFileName: filename }
      ]
    });

    if (media) {
      await media.incrementView();
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('增加浏览次数错误:', error);
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router; 