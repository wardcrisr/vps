const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

router.get('/', async (req, res) => {
  const posts = await Post.find().lean();
  res.render('index', { posts });
});
router.get('/category/:slug', async (req, res) => {
  const posts = await Post.find({ category: req.params.slug }).lean();
  res.render('category', { posts });
});
router.get('/post/:id', async (req, res) => {
  const post = await Post.findById(req.params.id).lean();
  res.render('post', { post });
});
module.exports = router;
