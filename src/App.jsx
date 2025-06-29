import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import AdminDashboard from './pages/AdminDashboard';
import B2VideoManager from './pages/B2VideoManager';
import { getProfile } from './api';

// 权限路由组件
const ProtectedRoute = ({ children, requiredRole, user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查用户认证状态
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await getProfile();
          setUser(response.data);
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Header user={user} />
        
        <Routes>
          {/* 管理员路由 */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin" user={user}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* B2 视频管理路由 */}
          <Route 
            path="/admin/b2-videos" 
            element={
              <ProtectedRoute requiredRole="admin" user={user}>
                <B2VideoManager />
              </ProtectedRoute>
            } 
          />
          
          {/* 其他路由可以在这里添加 */}
          <Route path="/" element={<div className="container mt-4"><h1>欢迎来到 X福利姬</h1></div>} />
          <Route path="/login" element={<div className="container mt-4"><h1>登录页面</h1></div>} />
          <Route path="/register" element={<div className="container mt-4"><h1>注册页面</h1></div>} />
          
          {/* 404 页面 */}
          <Route path="*" element={<div className="container mt-4"><h1>页面未找到</h1></div>} />
        </Routes>
      </div>
    </Router>
  );
};

export default App; 