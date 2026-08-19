const { getCaptchaData } = require('./lib/index');

module.exports = async (req, res) => {
  const token = req.query?.token || req.body?.token;
  const cookies = req.query?.cookies || req.body?.cookies;
  
  if (!token || !cookies) {
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

  try {
    const buffer = await getCaptchaData(token, cookieStr);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.end(Buffer.from(buffer));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, message: error.message }));
  }
};