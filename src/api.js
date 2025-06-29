import axios from 'axios';

// 创建 axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30 秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一处理错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // 未授权，清除 token 并跳转到登录页
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 视频相关 API
export const videoAPI = {
  // 获取视频列表（管理员）
  getVideos: (params = {}) => {
    return api.get('/admin/videos', { params });
  },

  // 获取单个视频详情（管理员）
  getVideo: (id) => {
    return api.get(`/admin/videos/${id}`);
  },

  // 首页上传功能已删除，请使用管理员后台进行视频上传

  // 更新视频信息（管理员）
  updateVideo: (id, data) => {
    return api.put(`/admin/videos/${id}`, data);
  },

  // 删除视频（管理员）
  deleteVideo: (id) => {
    return api.delete(`/admin/videos/${id}`);
  },

  // 批量操作视频（管理员）
  batchOperateVideos: (action, videoIds, data) => {
    return api.post('/admin/videos/batch', { action, videoIds, data });
  },

  // 搜索视频
  searchVideos: (query) => {
    return api.get('/videos/search', { params: { q: query } });
  },

  // 公开视频列表（前端用户）
  getPublicVideos: (params = {}) => {
    return api.get('/videos', { params });
  },
};

// 用户认证相关 API
export const authAPI = {
  // 登录
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },

  // 注册
  register: (userData) => {
    return api.post('/auth/register', userData);
  },

  // 获取用户信息
  getProfile: () => {
    return api.get('/auth/profile');
  },

  // 更新用户信息
  updateProfile: (data) => {
    return api.put('/auth/profile', data);
  },

  // 退出登录
  logout: () => {
    return api.post('/auth/logout');
  },
};

// 管理员相关 API
export const adminAPI = {
  // 获取用户列表
  getUsers: (params = {}) => {
    return api.get('/admin/users', { params });
  },

  // 更新用户角色
  updateUserRole: (userId, role) => {
    return api.put(`/admin/users/${userId}/role`, { role });
  },

  // 删除用户
  deleteUser: (userId) => {
    return api.delete(`/admin/users/${userId}`);
  },

  // 获取系统统计
  getStats: () => {
    return api.get('/admin/stats');
  },

  // 获取管理员仪表板数据
  getDashboardData: () => {
    return api.get('/admin/dashboard');
  },
};

// B2 视频管理功能已移除

// 便捷的导出方法（向后兼容）
export const getVideos = videoAPI.getVideos;
// createVideo 函数已删除，请使用管理员后台进行视频上传
export const updateVideo = videoAPI.updateVideo;
export const deleteVideo = videoAPI.deleteVideo;

export const login = authAPI.login;
export const register = authAPI.register;
export const getProfile = authAPI.getProfile;

export const logout = authAPI.logout;
export const adminLogin = authAPI.login;
export const getAdminStats = adminAPI.getStats;
export const getAdminDashboard = adminAPI.getDashboardData;

// B2 视频管理功能已移除，相关导出已删除

// 默认导出 api 实例
export default api; 