const { getCaptchaData } = require('./lib/index');

module.exports = (req, res) => {
  const token = req.query.token || req.body?.token;
  const cookies = req.query.cookies || req.body?.cookies;
  
  if (!token || !cookies) {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(400).json({ success: false, message: 'token and cookies required' });
    }
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, message: 'token and cookies required' }));
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
      const buf = Buffer.from(buffer);
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      if (typeof res.status === 'function') {
        res.status(200);
      } else {
        res.statusCode = 200;
      }
      res.end(buf);
    })
    .catch(error => {
      if (typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: error.message }));
    });
};