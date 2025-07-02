const mongoose = require('mongoose');
const Media = require('../src/models/Media');

(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/contentdb';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Mongo connected');

  // 找出有重复 bunnyId 的分组
  const duplicates = await Media.aggregate([
    { $match: { bunnyId: { $ne: null } } },
    { $group: { _id: '$bunnyId', count: { $sum: 1 }, ids: { $push: '$_id' }, created: { $push: '$createdAt' } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  let totalRemoved = 0;
  for (const dup of duplicates) {
    const bunnyId = dup._id;
    // 找最新的一条保留
    const latestMedia = await Media.findOne({ bunnyId }).sort({ createdAt: -1 });
    const keepId = latestMedia._id.toString();
    const deleteIds = dup.ids.filter(id => id.toString() !== keepId);

    if (deleteIds.length) {
      await Media.deleteMany({ _id: { $in: deleteIds } });
      totalRemoved += deleteIds.length;
      console.log(`bunnyId ${bunnyId}: removed ${deleteIds.length} duplicates, kept ${keepId}`);
    }
  }

  console.log(`Deduplication complete. Removed ${totalRemoved} redundant documents.`);
  await mongoose.disconnect();
})(); 