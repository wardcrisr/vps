# B2 视频管理系统 - 快速使用指南

## 🚀 系统概述

B2 视频管理系统已成功集成到您的内容分发平台中，提供完整的云端视频存储和管理功能。

## ✅ 已实现的功能

### 后端接口 (完整实现)
- **视频列表**: `GET /api/admin/b2-videos` - 获取B2存储中的所有视频
- **视频上传**: `POST /api/admin/b2-videos/upload` - 上传视频到B2 (最大500MB)
- **视频删除**: `DELETE /api/admin/b2-videos/:fileName` - 删除B2存储中的视频
- **下载链接**: `GET /api/admin/b2-videos/:fileName/download` - 生成带签名的下载链接
- **存储统计**: `GET /api/admin/b2-videos/stats/storage` - 获取存储使用统计

### 前端组件 (完整实现)
- **B2VideoManager**: React组件 (`src/pages/B2VideoManager.jsx`)
- **管理员面板**: 集成到AdminDashboard中
- **实时上传进度**: 支持大文件上传进度显示
- **响应式设计**: 支持各种屏幕尺寸

### B2存储服务 (完整实现)
- **B2Storage**: 简化版B2存储服务 (`src/services/b2Storage-simple.js`)
- **S3兼容API**: 使用AWS SDK与Backblaze B2通信
- **自动CORS配置**: 自动配置跨域访问策略
- **文件组织**: 按日期和类型自动组织文件结构

## 🛠️ 快速启动

### 1. 环境配置

确保 `src/config/production.env` 中的B2配置正确：

```env
# Backblaze B2 配置
B2_APPLICATION_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_application_key
B2_BUCKET_NAME=your_bucket_name
B2_BUCKET_ID=your_bucket_id
B2_ENDPOINT=s3.us-east-005.backblazeb2.com

# CDN配置 (可选)
CDN_BASE_URL=https://f005.backblazeb2.com/file/your_bucket_name
```

### 2. 启动应用

```bash
cd content-distribution
npm run dev
```

### 3. 访问管理面板

1. 打开浏览器访问 `http://localhost:3000/admin`
2. 登录管理员账户
3. 点击左侧菜单的 "B2 视频管理"

## 📋 功能使用指南

### 视频上传
1. 在上传区域点击"选择视频文件"
2. 选择视频文件 (支持MP4, AVI, MOV等格式，最大500MB)
3. 填写视频标题 (必填)
4. 填写视频描述 (可选)
5. 点击"上传到B2"按钮
6. 等待上传完成，可实时查看进度

### 视频管理
- **查看列表**: 自动显示B2存储中的所有视频文件
- **复制链接**: 点击复制按钮获取下载链接
- **打开视频**: 点击外链按钮在新窗口查看
- **删除视频**: 点击删除按钮永久删除文件 (谨慎操作)

### 存储监控
仪表板顶部显示：
- **连接状态**: B2存储连接状态
- **视频总数**: 存储中的视频文件数量
- **存储用量**: 已使用的存储空间 (GB)
- **存储桶**: 当前使用的B2存储桶名称

## 🧪 系统测试

运行自动化测试脚本：

```bash
cd content-distribution
node test-b2-video-management.js
```

测试包括：
- ✅ 服务器健康检查
- ✅ 管理员认证
- ✅ B2存储连接
- ✅ 视频列表获取
- ✅ 存储统计信息
- ✅ 视频上传 (如果有测试文件)
- ✅ 下载链接生成

### 可选测试文件上传

如果要测试上传功能，请在项目根目录放置测试视频文件：

```bash
# 放置测试视频文件
cp your-test-video.mp4 content-distribution/test-video.mp4

# 运行测试
node test-b2-video-management.js

# 测试完成后删除上传的测试文件
node test-b2-video-management.js --delete-test-file
```

## 🔧 技术规格

### 支持的视频格式
- MP4 (推荐)
- AVI
- MOV
- WMV
- FLV
- WebM
- MKV

### 文件限制
- **最大文件大小**: 500MB
- **上传超时**: 30秒
- **下载链接有效期**: 24小时

### 文件组织结构
```
bucket/
└── video/
    ├── 2024/
    │   ├── 01/
    │   │   ├── filename-timestamp-id.mp4
    │   │   └── ...
    │   └── 02/
    └── 2025/
```

## 🚨 故障排除

### 常见问题

1. **B2连接失败**
   - 检查环境变量配置
   - 验证B2 API密钥权限
   - 确认存储桶名称正确

2. **上传失败**
   - 检查文件大小限制 (500MB)
   - 验证文件类型 (仅支持视频)
   - 检查网络连接

3. **页面显示异常**
   - 检查管理员权限
   - 清除浏览器缓存
   - 查看浏览器控制台错误

### 日志查看

应用控制台会显示详细日志：
```
✅ Backblaze B2 (S3 API) 已连接
📹 获取B2视频列表...
🚀 开始上传视频到B2: example.mp4
✅ 视频上传成功: example.mp4
```

## 🔐 安全注意事项

1. **访问控制**: 仅管理员可访问B2视频管理
2. **文件验证**: 严格验证上传文件类型和大小
3. **令牌安全**: 下载链接使用JWT签名，24小时有效
4. **CORS安全**: 自动配置安全的跨域访问策略

## 📞 技术支持

如遇到问题，请查看：
1. 应用控制台日志
2. 浏览器开发者工具
3. 运行测试脚本诊断
4. 检查环境变量配置

## 🎉 成功部署

恭喜！您的B2视频管理系统已成功部署并可以正常使用。系统提供了：

- ✅ 完整的视频文件管理功能
- ✅ 云端存储与本地备份
- ✅ 安全的访问控制
- ✅ 用户友好的管理界面
- ✅ 自动化测试与监控

现在您可以开始使用B2视频管理系统来管理您的视频内容了！ 