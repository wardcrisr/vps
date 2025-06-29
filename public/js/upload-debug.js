// 上传调试脚本 - 确保DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 获取上传按钮（页面中的"选择文件"按钮）
  const btnUpload = document.querySelector('.upload-btn');
  
  if (btnUpload) {
    btnUpload.addEventListener('click', async () => {
      const file = document.querySelector('#fileInput').files[0];
      if (!file) return console.error('NO FILE SELECTED');

      console.log('[DEBUG] start upload', file.name, file.size);
      const fd = new FormData();
      fd.append('files', file); // 注意：服务器期望的字段名是'files'，支持多文件上传

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const json = await res.json();
        console.log('[DEBUG] server resp', json);
      } catch (err) {
        console.error('[DEBUG] fetch failed', err);
      }
    });
  } else {
    console.warn('[DEBUG] Upload button not found');
  }
}); 