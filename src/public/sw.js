/**
 * Service Worker - 缓存策略和离线支持
 * 优化Google访问fulijix.com的加载速度
 */

const CACHE_NAME = 'fulijix-v1.2.0';
const STATIC_CACHE = 'fulijix-static-v1.2.0';
const DYNAMIC_CACHE = 'fulijix-dynamic-v1.2.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/css/main.css',
  '/js/performance.js',
  '/assets/logo-black.jpg',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// 需要网络优先的资源
const NETWORK_FIRST_PATTERNS = [
  /\/api\//,
  /\/video\//,
  /\/space\//,
  /\/user\//
];

// 缓存优先的资源
const CACHE_FIRST_PATTERNS = [
  /\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|otf)$/,
  /fonts\.googleapis\.com/,
  /cdnjs\.cloudflare\.com/,
  /cdn\.jsdelivr\.net/
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  console.log('🔧 Service Worker 安装中...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 缓存静态资源...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker 安装完成');
        // 强制激活新的Service Worker
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Service Worker 安装失败:', error);
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker 激活中...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const deletePromises = cacheNames
          .filter(cacheName => {
            // 删除旧版本的缓存
            return cacheName !== STATIC_CACHE && 
                   cacheName !== DYNAMIC_CACHE &&
                   cacheName.startsWith('fulijix-');
          })
          .map(cacheName => {
            console.log('🗑️ 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('✅ Service Worker 激活完成');
        // 立即控制所有页面
        return self.clients.claim();
      })
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理GET请求
  if (request.method !== 'GET') {
    return;
  }
  
  // 根据不同类型的资源采用不同的缓存策略
  if (isNetworkFirst(url)) {
    event.respondWith(networkFirstStrategy(request));
  } else if (isCacheFirst(url)) {
    event.respondWith(cacheFirstStrategy(request));
  } else {
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// 判断是否是网络优先的资源
function isNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// 判断是否是缓存优先的资源
function isCacheFirst(url) {
  return CACHE_FIRST_PATTERNS.some(pattern => 
    pattern.test(url.pathname + url.search) || pattern.test(url.hostname)
  );
}

// 网络优先策略 - 适用于API请求和动态内容
async function networkFirstStrategy(request) {
  try {
    // 尝试网络请求
    const networkResponse = await fetch(request);
    
    // 如果成功，缓存响应并返回
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      // 只缓存成功的响应
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('🌐 网络请求失败，尝试缓存:', request.url);
    
    // 网络失败，尝试从缓存获取
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果是页面请求，返回离线页面
    if (request.destination === 'document') {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>离线模式 - X福利姬</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f9f9f9; }
            .offline { max-width: 400px; margin: 0 auto; }
            h1 { color: #333; }
            p { color: #666; margin: 20px 0; }
            button { background: #065fd4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="offline">
            <h1>🌐 离线模式</h1>
            <p>当前网络连接不可用，请检查网络设置后重试。</p>
            <button onclick="location.reload()">重新加载</button>
          </div>
        </body>
        </html>
      `, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    throw error;
  }
}

// 缓存优先策略 - 适用于静态资源
async function cacheFirstStrategy(request) {
  // 先从缓存查找
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // 缓存未命中，请求网络
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ 缓存优先策略失败:', request.url);
    throw error;
  }
}

// 过期重新验证策略 - 适用于一般内容
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  // 后台更新缓存
  const fetchPromise = fetch(request)
    .then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(error => {
      console.log('🔄 后台更新失败:', request.url);
      return null;
    });
  
  // 返回缓存的响应（如果有）或等待网络响应
  return cachedResponse || fetchPromise;
}

// 监听消息事件
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// 定期清理缓存
self.addEventListener('periodicsync', event => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupOldCache());
  }
});

// 清理过期缓存
async function cleanupOldCache() {
  const cache = await caches.open(DYNAMIC_CACHE);
  const requests = await cache.keys();
  
  // 删除超过一周的缓存项
  const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const deletePromises = requests
    .filter(request => {
      // 这里可以根据需要实现更复杂的过期逻辑
      return false; // 简化实现，不删除任何缓存
    })
    .map(request => cache.delete(request));
  
  await Promise.all(deletePromises);
  console.log('🧹 缓存清理完成');
}