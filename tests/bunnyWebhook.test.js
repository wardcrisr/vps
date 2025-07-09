const request = require('supertest');
const mongoose = require('mongoose');

// 使用测试环境，避免监听实际端口
process.env.NODE_ENV = 'test';

const app = require('../src/app');

// Mock bunny client
jest.mock('../bunny', () => {
  return {
    getVideo: jest.fn().mockResolvedValue({ lengthInSeconds: 123 }),
  };
});

const Media = require('../src/models/Media');

// Mock DB methods
jest.spyOn(Media, 'findOneAndUpdate').mockResolvedValue(null);

// 使用内存数据库或本地 Mongo，示例中仅测试路由返回

describe('POST /api/bunny/webhook', () => {
  it('should accept webhook and respond 200', async () => {
    const res = await request(app)
      .post('/api/bunny/webhook')
      .send({ videoId: 'test-video', status: 'Ready' })
      .set('Accept', 'application/json');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

afterAll(() => mongoose.connection?.close()); 