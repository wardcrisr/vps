const express  = require('express');
const router   = express.Router();
const homeCtrl = require('../controllers/homeController');

router.get('/', homeCtrl.renderHome);

module.exports = router;
