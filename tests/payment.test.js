const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

describe('POST /api/createpaymentintent', () => {
  it('should return clientSecret', async () => {
    const res = await request(app)
      .post('/api/createpaymentintent')
      .send({ amount: 1000, currency: 'usd' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('clientSecret');
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});
// tests/payment.test.js 最后面
afterAll(async () => {
    await require('mongoose').disconnect();
  });
  
