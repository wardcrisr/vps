/**
 * 浏览器直传B2对象存储 - 前端上传库
 * 支持20MB分片上传、断点续传、进度显示
 */
class DirectUploader {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api/direct-upload';
    this.chunkSize = options.chunkSize || 20 * 1024 * 1024; // 20MB
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.concurrency = options.concurrency || 3; // 并发上传数量
    
    // 事件回调
    this.onProgress = options.onProgress || (() => {});
    this.onSuccess = options.onSuccess || (() => {});
    this.onError = options.onError || (() => {});
    this.onChunkSuccess = options.onChunkSuccess || (() => {});
    this.onChunkError = options.onChunkError || (() => {});
    
    // 内部状态
    this.isUploading = false;
    this.isPaused = false;
    this.uploadedParts = new Map(); // 存储已上传的分片信息，用于断点续传
    this.currentUpload = null;
  }

  /**
   * 开始上传文件
   * @param {File} file - 要上传的文件
   * @param {Object} options - 上传选项
   */
  async upload(file, options = {}) {
    if (this.isUploading) {
      throw new Error('已有文件正在上传中');
    }

    try {
      this.isUploading = true;
      this.isPaused = false;
      this.uploadedParts.clear();
      
      console.log(`[DirectUpload] 开始上传: ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)`);
      
      // 1. 创建多段上传任务
      const createResult = await this.createUpload(file, options);
      
      if (!createResult.success) {
        throw new Error(createResult.message || '创建上传任务失败');
      }

      this.currentUpload = createResult;
      console.log(`[DirectUpload] 创建上传任务成功: ${createResult.totalParts} 个分片`);

      // 2. 并发上传所有分片
      const uploadResults = await this.uploadParts(file, createResult);
      
      // 3. 完成多段上传
      const completeResult = await this.completeUpload(file, createResult, uploadResults);
      
      console.log(`[DirectUpload] 上传完成: ${file.name}`);
      this.onSuccess(completeResult);
      
      return completeResult;
      
    } catch (error) {
      console.error('[DirectUpload] 上传失败:', error);
      
      // 清理失败的上传
      if (this.currentUpload) {
        await this.abortUpload(this.currentUpload.uploadId, this.currentUpload.fileName);
      }
      
      this.onError(error);
      throw error;
      
    } finally {
      this.isUploading = false;
      this.currentUpload = null;
    }
  }

  /**
   * 暂停上传
   */
  pause() {
    this.isPaused = true;
    console.log('[DirectUpload] 上传已暂停');
  }

  /**
   * 恢复上传
   */
  resume() {
    this.isPaused = false;
    console.log('[DirectUpload] 上传已恢复');
  }

  /**
   * 取消上传
   */
  async cancel() {
    this.isPaused = true;
    
    if (this.currentUpload) {
      await this.abortUpload(this.currentUpload.uploadId, this.currentUpload.fileName);
      this.currentUpload = null;
    }
    
    this.isUploading = false;
    console.log('[DirectUpload] 上传已取消');
  }

  /**
   * 创建多段上传任务
   */
  async createUpload(file, options) {
    const requestBody = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      chunkSize: this.chunkSize,
      ...options
    };

    const response = await this.fetchWithTimeout(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 30000); // 30秒超时

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 支持超时的fetch请求
   */
  async fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout/1000}秒)`);
      }
      throw error;
    }
  }

  /**
   * 并发上传所有分片
   */
  async uploadParts(file, uploadInfo) {
    const { uploadUrls, totalParts } = uploadInfo;
    const results = [];
    const activeUploads = new Map();
    
    // 创建分片上传任务队列
    const uploadTasks = uploadUrls.map((urlInfo, index) => ({
      partNumber: urlInfo.partNumber,
      url: urlInfo.url,
      start: index * this.chunkSize,
      end: Math.min((index + 1) * this.chunkSize, file.size),
      retries: 0
    }));

    // 并发控制
    let completedCount = 0;
    let nextIndex = 0;

    const uploadNext = async () => {
      if (nextIndex >= uploadTasks.length) return;
      
      const task = uploadTasks[nextIndex++];
      const taskId = `part-${task.partNumber}`;
      
      try {
        // 检查是否暂停
        while (this.isPaused && this.isUploading) {
          await this.sleep(100);
        }
        
        if (!this.isUploading) return; // 已取消
        
        activeUploads.set(taskId, task);
        
        const result = await this.uploadSinglePart(file, task);
        results.push(result);
        
        // 记录成功上传的分片（用于断点续传）
        this.uploadedParts.set(task.partNumber, result);
        
        completedCount++;
        this.updateProgress(completedCount, totalParts, '上传中...');
        this.onChunkSuccess(result, completedCount, totalParts);
        
        console.log(`[DirectUpload] 分片 ${task.partNumber}/${totalParts} 上传成功`);
        
      } catch (error) {
        console.error(`[DirectUpload] 分片 ${task.partNumber} 上传失败:`, error);
        
        // 重试逻辑
        if (task.retries < this.maxRetries) {
          task.retries++;
          nextIndex--; // 回退索引，重新尝试
          await this.sleep(this.retryDelay * task.retries);
          console.log(`[DirectUpload] 重试分片 ${task.partNumber} (第${task.retries}次)`);
        } else {
          this.onChunkError(error, task.partNumber, totalParts);
          throw new Error(`分片 ${task.partNumber} 上传失败: ${error.message}`);
        }
        
      } finally {
        activeUploads.delete(taskId);
      }
      
      // 继续上传下一个
      if (nextIndex < uploadTasks.length) {
        await uploadNext();
      }
    };

    // 启动并发上传
    const concurrentPromises = [];
    for (let i = 0; i < Math.min(this.concurrency, uploadTasks.length); i++) {
      concurrentPromises.push(uploadNext());
    }
    
    await Promise.all(concurrentPromises);
    
    // 按分片编号排序结果
    results.sort((a, b) => a.PartNumber - b.PartNumber);
    
    return results;
  }

  /**
   * 上传单个分片
   */
  async uploadSinglePart(file, task) {
    const { partNumber, url, start, end } = task;
    const chunk = file.slice(start, end);
    
    console.log(`[DirectUpload] 上传分片 ${partNumber}: ${(chunk.size/1024/1024).toFixed(1)}MB`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
        body: chunk,
        headers: {
          'Content-Type': 'application/octet-stream' // B2要求使用通用类型
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`分片上传失败 (${response.status}): ${errorText}`);
      }

      // 获取ETag
      const etag = response.headers.get('ETag');
      if (!etag) {
        throw new Error('响应中缺少ETag');
      }

      return {
        PartNumber: partNumber,
        ETag: etag.replace(/"/g, '') // 移除引号
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`分片 ${partNumber} 上传超时`);
      }
      throw error;
    }
  }

  /**
   * 完成多段上传
   */
  async completeUpload(file, uploadInfo, parts) {
    const requestBody = {
      uploadId: uploadInfo.uploadId,
      fileName: uploadInfo.fileName,
      parts: parts,
      originalName: file.name,
      fileSize: file.size,
      mimeType: file.type
    };

    const response = await this.fetchWithTimeout(`${this.baseUrl}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 60000); // 60秒超时

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Network error' }));
      throw new Error(errorData.message || `完成上传失败: HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 取消多段上传
   */
  async abortUpload(uploadId, fileName) {
    try {
      const response = await fetch(`${this.baseUrl}/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId: uploadId,
          fileName: fileName
        })
      });

      return await response.json();
    } catch (error) {
      console.error('[DirectUpload] 取消上传失败:', error);
    }
  }

  /**
   * 更新进度
   */
  updateProgress(current, total, status) {
    const percent = Math.round((current / total) * 100);
    this.onProgress({
      percent: percent,
      current: current,
      total: total,
      status: status
    });
  }

  /**
   * 休眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取下载链接
   */
  async getDownloadUrl(fileName) {
    try {
      const response = await fetch(`${this.baseUrl}/download/${encodeURIComponent(fileName)}`);
      return await response.json();
    } catch (error) {
      console.error('[DirectUpload] 获取下载链接失败:', error);
      throw error;
    }
  }
}

// 导出类和默认实例
window.DirectUploader = DirectUploader;

// 创建默认实例
window.directUploader = new DirectUploader({
  onProgress: (progress) => {
    console.log(`[DirectUpload] 进度: ${progress.percent}% (${progress.current}/${progress.total})`);
  },
  onSuccess: (result) => {
    console.log('[DirectUpload] 上传成功:', result);
  },
  onError: (error) => {
    console.error('[DirectUpload] 上传失败:', error);
  },
  onChunkSuccess: (result, current, total) => {
    console.log(`[DirectUpload] 分片上传成功: ${current}/${total}`);
  },
  onChunkError: (error, partNumber, total) => {
    console.error(`[DirectUpload] 分片 ${partNumber} 上传失败:`, error);
  }
}); 