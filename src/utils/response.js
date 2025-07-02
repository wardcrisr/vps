// 统一响应封装
module.exports = {
  ok(res, data = {}, message = 'success') {
    return res.status(200).json({ code: 0, message, data });
  },
  err(res, bizCode = 1, message = 'error', httpStatus = 400) {
    return res.status(httpStatus).json({ code: bizCode, message });
  }
}; 