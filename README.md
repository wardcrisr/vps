# 视频解锁播放系统

## 环境准备

1. **Node.js 18+**
2. **MongoDB 5+**
3. 在项目根目录创建 `.env` 并填写下列变量：

```
BUNNY_SECRET=YOUR_BUNNY_EMBEDVIEW_TOKEN_SECRET
LIB_ID=YOUR_BUNNY_VIDEO_LIBRARY_ID
MONGO_URI=mongodb://127.0.0.1:27017/contentdb
JWT_SECRET=please_change_this
PORT=3000
```

## 安装依赖

```
npm install
```

## 启动

```
npm start
```

服务器启动后访问 `http://localhost:3000`。

## 试看 ➜ 金币解锁 ➜ 播放

1. **试看**：客户端先嵌入公开预告片 iframe。
2. **解锁**：用户点击按钮后向 `POST /api/unlock/:videoId` 发送请求；可在 body 里传 `hoursValid` 指定观看时长（默认 72h）。
3. **后端逻辑**
   - 在事务内扣除用户金币、写入/更新 `purchases`。
   - 生成 Bunny Stream EmbedView Token，并返回完整 iframe URL。
4. **播放**：前端收到 `{ iframe }`，替换播放器 HTML。

## 常见问题

| 错误码 | 含义 |
|--------|------|
| 401    | 未登录或 Token 失效 |
| 402    | 金币不足 |
| 404    | 视频不存在 |
| 409    | 高并发写冲突，建议前端稍后重试 |

## 日志排查

在生产环境请确保记录下原始签名字符串 `BUNNY_SECRET + bunnyId + expires`，以便排查 403 播放失败问题。

## 新增：实时用户信息 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | /api/user/profile | 返回当前登录用户完整信息，禁止缓存 |

前端示例：
```js
const res = await fetch('/api/user/profile', { credentials: 'include' });
const { data } = await res.json();
console.log(data.coins);
```

## 调试"我的余额"
1. 在 Atlas 控制台手动修改某用户的 `coins` 值。
2. 浏览器重新打开/刷新 `/user/coin` 页面。
3. 页面将通过 AJAX 调用 `/api/user/profile` 并实时显示最新余额，无需手动清缓存或硬刷新。 