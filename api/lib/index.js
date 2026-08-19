const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://aadhaar.digishaktiup.in';
const MAIN_URL = 'https://aadhaar.digishaktiup.in/EPramaan/SendServiceToEpramaan';
const CAPTCHA_URL = 'https://aadhaar.digishaktiup.in/EPramaan/GetCaptchaimage';

function randomDelay(min = 100, max = 300) {
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
  await randomDelay(100, 250);
  
  // Step 1: Hit root page to obtain initial ASP.NET session cookie and redirect token URL
  const rootResponse = await axios.get(BASE_URL, {
    maxRedirects: 0,
    validateStatus: () => true,
    headers: {
      ...defaultHeaders,
      'Referer': BASE_URL,
      'Origin': BASE_URL
    },
    timeout: 8000
  });

  const cookies1 = rootResponse.headers['set-cookie'] || [];
  const redirectPath = rootResponse.headers.location;
  
  if (!redirectPath) {
    throw new Error("Failed to get initial redirection from DigiShakti portal.");
  }

  const targetUrl = redirectPath.startsWith('http') ? redirectPath : `${BASE_URL}${redirectPath.startsWith('/') ? '' : '/'}${redirectPath}`;
  const initialCookieHeader = cookies1.map(c => c.split(';')[0]).join('; ');

  // Step 2: Fetch the verification form page with session cookie to extract CSRF token
  const formResponse = await axios.get(targetUrl, {
    headers: {
      ...defaultHeaders,
      'Cookie': initialCookieHeader,
      'Referer': BASE_URL
    },
    timeout: 8000
  });

  const cookies2 = formResponse.headers['set-cookie'] || [];
  const combinedCookies = [...cookies1, ...cookies2].map(c => c.split(';')[0]).join('; ');

  const $ = cheerio.load(formResponse.data);
  const token = $('input[name="__RequestVerificationToken"]').val();

  if (!token) {
    throw new Error("Failed to extract CSRF token.");
  }

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    sessionId,
    token,
    cookies: combinedCookies
  };
}

async function getCaptchaData(token, cookies) {
  await randomDelay(100, 200);
  
  const response = await axios.get(CAPTCHA_URL, {
    headers: {
      ...defaultHeaders,
      'Referer': MAIN_URL,
      'Origin': BASE_URL,
      'Cookie': cookies || ''
    },
    responseType: 'arraybuffer',
    timeout: 6000
  });

  return response.data;
}

function generateCaptchaVariations(text) {
  if (!text) return [];
  const clean = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const variations = [clean];
  
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    
    if (char === 'O' || char === '0') {
      const replacement = char === 'O' ? '0' : 'O';
      const newText = clean.substring(0, i) + replacement + clean.substring(i + 1);
      if (!variations.includes(newText)) variations.push(newText);
    }
    
    if (char === 'I' || char === '1') {
      const replacement = char === 'I' ? '1' : 'I';
      const newText = clean.substring(0, i) + replacement + clean.substring(i + 1);
      if (!variations.includes(newText)) variations.push(newText);
    }
  }
  
  return variations.slice(0, 2);
}

