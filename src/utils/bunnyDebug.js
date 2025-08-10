function mask(value) {
  if (!value || typeof value !== 'string') return '(empty)';
  if (value.length <= 8) return `${value[0]}…${value[value.length - 1]}`;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function debugBunnyToken(contextLabel, payload) {
  if (process.env.DEBUG_BUNNY !== '1') return;
  try {
    const now = Math.floor(Date.now() / 1000);
    const info = {
      libId: payload.libId,
      bunnyId: payload.bunnyId,
      expires: payload.expires,
      secondsUntilExpire: payload.expires ? payload.expires - now : undefined,
      tokenPreview: mask(payload.token || ''),
      secretPreview: mask(process.env.BUNNY_SECRET || ''),
      urlPreview: payload.url ? String(payload.url).split('?')[0] : undefined,
      hasQuery: payload.url ? {
        token: /[?&]token=/.test(payload.url),
        expires: /[?&]expires=/.test(payload.url)
      } : undefined,
      ua: payload.ua || '(no-ua)'
    };
    // eslint-disable-next-line no-console
    console.log('🐰 [BUNNY DEBUG]', contextLabel, info);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('🐰 [BUNNY DEBUG] logging failed:', e.message);
  }
}

module.exports = { debugBunnyToken };


