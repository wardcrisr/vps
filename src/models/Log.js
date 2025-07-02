const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type   : { type: String, enum: ['topup', 'purchase'], required: true },
  amount : { type: Number, required: true }, // 正数充值 负数扣款
  remark : { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Log', LogSchema); 