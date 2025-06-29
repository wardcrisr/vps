# React 管理员仪表板实现说明

## 功能概述

已成功为项目添加了 React 管理员仪表板功能，包含完整的视频管理系统。

## 创建的文件

### 1. React 组件
- `src/pages/AdminDashboard.jsx` - 管理员仪表板主组件
- `src/components/Header.jsx` - 导航头部组件（包含后台管理链接）
- `src/App.jsx` - React 应用主入口
- `src/index.jsx` - React 渲染入口

### 2. 配置文件
- `src/routes.js` - 路由配置文件
- `src/api.js` - API 接口封装
- `vite.config.js` - Vite 构建配置
- `public/admin-spa.html` - React 应用 HTML 模板

### 3. 后端 API 扩展
- `src/routes/admin.js` - 添加了视频管理相关的 API 接口

## 功能特性

### AdminDashboard 组件功能
- ✅ 获取并展示视频列表
- ✅ 新增视频功能（带文件上传）
- ✅ 编辑视频信息
- ✅ 删除视频功能
- ✅ 响应式设计（Bootstrap）
- ✅ 加载状态管理
- ✅ 错误处理

### Header 组件功能
- ✅ 管理员专用"后台管理"链接
- ✅ 基于用户角色的条件显示
- ✅ 用户认证状态检查
- ✅ 响应式导航菜单

### 路由配置
- ✅ `/admin` 路由配置
- ✅ 管理员权限验证 (`auth: 'admin'`)
- ✅ 路由保护机制

### API 接口
- ✅ 视频列表获取 (`GET /api/admin/videos`)
- ✅ 视频创建 (`POST /api/upload`)
- ✅ 视频更新 (`PUT /api/admin/videos/:id`)
- ✅ 视频删除 (`DELETE /api/admin/videos/:id`)
- ✅ 批量操作支持
- ✅ 请求/响应拦截器
- ✅ 自动 token 处理

## 后端 API 接口详情

### 视频管理接口
- `GET /api/admin/videos` - 获取视频列表（支持分页、搜索、筛选）
- `GET /api/admin/videos/:id` - 获取单个视频详情
- `PUT /api/admin/videos/:id` - 更新视频信息
- `DELETE /api/admin/videos/:id` - 删除视频
- `POST /api/admin/videos/batch` - 批量操作视频

### 支持的查询参数
- `page` - 页码
- `limit` - 每页数量
- `search` - 搜索关键词
- `type` - 文件类型筛选
- `category` - 分类筛选

## 安装和使用

### 1. 安装依赖
```bash
cd content-distribution
npm install
```

### 2. 开发模式
```bash
# 启动后端服务器
npm run dev

# 另开终端启动前端开发服务器
npm run dev:frontend
```

### 3. 构建生产版本
```bash
npm run build:frontend
```

## 技术栈

- **前端**: React 18 + React Router 6
- **构建工具**: Vite
- **UI 框架**: Bootstrap 5
- **HTTP 客户端**: Axios
- **后端**: Express.js + MongoDB + Mongoose

## 项目结构

```
content-distribution/
├── src/
│   ├── components/
│   │   └── Header.jsx
│   ├── pages/
│   │   └── AdminDashboard.jsx
│   ├── routes/
│   │   └── admin.js (扩展)
│   ├── models/
│   │   └── Media.js (现有)
│   ├── App.jsx
│   ├── index.jsx
│   ├── routes.js
│   └── api.js
├── public/
│   └── admin-spa.html
├── vite.config.js
└── package.json (更新)
```

## 权限控制

- 使用 JWT 令牌进行身份认证
- 管理员路由需要 `role: 'admin'` 权限
- 前端路由保护和后端 API 权限验证双重保障

## 使用说明

1. 确保用户具有管理员权限 (`role: 'admin'`)
2. 登录后在导航栏会显示"后台管理"链接
3. 点击进入管理员仪表板
4. 可以进行视频的增删改查操作

## 注意事项

- 文件上传使用现有的 `/api/upload` 接口
- 视频数据基于 `Media` 模型
- 需要确保 MongoDB 连接正常
- 管理员权限通过 JWT 中的 `role` 字段验证 