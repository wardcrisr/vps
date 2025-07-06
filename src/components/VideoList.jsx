import { useEffect, useState } from 'react';
import { getVideos } from '../api';

export default function VideoList() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    getVideos()
      .then(({ data }) => setVideos(data))
      .catch(console.error);
  }, []);

  return (
    <ul className="list-unstyled row g-4">
      {videos.map(v => (
        <li key={v.guid} className="col-6 col-md-3">
          <img
            src={v.previewUrl}
            alt={v.title}
            className="img-fluid rounded-3"
            style={{ aspectRatio: '16/9', objectFit: 'cover' }}
          />
          <p className="mt-2 text-center">{v.title}</p>
        </li>
      ))}
    </ul>
  );
} 