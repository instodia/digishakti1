const { getCaptchaData } = require('./lib/index');

module.exports = (req, res) => {
  const token = req.query.token || req.body?.token;
  const cookies = req.query.cookies || req.body?.cookies;
  
  if (!token || !cookies) {
    return res.status(400).json({ success: false, message: 'token and cookies required' });
  }
  
  let cookieStr = cookies;
  try {
    if (typeof cookieStr === 'string' && cookieStr.includes('%')) {
      cookieStr = decodeURIComponent(cookieStr);
    }
  } catch (e) {
    // keep original string if decoding throws URIError
  }

  getCaptchaData(token, cookieStr)
    .then(buffer => {
      res.set('Content-Type', 'image/jpeg');
      res.send(Buffer.from(buffer));
    })
    .catch(error => {
      res.status(400).json({ success: false, message: error.message });
    });
};