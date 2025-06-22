// src/controllers/postController.js
const Post = require('../models/Post');

// 首页列表，带分页
exports.list = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 10;
  const [ total, posts ] = await Promise.all([
    Post.countDocuments(),
    Post.find()
        .sort({ createdAt: -1 })
        .skip((page-1)*perPage)
        .limit(perPage)
  ]);

  res.render('index', {
    posts,
    page,
    totalPages: Math.ceil(total/perPage)
  });
};

// 搜索
exports.search = async (req, res) => {
  const q = req.query.q || '';
  const posts = await Post.find({
    title: new RegExp(q, 'i')
  }).limit(50);
  res.render('index', { posts, page:1, totalPages:1, q });
};

// 详情页
exports.detail = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).send('Not Found');
  post.views++;
  await post.save();
  res.render('detail', { post });
};
