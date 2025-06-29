import React, { useState, useEffect } from 'react';
import { getVideos, createVideo, updateVideo, deleteVideo } from '../api';

const AdminDashboard = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    file: null
  });

  // 获取视频列表
  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const response = await getVideos();
      setVideos(response.data || []);
    } catch (error) {
      console.error('获取视频列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理表单输入
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理文件选择
  const handleFileChange = (e) => {
    setFormData(prev => ({
      ...prev,
      file: e.target.files[0]
    }));
  };

  // 提交新增视频
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.file) {
      alert('请填写标题并选择文件');
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('files', formData.file);

      await createVideo(formDataToSend);
      alert('视频添加成功！');
      setShowAddForm(false);
      setFormData({ title: '', file: null });
      fetchVideos();
    } catch (error) {
      console.error('添加视频失败:', error);
      alert('添加视频失败，请重试');
    }
  };

  // 删除视频
  const handleDelete = async (videoId) => {
    if (!window.confirm('确定要删除这个视频吗？')) {
      return;
    }

    try {
      await deleteVideo(videoId);
      alert('视频删除成功！');
      fetchVideos();
    } catch (error) {
      console.error('删除视频失败:', error);
      alert('删除视频失败，请重试');
    }
  };

  // 编辑视频
  const handleEdit = (video) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      file: null
    });
  };

  // 更新视频
  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      alert('请填写标题');
      return;
    }

    try {
      const updateData = {
        title: formData.title
      };

      await updateVideo(editingVideo._id, updateData);
      alert('视频更新成功！');
      setEditingVideo(null);
      setFormData({ title: '', file: null });
      fetchVideos();
    } catch (error) {
      console.error('更新视频失败:', error);
      alert('更新视频失败，请重试');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="container-fluid">
        <div className="row">
          {/* 左侧导航菜单 */}
          <div className="col-md-3 col-lg-2 sidebar bg-light min-vh-100 p-0">
            <div className="p-3">
              <h5 className="text-primary">
                <i className="fas fa-tools me-2"></i>
                管理员面板
              </h5>
            </div>
            <nav className="nav flex-column">
              <a 
                className="nav-link active" 
                href="#" 
                onClick={(e) => e.preventDefault()}
              >
                <i className="fas fa-tachometer-alt me-2"></i>
                仪表板
              </a>
              <a 
                className="nav-link" 
                href="/admin/b2-videos"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/admin/b2-videos';
                }}
              >
                <i className="fas fa-cloud me-2"></i>
                B2 视频管理
              </a>
              <a 
                className="nav-link" 
                href="#" 
                onClick={(e) => e.preventDefault()}
              >
                <i className="fas fa-users me-2"></i>
                用户管理
              </a>
              <a 
                className="nav-link" 
                href="#" 
                onClick={(e) => e.preventDefault()}
              >
                <i className="fas fa-chart-bar me-2"></i>
                统计报告
              </a>
              <hr className="sidebar-divider" />
              <a 
                className="nav-link text-danger" 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  if (window.confirm('确定要退出登录吗？')) {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
                    window.location.href = '/';
                  }
                }}
              >
                <i className="fas fa-sign-out-alt me-2"></i>
                退出登录
              </a>
            </nav>
          </div>

          {/* 主内容区域 */}
          <div className="col-md-9 col-lg-10 main-content">
            <div className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>
                  <i className="fas fa-video me-2"></i>
                  本地视频管理
                </h2>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddForm(true)}
                >
                  <i className="fas fa-plus"></i> 新增视频
                </button>
              </div>

              {/* 新增视频表单 */}
              {showAddForm && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h5>新增视频</h5>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <label className="form-label">视频标题</label>
                        <input
                          type="text"
                          className="form-control"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">选择视频文件</label>
                        <input
                          type="file"
                          className="form-control"
                          accept="video/*"
                          onChange={handleFileChange}
                          required
                        />
                      </div>
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-success">
                          <i className="fas fa-save"></i> 保存
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowAddForm(false);
                            setFormData({ title: '', file: null });
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 编辑视频表单 */}
              {editingVideo && (
                <div className="card mb-4">
                  <div className="card-header">
                    <h5>编辑视频</h5>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleUpdate}>
                      <div className="mb-3">
                        <label className="form-label">视频标题</label>
                        <input
                          type="text"
                          className="form-control"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-success">
                          <i className="fas fa-save"></i> 更新
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditingVideo(null);
                            setFormData({ title: '', file: null });
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* 视频列表 */}
              <div className="card">
                <div className="card-header">
                  <h5>视频列表</h5>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">加载中...</span>
                      </div>
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="text-center text-muted">
                      暂无视频数据
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>标题</th>
                            <th>文件名</th>
                            <th>类型</th>
                            <th>大小</th>
                            <th>上传时间</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {videos.map(video => (
                            <tr key={video._id}>
                              <td>{video.title}</td>
                              <td>{video.originalName}</td>
                              <td>
                                <span className={`badge bg-${video.type === 'video' ? 'primary' : 'success'}`}>
                                  {video.type === 'video' ? '视频' : '图片'}
                                </span>
                              </td>
                              <td>{(video.size / 1024 / 1024).toFixed(2)} MB</td>
                              <td>{new Date(video.createdAt).toLocaleString()}</td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-primary"
                                    onClick={() => handleEdit(video)}
                                  >
                                    <i className="fas fa-edit"></i> 编辑
                                  </button>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleDelete(video._id)}
                                  >
                                    <i className="fas fa-trash"></i> 删除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 