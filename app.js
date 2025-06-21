// app.js
const express = require('express');
const app     = express();
const port    = process.env.PORT || 3000;

// 静态资源
app.use(express.static('public'));

// 路由
const indexRouter = require('./src/routes/index');
app.use('/', indexRouter);

// 启动
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

