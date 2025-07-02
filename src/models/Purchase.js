const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media', required: true },
  price  : { type: Number, required: false },
  expiresAt: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now }
});

PurchaseSchema.index({ userId:1, videoId:1 }, { unique: true }); // 防重复购买

module.exports = mongoose.model('Purchase', PurchaseSchema); 