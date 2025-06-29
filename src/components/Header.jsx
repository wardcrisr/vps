import React from 'react';

const Header = ({ user }) => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/';
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
      <div className="container-fluid">
        <a className="navbar-brand" href="/">
          <i className="fas fa-video me-2"></i>
          X福利姬
        </a>
        
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <a className="nav-link" href="/">
                <i className="fas fa-home me-1"></i>
                首页
              </a>
            </li>
            {user && user.role === 'admin' && (
              <li className="nav-item dropdown">
                <a 
                  className="nav-link dropdown-toggle" 
                  href="#" 
                  role="button" 
                  data-bs-toggle="dropdown"
                >
                  <i className="fas fa-cog me-1"></i>
                  管理员
                </a>
                <ul className="dropdown-menu">
                  <li>
                    <a className="dropdown-item" href="/admin">
                      <i className="fas fa-tachometer-alt me-2"></i>
                      管理面板
                    </a>
                  </li>
                  <li>
                    <a className="dropdown-item" href="/admin/b2-videos">
                      <i className="fas fa-cloud me-2"></i>
                      B2 视频管理
                    </a>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <a className="dropdown-item" href="/admin/users">
                      <i className="fas fa-users me-2"></i>
                      用户管理
                    </a>
                  </li>
                </ul>
              </li>
            )}
          </ul>
          
          <ul className="navbar-nav">
            {user ? (
              <li className="nav-item dropdown">
                <a 
                  className="nav-link dropdown-toggle" 
                  href="#" 
                  role="button" 
                  data-bs-toggle="dropdown"
                >
                  <i className="fas fa-user me-1"></i>
                  {user.username || user.email}
                  {user.role === 'admin' && (
                    <span className="badge bg-warning text-dark ms-1">管理员</span>
                  )}
                </a>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <a className="dropdown-item" href="/profile">
                      <i className="fas fa-user-edit me-2"></i>
                      个人设置
                    </a>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item" onClick={handleLogout}>
                      <i className="fas fa-sign-out-alt me-2"></i>
                      退出登录
                    </button>
                  </li>
                </ul>
              </li>
            ) : (
              <>
                <li className="nav-item">
                  <a className="nav-link" href="/login">
                    <i className="fas fa-sign-in-alt me-1"></i>
                    登录
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="/register">
                    <i className="fas fa-user-plus me-1"></i>
                    注册
                  </a>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Header; 