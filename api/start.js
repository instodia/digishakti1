const { startSession } = require('./lib/index');

module.exports = (req, res) => {
  startSession()
    .then(result => {
      res.json({
        success: true,
        sessionId: result.sessionId,
        token: result.token,
        cookies: result.cookies,
        captchaUrl: `/api/captcha?token=${encodeURIComponent(result.token)}&cookies=${encodeURIComponent(result.cookies)}`,
        university: { id: "5", name: "DR. A.P.J. ABDUL KALAM TECHNICAL UNIVERSITY" },
        college: { id: "11041" }
      });
    })
    .catch(error => {
      res.status(500).json({ success: false, message: 'Failed to start session: ' + error.message });
    });
};