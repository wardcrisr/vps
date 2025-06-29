require('dotenv').config();
console.log('Bunny API Key =', process.env.BUNNY_API_KEY);
console.log('Bunny Video Library =', process.env.BUNNY_VIDEO_LIBRARY);
const { BunnyCdnStream } = require('bunnycdn-stream');

(async () => {
  const bunny = new BunnyCdnStream({
    apiKey: process.env.BUNNY_API_KEY,
    videoLibrary: process.env.BUNNY_VIDEO_LIBRARY,
  });

  try {
    const { guid: videoId } = await bunny.createVideo({ title: 'SDK test' });
    console.log('✅ createVideo OK, videoId =', videoId);
  } catch (e) {
    console.error('❌ createVideo error:', e.message);
  }
})();
