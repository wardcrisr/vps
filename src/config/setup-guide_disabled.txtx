# Backblaze B2 + Cloudflare CDN 配置指南

## 🔧 系统架构

```
上传流程: 用户 → Express → 本地临时存储 → Backblaze B2 → 删除本地文件
下载流程: 用户 → 权限验证 → 生成签名令牌 → Cloudflare CDN → Backblaze B2
```

## 📋 配置步骤

### 1. Backblaze B2 配置

1. **创建账户**: 访问 [backblaze.com](https://www.backblaze.com/b2/cloud-storage.html)
2. **创建Bucket**:
   - 登录B2控制台
   - 点击"Create a Bucket"
   - 设置为"Private"（重要！）
   - 记录Bucket名称和ID

3. **生成应用密钥**:
   - 进入"App Keys"页面
   - 点击"Add a New Application Key"
   - 选择刚创建的Bucket
   - 记录`keyID`和`applicationKey`

### 2. Cloudflare CDN 配置

1. **域名解析**:
   - 将您的域名添加到Cloudflare
   - 设置DNS记录指向B2 Bucket的友好URL

2. **缓存规则**:
   ```
   - 图片文件: 缓存7天
   - 视频文件: 缓存30天
   - 私有文件: 不缓存
   ```

3. **安全设置**:
   - 启用"Always Use HTTPS"
   - 配置访问令牌验证

### 3. 环境变量配置

创建 `.env` 文件:

```env
# Backblaze B2
B2_APPLICATION_KEY_ID=your_key_id_here
B2_APPLICATION_KEY=your_application_key_here
B2_BUCKET_NAME=your-bucket-name
B2_BUCKET_ID=your_bucket_id_here

# Cloudflare CDN
CDN_BASE_URL=https://your-domain.com
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token

# 其他配置
JWT_SECRET=your-super-secret-jwt-key
MONGO_URI=mongodb://127.0.0.1:27017/contentdb
```

## 🚀 部署说明

### 安装依赖

```bash
npm install
```

### 启动应用

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

## 💰 付费系统说明

### 用户类型
- **免费用户**: 每日5次下载，只能下载图片
- **VIP用户**: 无限下载，可下载所有内容

### 下载限制
- 图片: 免费用户可下载
- 视频: 仅VIP用户可下载
- 每日限制: 免费用户5次，VIP无限制

### 安全机制
- JWT签名下载令牌
- 24小时链接有效期
- 用户权限验证
- 下载统计记录

## 🔒 安全特性

1. **文件访问控制**:
   - 私有B2 Bucket
   - 签名下载URL
   - 时限访问令牌

2. **用户权限验证**:
   - JWT身份验证
   - 下载次数限制
   - VIP状态检查

3. **防滥用机制**:
   - 每日下载限制
   - 文件大小限制
   - 上传类型验证

## 📊 监控和统计

系统自动记录：
- 文件上传/下载次数
- 用户活跃度
- 存储使用量
- CDN流量统计

## 🔧 故障排除

### 常见问题

1. **B2上传失败**:
   - 检查API密钥是否正确
   - 确认Bucket权限设置
   - 查看文件大小限制

2. **CDN不工作**:
   - 检查域名DNS设置
   - 确认Cloudflare缓存规则
   - 验证SSL证书状态

3. **下载失败**:
   - 检查用户权限
   - 确认令牌未过期
   - 验证B2文件存在

## 💡 优化建议

1. **性能优化**:
   - 启用Cloudflare压缩
   - 配置适当的缓存策略
   - 使用WebP格式图片

2. **成本优化**:
   - 设置B2生命周期规则
   - 监控流量使用
   - 定期清理未使用文件

3. **用户体验**:
   - 添加上传进度条
   - 实现断点续传
   - 提供下载历史记录 