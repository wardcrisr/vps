import AdminDashboard from './pages/AdminDashboard';
import B2VideoManager from './pages/B2VideoManager';

// 路由配置
const routes = [
  {
    path: '/',
    component: 'Home',
    auth: false
  },
  {
    path: '/videos',
    component: 'VideoList',
    auth: false
  },
  {
    path: '/category',
    component: 'Category',
    auth: false
  },
  {
    path: '/login',
    component: 'Login',
    auth: false
  },
  {
    path: '/register',
    component: 'Register',
    auth: false
  },
  {
    path: '/profile',
    component: 'Profile',
    auth: 'user'
  },
  {
    path: '/settings',
    component: 'Settings',
    auth: 'user'
  },
  {
    path: '/admin',
    component: AdminDashboard,
    auth: 'admin'
  },
  {
    path: '/admin/b2-videos',
    component: B2VideoManager,
    auth: 'admin'
  }
];

export default routes; 