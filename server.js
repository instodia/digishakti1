const express = require('express');
const path = require('path');
const cors = require('cors');
const apiStart = require('./api/start');
const apiSearch = require('./api/search');
const apiCaptcha = require('./api/captcha');
const apiCollege = require('./api/college');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/start', apiStart);
app.all('/api/search', apiSearch);
app.all('/api/captcha', apiCaptcha);
app.all('/api/college', apiCollege);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;