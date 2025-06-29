import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { getB2Videos, uploadB2Video, deleteB2Video, getB2StorageStats } from '../api';

const B2VideoManager = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [storageStats, setStorageStats] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: ''
  });
  
  const fileInputRef = useRef(null);
  const uploadXhrRef = useRef(null);

  // 获取 B2 视频列表
  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await getB2Videos();
      if (response.data.success) {
        setVideos(response.data.data.videos);
        toast.success(`获取到 ${response.data.data.videos.length} 个B2视频文件`);
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('获取B2视频列表失败:', error);
      toast.error('获取视频列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取存储统计信息
  const fetchStorageStats = async () => {
    try {
      const response = await getB2StorageStats();
      if (response.data.success) {
        setStorageStats(response.data.data);
      }
    } catch (error) {
      console.error('获取存储统计失败:', error);
    }
  };

  // 文件选择处理
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('video/')) {
      toast.error('请选择视频文件！');
      return;
    }

    // 验证文件大小（500MB 限制）
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('文件过大！最大支持500MB');
      return;
    }

    setSelectedFile(file);
    
    // 自动设置标题为文件名（去除扩展名）
    if (!uploadForm.title) {
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setUploadForm(prev => ({ ...prev, title: fileName }));
    }
  };

  // 上传视频到 B2
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('请先选择视频文件！');
      return;
    }

    if (!uploadForm.title.trim()) {
      toast.error('请输入视频标题！');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', uploadForm.title.trim());
    formData.append('description', uploadForm.description.trim());

    try {
      const response = await uploadB2Video(formData, (progress) => {
        setUploadProgress(progress);
      });

      if (response.data.success) {
        toast.success('视频上传成功！');
        
        // 重置表单
        setSelectedFile(null);
        setUploadForm({ title: '', description: '' });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // 刷新列表和统计
        fetchVideos();
        fetchStorageStats();
      } else {
        throw new Error(response.data.message);
      }

    } catch (error) {
      console.error('上传失败:', error);
      toast.error('上传失败: ' + error.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 取消上传
  const handleCancelUpload = () => {
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
      setUploading(false);
      setUploadProgress(0);
      toast.info('上传已取消');
    }
  };

  // 删除视频
  const handleDeleteVideo = async (video) => {
    if (!window.confirm(`确定要删除视频 "${video.displayName}" 吗？\n\n注意：这将从B2存储中永久删除该文件！`)) {
      return;
    }

    try {
      const response = await deleteB2Video(video.fileName);
      if (response.data.success) {
        toast.success('视频删除成功！');
        fetchVideos();
        fetchStorageStats();
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      console.error('删除视频失败:', error);
      toast.error('删除失败: ' + error.message);
    }
  };

  // 复制下载链接
  const handleCopyDownloadUrl = async (video) => {
    try {
      await navigator.clipboard.writeText(video.downloadUrl);
      toast.success('下载链接已复制到剪贴板！');
    } catch (error) {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = video.downloadUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('下载链接已复制到剪贴板！');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化日期
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  useEffect(() => {
    fetchVideos();
    fetchStorageStats();
  }, []);

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h4 className="mb-0">
                <i className="fas fa-cloud me-2"></i>
                B2 视频管理
              </h4>
            </div>
            <div className="card-body">
              
              {/* 存储统计信息 */}
              {storageStats && (
                <div className="row mb-4">
                  <div className="col-md-3">
                    <div className="card bg-info text-white">
                      <div className="card-body text-center">
                        <h5 className="card-title">
                          <i className="fas fa-database me-2"></i>
                          存储状态
                        </h5>
                        <p className="card-text">
                          {storageStats.connected ? '✅ 已连接' : '❌ 断开'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-success text-white">
                      <div className="card-body text-center">
                        <h5 className="card-title">
                          <i className="fas fa-film me-2"></i>
                          视频总数
                        </h5>
                        <p className="card-text fs-4">{storageStats.totalVideos}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-warning text-white">
                      <div className="card-body text-center">
                        <h5 className="card-title">
                          <i className="fas fa-hdd me-2"></i>
                          存储用量
                        </h5>
                        <p className="card-text fs-6">{storageStats.totalSizeGB} GB</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="card bg-secondary text-white">
                      <div className="card-body text-center">
                        <h5 className="card-title">
                          <i className="fas fa-server me-2"></i>
                          存储桶
                        </h5>
                        <p className="card-text fs-6">{storageStats.bucketName}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 视频上传区域 */}
              <div className="card mb-4">
                <div className="card-header">
                  <h5 className="mb-0">
                    <i className="fas fa-upload me-2"></i>
                    上传视频到 B2 存储
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">选择视频文件 (最大500MB)</label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="form-control"
                          accept="video/*"
                          onChange={handleFileSelect}
                          disabled={uploading}
                        />
                        {selectedFile && (
                          <div className="mt-2">
                            <small className="text-muted">
                              已选择: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                            </small>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">视频标题 *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={uploadForm.title}
                          onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                          disabled={uploading}
                          placeholder="输入视频标题"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label">视频描述</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                      disabled={uploading}
                      placeholder="输入视频描述（可选）"
                    />
                  </div>

                  {/* 上传进度 */}
                  {uploading && (
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted">上传进度</small>
                        <small className="text-muted">{uploadProgress}%</small>
                      </div>
                      <div className="progress">
                        <div
                          className="progress-bar progress-bar-striped progress-bar-animated"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading || !uploadForm.title.trim()}
                    >
                      {uploading ? (
                        <>
                          <i className="fas fa-spinner fa-spin me-2"></i>
                          上传中...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-cloud-upload-alt me-2"></i>
                          上传到 B2
                        </>
                      )}
                    </button>
                    
                    {uploading && (
                      <button
                        className="btn btn-outline-danger"
                        onClick={handleCancelUpload}
                      >
                        <i className="fas fa-times me-2"></i>
                        取消上传
                      </button>
                    )}
                    
                    <button
                      className="btn btn-outline-secondary"
                      onClick={fetchVideos}
                      disabled={loading}
                    >
                      <i className="fas fa-sync-alt me-2"></i>
                      刷新列表
                    </button>
                  </div>
                </div>
              </div>

              {/* 视频列表 */}
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="fas fa-list me-2"></i>
                    B2 存储中的视频文件
                  </h5>
                  <span className="badge bg-primary">{videos.length} 个文件</span>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center py-4">
                      <i className="fas fa-spinner fa-spin fa-2x text-primary"></i>
                      <p className="mt-2">加载中...</p>
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="text-center py-4">
                      <i className="fas fa-inbox fa-3x text-muted"></i>
                      <p className="mt-2 text-muted">B2 存储中还没有视频文件</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead className="table-light">
                          <tr>
                            <th>文件名</th>
                            <th>大小</th>
                            <th>上传时间</th>
                            <th>下载链接</th>
                            <th width="200">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {videos.map((video) => (
                            <tr key={video.id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <i className="fas fa-play-circle text-primary me-2"></i>
                                  <div>
                                    <div className="fw-bold">{video.displayName}</div>
                                    <small className="text-muted">{video.fileName}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{formatFileSize(video.size)}</td>
                              <td>
                                <small>{formatDate(video.lastModified)}</small>
                              </td>
                              <td>
                                <small className="text-break">
                                  <a
                                    href={video.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-decoration-none"
                                  >
                                    {video.downloadUrl.length > 50
                                      ? video.downloadUrl.substring(0, 50) + '...'
                                      : video.downloadUrl
                                    }
                                  </a>
                                </small>
                              </td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-primary"
                                    onClick={() => handleCopyDownloadUrl(video)}
                                    title="复制下载链接"
                                  >
                                    <i className="fas fa-copy"></i>
                                  </button>
                                  <a
                                    href={video.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline-success"
                                    title="打开视频"
                                  >
                                    <i className="fas fa-external-link-alt"></i>
                                  </a>
                                  <button
                                    className="btn btn-outline-danger"
                                    onClick={() => handleDeleteVideo(video)}
                                    title="删除视频"
                                  >
                                    <i className="fas fa-trash"></i>
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

export default B2VideoManager; 