function mergeCookies(oldCookies, newSetCookieHeaders) {
  if (!newSetCookieHeaders || !newSetCookieHeaders.length) return oldCookies || '';
  const cookieMap = {};
  
  if (oldCookies) {
    oldCookies.split(';').forEach(c => {
      const [k, ...v] = c.trim().split('=');
      if (k) cookieMap[k] = v.join('=');
    });
  }
  
  newSetCookieHeaders.forEach(c => {
    const part = c.split(';')[0];
    const [k, ...v] = part.trim().split('=');
    if (k) cookieMap[k] = v.join('=');
  });
  
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function tryCaptchaSubmit(token, cookies, enrollNo, captcha, collegeId) {
  const formData = new URLSearchParams({
    __RequestVerificationToken: token,
    UniDeptBoardId: "5",
    CGId: collegeId || "11041",
    EnrollNo: (enrollNo || '').trim(),
    Captcha: (captcha || '').trim(),
    ResidenceType: "I",
    CountryId: "0",
    btnSubmit: "Search"
  });

  await randomDelay(150, 300);

  const response = await axios.post(MAIN_URL, formData.toString(), {
    headers: {
      ...defaultHeaders,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': BASE_URL,
      'Referer': MAIN_URL,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Cookie': cookies || ''
    },
    timeout: 10000,
    validateStatus: () => true
  });

  const updatedCookies = mergeCookies(cookies, response.headers['set-cookie']);
  const $ = cheerio.load(response.data);
  const newToken = $('input[name="__RequestVerificationToken"]').val() || token;

  const details = {};

  // Parse HTML tables for student information
  $('table tr').each((i, el) => {
    const ths = $(el).find('th');
    const tds = $(el).find('td');

    if (ths.length > 0 && tds.length > 0) {
      ths.each((j, th) => {
        const key = $(th).text().trim().replace(/[:\s]+/g, ' ');
        const val = $(tds[j] || tds[0]).text().trim().replace(/\s+/g, ' ');
        if (key && val) details[key] = val;
      });
    } else if (tds.length >= 2) {
      for (let j = 0; j < tds.length; j += 2) {
        const key = $(tds[j]).text().trim().replace(/[:\s]+/g, ' ');
        const val = $(tds[j + 1]).text().trim().replace(/\s+/g, ' ');
        if (key && val && key !== val) details[key] = val;
      }
    }
  });

  // Check form inputs if returned in text boxes
  if (Object.keys(details).length === 0) {
    $('input[type="text"]').each((i, el) => {
      const id = $(el).attr('id') || $(el).attr('name');
      const val = $(el).val();
      if (id && val && id !== 'EnrollNo' && id !== 'Captcha') {
        details[id] = val;
      }
    });
  }

  const validKeys = ['Name', 'Enrollment', 'Enroll No', 'Course', 'Branch', 'Year', 'Semester', 'Father Name', 'Mother Name', 'Gender', 'Date of Birth', 'DOB', 'Category', 'College'];
  const hasValidData = Object.keys(details).some(key => 
    validKeys.some(vk => key.toLowerCase().includes(vk.toLowerCase()))
  );

  if (hasValidData) {
    return { success: true, details, newToken, newCookies: updatedCookies };
  }

  // Check server-rendered SweetAlert messages: swal({ title: "...", text: "...", ... })
  const swalObjMatch = response.data.match(/swal\s*\(\s*\{[\s\S]*?text\s*:\s*["']([^"']+)["'][\s\S]*?\}\s*,/i) ||
                       response.data.match(/swal\s*\(\s*\{[\s\S]*?title\s*:\s*["']([^"']+)["'][\s\S]*?\}\s*,/i);

  if (swalObjMatch) {
    const swalText = swalObjMatch[1].trim();
    if (/invalid\s*captcha|captcha\s*entered|wrong\s*captcha/i.test(swalText)) {
      return { success: false, captchaError: true, message: swalText, newToken, newCookies: updatedCookies };
    }
    if (swalText.length > 0 && !swalText.includes('foreign student')) {
      return { success: false, captchaError: false, message: swalText, newToken, newCookies: updatedCookies };
    }
  }

  // Check field validation error for Captcha
  const captchaFieldErr = $('span[data-valmsg-for="Captcha"]').text().trim();
  if (captchaFieldErr && captchaFieldErr.length > 0 && !captchaFieldErr.includes('*')) {
    return { success: false, captchaError: true, message: captchaFieldErr, newToken, newCookies: updatedCookies };
  }

  // Check explicit alert banners
  const alertText = $('.alert-danger, .alert-warning, .validation-summary-errors').text().trim().replace(/\s+/g, ' ');
  if (alertText && alertText.length > 0 && !alertText.includes('foreign student')) {
    if (/captcha/i.test(alertText)) {
      return { success: false, captchaError: true, message: alertText, newToken, newCookies: updatedCookies };
    }
    return { success: false, captchaError: false, message: alertText, newToken, newCookies: updatedCookies };
  }

  return { success: false, captchaError: false, message: "Student record not found for this enrollment number & college.", newToken, newCookies: updatedCookies };
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