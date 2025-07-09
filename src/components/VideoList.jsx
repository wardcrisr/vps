import { useEffect, useState } from 'react';
import { getVideos } from '../api';
import socket from '../utils/socket';

export default function VideoList() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    getVideos()
      .then(({ data }) => setVideos(data))
      .catch(console.error);

    // 监听后台推送的视频时长更新
    socket.on('video-duration-updated', ({ videoId, lengthInSeconds }) => {
      setVideos(prev => prev.map(v => {
        if (v.guid === videoId || v.bunnyId === videoId) {
          return { ...v, duration: lengthInSeconds };
        }
        return v;
      }));
    });

    return () => {
      socket.off('video-duration-updated');
    };
  }, []);

  // 工具函数: 将秒格式化为 mm:ss
  const formatDuration = (sec = 0) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <ul className="list-unstyled row g-4">
      {videos.map(v => (
        <li key={v.guid} className="col-6 col-md-3 position-relative">
          <img
            src={v.previewUrl}
            alt={v.title}
            className="img-fluid rounded-3"
            style={{ aspectRatio: '16/9', objectFit: 'cover' }}
          />
          {/* 时长显示 */}
          {v.duration ? (
            <span className="position-absolute bottom-0 end-0 bg-dark text-white px-1 small rounded-1 me-1 mb-1" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
              {formatDuration(v.duration)}
            </span>
          ) : null}
          <p className="mt-2 text-center">{v.title}</p>
        </li>
      ))}
    </ul>
  );
} 