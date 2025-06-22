// src/routes/postRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/postController');

router.get('/',            ctrl.list);
router.get('/search',      ctrl.search);
router.get('/post/:id',    ctrl.detail);

module.exports = router;
