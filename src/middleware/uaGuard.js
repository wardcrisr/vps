/**
 * User-Agent 允许列表校验中间件与工具函数
 * 仅放行：
 * - PC 端 Chrome
 * - Android Chrome
 * - iOS Safari
 * - iOS Chrome（CriOS）
 * 其余 UA 一律拒绝
 */

function isAllowedUserAgent(uaRaw) {
  if (!uaRaw || typeof uaRaw !== 'string') return false;
  const ua = uaRaw.toLowerCase();

  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isDesktop = !isIOS && !isAndroid;

  // 通用排除：不允许 Edge、Opera、Firefox、UC、三星、华为、QQ、百度等
  const isEdge = /edg|edgios|edga/.test(ua);
  const isOpera = /opr|opios/.test(ua);
  const isFirefox = /firefox|fxios/.test(ua);
  const isUc = /ucbrowser/.test(ua);
  const isSamsung = /samsungbrowser/.test(ua);
  const isHuawei = /huawei|harmony/.test(ua);
  const isMiui = /miuibrowser/.test(ua);
  const isBaidu = /baidubrowser|bidubrowser/.test(ua);
  const isQQ = /qqbrowser/.test(ua);
  const isDingtalk = /dingtalk/.test(ua);
  const isWeChat = /micromessenger/.test(ua);
  const isWebView = /; wv\)/.test(ua) || /\bwv\b/.test(ua);
  const isVivaldi = /vivaldi/.test(ua);
  const isYaBrowser = /yabrowser/.test(ua);
  const isDuckDuckGo = /duckduckgo/.test(ua);
  const isQuark = /quark/.test(ua);
  const isHeyTap = /heytap|coloros|oppo/.test(ua);
  const isFBApp = /fbav/.test(ua);
  const isIGApp = /instagram/.test(ua);
  const isTwitterApp = /twitter/.test(ua);
  const isOtherBlocked = isEdge || isOpera || isFirefox || isUc || isSamsung || isHuawei || isMiui || isBaidu || isQQ || isDingtalk || isWeChat || isWebView || isVivaldi || isYaBrowser || isDuckDuckGo || isQuark || isHeyTap || isFBApp || isIGApp || isTwitterApp;

  if (isOtherBlocked) return false;

  // 允许：iOS Safari（含 Version/... Safari，且不包含 CriOS/FxiOS/EdgiOS 等）
  if (isIOS) {
    const isCriOS = /crios/.test(ua);
    const isSafari = /safari/.test(ua) && /version\//.test(ua) && !isCriOS;
    if (isSafari) return true; // iOS Safari
    if (isCriOS) return true;  // iOS Chrome
    return false;              // 其余 iOS 浏览器一律拒绝
  }

  // 允许：Android Chrome（排除常见套壳）
  if (isAndroid) {
    const isChrome = /chrome\/\d+/.test(ua);
    if (isChrome) return true;
    return false;
  }

  // 允许：PC Chrome（排除 Edge/Opera/Firefox 已在上面）
  if (isDesktop) {
    const isChrome = /chrome\//.test(ua);
    if (isChrome) return true;
  }

  return false;
}

function ensureAllowedUA() {
  return function uaGuardMiddleware(req, res, next) {
    const ua = req.get('user-agent') || '';
    const allowed = isAllowedUserAgent(ua);
    if (!allowed) {
      // 对于流媒体/文件请求，返回 403 文本；对 API 返回 JSON
      const accept = (req.get('accept') || '').toLowerCase();
      if (accept.includes('application/json') || req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, code: 'UA_BLOCKED', message: '当前浏览器不被允许播放视频，请使用 Chrome 或 iOS Safari/Chrome' });
      }
      res.status(403).type('text/plain').send('Forbidden: Unsupported browser. Use Chrome or iOS Safari/Chrome.');
      return;
    }
    next();
  };
}

module.exports = {
  isAllowedUserAgent,
  ensureAllowedUA,
};


