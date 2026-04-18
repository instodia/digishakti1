const axios = require('axios');
const cheerio = require('cheerio');

const MAIN_URL = 'https://aadhaar.digishaktiup.in/EPramaan/SendServiceToEpramaan';
const CAPTCHA_URL = 'https://aadhaar.digishaktiup.in/EPramaan/GetCaptchaimage';

function randomDelay(min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6369.132 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Connection': 'keep-alive',
};

async function startSession() {
  await randomDelay(500, 1500);
  
  const response = await axios.get(MAIN_URL, {
    headers: {
      ...defaultHeaders,
      'Referer': 'https://aadhaar.digishaktiup.in/',
      'Origin': 'https://aadhaar.digishaktiup.in'
    }
  });

  const $ = cheerio.load(response.data);
  const token = $('input[name="__RequestVerificationToken"]').val();

  if (!token) {
    throw new Error("Failed to extract CSRF token.");
  }

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    sessionId,
    token,
    cookies: response.headers['set-cookie'] || ''
  };
}

async function getCaptchaData(token, cookies) {
  await randomDelay(300, 800);
  
  const response = await axios.get(CAPTCHA_URL, {
    headers: {
      ...defaultHeaders,
      'Referer': MAIN_URL,
      'Origin': 'https://aadhaar.digishaktiup.in',
      'Cookie': cookies || ''
    },
    responseType: 'arraybuffer'
  });

  return response.data;
}

function generateCaptchaVariations(text) {
  const variations = [text];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === 'O' || char === '0') {
      const replacement = char === 'O' ? '0' : 'O';
      const newText = text.substring(0, i) + replacement + text.substring(i + 1);
      if (!variations.includes(newText)) variations.push(newText);
    }
    
    if (char === 'I' || char === '1') {
      const replacement = char === 'I' ? '1' : 'I';
      const newText = text.substring(0, i) + replacement + text.substring(i + 1);
      if (!variations.includes(newText)) variations.push(newText);
    }
  }
  
  return variations;
}

async function tryCaptchaSubmit(token, cookies, enrollNo, captcha, collegeId) {
  const formData = new URLSearchParams({
    __RequestVerificationToken: token,
    UniDeptBoardId: "5",
    CGId: collegeId || "11041",
    EnrollNo: enrollNo,
    Captcha: captcha,
    ResidenceType: "I"
  });

  await randomDelay(800, 2000);

  const response = await axios.post(MAIN_URL, formData.toString(), {
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://aadhaar.digishaktiup.in',
      'Referer': MAIN_URL,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cookie': cookies || ''
    }
  });

  const $ = cheerio.load(response.data);
  
  const details = {};
  
  const errorDivs = $('.alert, .text-danger, span[class*="field-validation-error"]').text();
  if (errorDivs && errorDivs.trim().length > 0) {
    const errorText = errorDivs.trim().replace(/\s+/g, ' ');
    if (/invalid|captcha|not found|error/i.test(errorText)) {
      if (/captcha/i.test(errorText)) {
        return { success: false, captchaError: true };
      }
      return { success: false, captchaError: false, message: errorText };
    }
  }

  $('table tr').each((i, el) => {
    const cells = $(el).children('th, td');
    let lastTh = null;
    cells.each((j, cell) => {
      const isTh = cell.tagName.toLowerCase() === 'th';
      const text = $(cell).text().trim().replace(/\s+/g, ' ');
      if (isTh) {
        lastTh = text;
      } else if (lastTh && !isTh) {
        details[lastTh] = text;
        lastTh = null;
      }
    });
  });

  if (Object.keys(details).length === 0) {
    $('input[type="text"]').each((i, el) => {
      const id = $(el).attr('id') || $(el).attr('name');
      const val = $(el).val();
      if (id && val) details[id] = val;
    });
  }

  if (Object.keys(details).length === 0) {
    if (/captcha/i.test(response.data)) {
      return { success: false, captchaError: true };
    }
    return { success: false, captchaError: false, message: "No data found." };
  }

  return { success: true, details };
}

module.exports = { 
  startSession, 
  getCaptchaData, 
  tryCaptchaSubmit, 
  generateCaptchaVariations,
  randomDelay,
  defaultHeaders,
  MAIN_URL,
  CAPTCHA_URL
};