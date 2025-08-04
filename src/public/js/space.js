// UP主空间页JavaScript逻辑
const SpacePage = {
  currentPage: 1,
  totalPages: 1,
  currentSort: 'newest',
  uid: '',
  loading: false,

  init() {
    // 从页面获取配置
    this.uid = this.getUidFromUrl();
    this.currentPage = this.getCurrentPageFromUrl();
    this.currentSort = this.getCurrentSortFromUrl();
    
    this.bindTabEvents();
    this.bindPaginationEvents();
    this.bindLoadMoreEvents();

    // 首次渲染也应用预览动画（初始SSR视频）
    this.applyPreviewAnimation();
  },

  // 从URL获取UID
  getUidFromUrl() {
    const path = window.location.pathname;
    const matches = path.match(/\/space\/([^\/]+)/);
    return matches ? matches[1] : '';
  },

  // 从URL获取当前页码
  getCurrentPageFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('page')) || 1;
  },

  // 从URL或DOM获取当前排序
  getCurrentSortFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlSort = urlParams.get('sort');
    if (urlSort) return urlSort;
    
    // 从DOM中的active标签获取
    const activeTab = document.querySelector('.category-chip.active');
    if (activeTab && activeTab.dataset.sort) {
      return activeTab.dataset.sort;
    }
    
    return 'newest';
  },

  // 绑定标签页切换事件
  bindTabEvents() {
    const tabs = document.querySelectorAll('.category-chip');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const sort = tab.dataset.sort;
        this.switchTab(sort);
      });
    });
  },

  // 切换标签页
  async switchTab(sort) {
    if (this.loading || this.currentSort === sort) return;
    
    this.currentSort = sort;
    this.currentPage = 1;
    
    // 更新标签页样式
    document.querySelectorAll('.category-chip').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-sort="${sort}"]`).classList.add('active');
    
    // 更新URL
    const url = new URL(window.location);
    url.searchParams.set('sort', sort);
    url.searchParams.set('page', '1');
    window.history.pushState({}, '', url);
    
    // 加载视频
    await this.loadVideos(1, sort, true);
  },

  // 加载视频列表
  async loadVideos(page, sort, replace = false) {
    this.loading = true;
    
    // 显示加载状态
    this.showLoading();
    
    try {
      const response = await axios.get(`/space/${this.uid}/videos`, {
        params: { page: page || this.currentPage, sort: sort || this.currentSort, limit: 12 }
      });

      if (response.data.success) {
        const { videos, pagination } = response.data.data;
        this.updateVideoGrid(videos, replace);
        this.updatePagination(pagination);
        this.totalPages = pagination.total;
        this.currentPage = pagination.current;
      }
    } catch (error) {
      console.error('加载视频失败:', error);
      this.showError('加载视频失败，请重试');
    } finally {
      this.loading = false;
      this.hideLoading();
    }
  },

  // 更新视频网格
  updateVideoGrid(videos, replace = false) {
    const grid = document.getElementById('video-grid');
    
    if (replace) {
      grid.innerHTML = '';
    }
    
    videos.forEach(video => {
      const videoCard = this.createVideoCard(video);
      grid.appendChild(videoCard);
    });

    // 应用预览动画
    this.applyPreviewAnimation();
  },

  // 预览动画替换（与首页逻辑保持一致）
  applyPreviewAnimation() {
    document.querySelectorAll('.video-card').forEach(card => {
      const videoData = card.__data__ || {};

      const img = card.querySelector('.video-thumbnail img');
      if (!img) return;

      // 优先使用传入数据，其次读取DOM data属性
      let p = (videoData && (videoData.previewUrl || videoData.previewImage)) || card.dataset.previewUrl || card.querySelector('.video-thumbnail').dataset.preview;

      // 若仍为空则跳过
      if (!p) return;

      if (/\.(mp4|webm)$/i.test(p)) {
        const v = document.createElement('video');
        v.src = p;
        v.muted = true;
        v.loop = true;
        v.autoplay = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        v.setAttribute('muted', '');
        v.style.width = '100%';
        v.style.height = '100%';
        v.style.objectFit = 'contain';
        v.style.background = 'transparent';
        v.style.backgroundColor = 'transparent';
        img.replaceWith(v);
      } else {
        img.src = p;
      }
    });
  },

  // 创建视频卡片
  createVideoCard(video) {
    const div = document.createElement('div');
    div.className = 'video-card';
    
    // 获取上传者信息
    const uploader = video.uploader || video.uploaderInfo || video.up || {};
    const uploaderUid = uploader.uid || uploader._id || this.uid;
    const uploaderName = uploader.name || uploader.displayName || uploader.username || '匿名用户';
          // 头像功能已删除
    
    // 选择最佳封面/预览源（优先previewImage）
    const previewSrc = video.previewImage || video.coverUrl || video.thumbnail || '/api/placeholder/video-thumbnail';

    // 设置data-preview属性供后续动画脚本使用
    const previewDataAttr = video.previewUrl ? `data-preview="${video.previewUrl}"` : '';
    
    div.innerHTML = `
      <div class="video-thumbnail" ${previewDataAttr} onclick="location.href='/video/${video._id}'">
        <img src="${previewSrc}" 
             alt="${this.escapeHtml(video.title)}" loading="lazy">
        <div class="video-duration">${this.formatDuration(video.duration)}</div>
        ${(video.isPremiumOnly || video.category === 'member') ? '<div class="premium-badge">会员</div>' : (video.category === 'paid' ? '<div class="premium-badge">付费</div>' : '<div class="free-badge">免费</div>')}
      </div>
      <div class="video-info">
        <h4 class="video-title" title="${this.escapeHtml(video.title)}" onclick="location.href='/video/${video._id}'" style="cursor: pointer;">
          ${this.escapeHtml(video.title)}
        </h4>
                  <div class="uploader-info" onclick="event.stopPropagation(); location.href='/space/${uploaderUid}'" style="cursor: pointer; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${uploader.uploaderAvatarUrl ? `<img src="${uploader.uploaderAvatarUrl}" alt="${uploaderName}" style=\"width:48px;height:48px;border-radius:50%;object-fit:cover;\">` : '<span style="font-size:14px;">👤</span>'} <span style="color: #666; font-size: 0.8rem; font-weight: 500;">${uploaderName}</span>
            </div>
          </div>
        <div class="video-stats">
          <span class="views">${this.formatNumber(video.views)} 播放</span>
          <span class="danmaku">${this.formatNumber(video.danmakuCount)} 弹幕</span>
          <span class="date">${this.formatDate(video.createdAt)}</span>
        </div>
      </div>
    `;

    // 保存原始数据，用于后续预览替换
    div.__data__ = video;
    
    return div;
  },

  // 绑定分页事件
  bindPaginationEvents() {
    document.addEventListener('click', (e) => {
      // 通过冒泡捕获任何带.page-link 类的祖先
      const link = e.target.closest('.page-link');
      if (link && link.dataset.page) {
        e.preventDefault();
        const page = parseInt(link.dataset.page);
        if (page && page !== this.currentPage) {
          this.loadVideos(page, this.currentSort, true);
          
          // 更新 URL 查询参数
          const url = new URL(window.location);
          url.searchParams.set('page', page.toString());
          window.history.pushState({}, '', url);
          
          // 滚动到顶部
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    });
  },

  // 绑定加载更多事件
  bindLoadMoreEvents() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.loadVideos(this.currentPage + 1, this.currentSort, false);
        }
      });
    }
  },

  // 更新分页信息
  updatePagination(pagination) {
    // 这里可以动态更新分页组件，现在先保持简单
    console.log('Pagination updated:', pagination);
  },

  // 显示加载状态
  showLoading() {
    const container = document.getElementById('videos-container');
    if (container) {
      container.classList.add('loading');
    }
  },

  // 隐藏加载状态
  hideLoading() {
    const container = document.getElementById('videos-container');
    if (container) {
      container.classList.remove('loading');
    }
  },

  // 显示错误信息
  showError(message) {
    // 简单的错误提示，可以后续改为更好看的组件
    alert(message);
  },

  // 工具函数
  formatDuration(seconds) {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toString();
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 30) return `${days}天前`;
    
    return date.toLocaleDateString('zh-CN');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  SpacePage.init();
}); 