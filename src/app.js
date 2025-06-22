// src/app.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const postRoutes = require('./routes/postRoutes');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 静态资源目录
app.use('/static', express.static(path.join(__dirname, '..', 'public')));

// 连接 MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

app.use('/', postRoutes);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));

