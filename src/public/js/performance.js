/**
 * 性能优化脚本 - 图片懒加载、预加载和其他优化
 * 优化Google访问fulijix.com的加载速度
 */

// 图片懒加载实现
class LazyImageLoader {
  constructor() {
    this.imageObserver = null;
    this.init();
  }

  init() {
    // 检查浏览器是否支持IntersectionObserver
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            this.loadImage(img);
            observer.unobserve(img);
          }
        });
      }, {
        // 提前200px开始加载
        rootMargin: '200px 0px',
        threshold: 0.01
      });
      
      // 观察所有懒加载图片
      this.observeImages();
    } else {
      // 降级处理：直接加载所有图片
      this.loadAllImages();
    }
  }

  observeImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
      this.imageObserver.observe(img);
    });
  }

  loadImage(img) {
    const src = img.dataset.src;
    if (src) {
      // 创建新的图片对象进行预加载
      const newImg = new Image();
      newImg.onload = () => {
        img.src = src;
        img.classList.add('loaded');
      };
      newImg.onerror = () => {
        // 加载失败时显示占位图
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBoZWlnaHQ9IjIwMiIgdmlld0JveD0iMCAwIDM2MCAyMDIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y5ZjlmOSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTlhYTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfml6Xlh7o8L3RleHQ+PC9zdmc+';
        img.classList.add('error');
      };
      newImg.src = src;
    }
  }

  loadAllImages() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => this.loadImage(img));
  }
}

// 预加载关键资源
class ResourcePreloader {
  constructor() {
    this.preloadQueue = [];
    this.init();
  }

  init() {
    // 预加载首屏可能需要的关键图片
    this.preloadCriticalImages();
    
    // 预取下一页内容
    this.prefetchNextPageContent();
  }

  preloadCriticalImages() {
    // 预加载logo和重要图标
    const criticalImages = [
      'https://fulijix.b-cdn.net/1.png',
      'https://fulijix.b-cdn.net/telegramlogo.png'
    ];

    criticalImages.forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  }

  prefetchNextPageContent() {
    // 当用户滚动到页面底部80%时，预取下一页内容
    let prefetched = false;
    const prefetchThreshold = 0.8;

    const checkScroll = () => {
      if (prefetched) return;
      
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      const scrollPercentage = (scrollTop + windowHeight) / documentHeight;
      
      if (scrollPercentage >= prefetchThreshold) {
        this.prefetchMoreContent();
        prefetched = true;
        window.removeEventListener('scroll', checkScroll);
      }
    };

    window.addEventListener('scroll', checkScroll, { passive: true });
  }

  prefetchMoreContent() {
    // 可以在这里预取更多视频内容或下一页数据
    console.log('🚀 预取下一页内容...');
  }
}

// 性能监控和优化
class PerformanceOptimizer {
  constructor() {
    this.init();
  }

  init() {
    // DOM加载完成后执行优化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.optimize());
    } else {
      this.optimize();
    }
  }

  optimize() {
    // 优化字体加载
    this.optimizeFontLoading();
    
    // 优化图片加载
    this.optimizeImageLoading();
    
    // 延迟加载非关键脚本
    this.deferNonCriticalScripts();
    
    // 监控核心Web指标
    this.monitorWebVitals();
  }

  optimizeFontLoading() {
    // 如果字体还没加载，显示后备字体
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        console.log('✅ 字体加载完成');
      });
    }
  }

  optimizeImageLoading() {
    // 为所有图片添加loading=lazy属性（现代浏览器原生支持）
    const images = document.querySelectorAll('img:not([loading])');
    images.forEach(img => {
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  deferNonCriticalScripts() {
    // 延迟加载非关键的第三方脚本
    setTimeout(() => {
      // 在这里可以加载Analytics等非关键脚本
      console.log('⏳ 延迟加载非关键脚本');
    }, 3000);
  }

  monitorWebVitals() {
    // 监控核心Web指标（如果可用）
    if ('PerformanceObserver' in window) {
      try {
        // 监控Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          console.log('📊 LCP:', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // 监控First Input Delay (FID)
        const fidObserver = new PerformanceObserver(list => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            console.log('📊 FID:', entry.processingStart - entry.startTime);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

      } catch (e) {
        console.log('Performance monitoring not supported');
      }
    }
  }
}

// 初始化所有优化器
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 初始化性能优化...');
  
  new LazyImageLoader();
  new ResourcePreloader();
  new PerformanceOptimizer();
  
  console.log('✅ 性能优化初始化完成');
});

// 导出供其他脚本使用
window.PerformanceUtils = {
  LazyImageLoader,
  ResourcePreloader,
  PerformanceOptimizer
};