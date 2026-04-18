const { getCaptchaData } = require('./lib/index');

module.exports = (req, res) => {
  const { token, cookies } = req.query;
  
  if (!token || !cookies) {
    return res.status(400).json({ success: false, message: 'token and cookies required' });
  }
  
  getCaptchaData(token, decodeURIComponent(cookies))
    .then(buffer => {
      res.set('Content-Type', 'image/jpeg');
      res.send(Buffer.from(buffer));
    })
    .catch(error => {
      res.status(400).json({ success: false, message: error.message });
    });
};