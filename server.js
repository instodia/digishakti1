const express = require('express');
const path = require('path');
const apiStart = require('./api/start');
const apiSearch = require('./api/search');
const apiCaptcha = require('./api/captcha');

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/start', apiStart);
app.post('/api/search', apiSearch);
app.get('/api/captcha', apiCaptcha);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;