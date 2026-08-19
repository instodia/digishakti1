const API_URL = window.location.origin;

let sessionData = null;
let collegeDetectTimeout = null;

const initLoader = document.getElementById('init-loader');
const searchForm = document.getElementById('search-form');
const errorBanner = document.getElementById('error-banner');
const errorText = document.getElementById('error-text');

// Modal Elements
const captchaModal = document.getElementById('captcha-modal');
const modalErrorBanner = document.getElementById('modal-error-banner');
const modalErrorText = document.getElementById('modal-error-text');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const verifyModalBtn = document.getElementById('verify-modal-btn');
const verifyText = document.getElementById('verify-text');
const verifyLoader = document.getElementById('verify-loader');

const captchaImg = document.getElementById('captcha-img');
const refreshCaptchaBtn = document.getElementById('refresh-captcha-btn');
const captchaInput = document.getElementById('captcha-input');

const enrollInput = document.getElementById('enrollment-input');
const collegeBadge = document.getElementById('college-badge');
const detectedCollegeName = document.getElementById('detected-college-name');
const detectedCollegeCode = document.getElementById('detected-college-code');

const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitLoader = document.getElementById('submit-loader');
const submitLoaderText = document.getElementById('submit-loader-text');

const resultCard = document.getElementById('result-card');
const resultGrid = document.getElementById('result-grid');

const showError = (msg) => {
  if (!msg) {
    errorBanner.classList.add('hidden');
    return;
  }
  errorText.textContent = msg;
  errorBanner.classList.remove('hidden');
};

const showModalError = (msg) => {
  if (!msg) {
    modalErrorBanner.classList.add('hidden');
    return;
  }
  modalErrorText.textContent = msg;
  modalErrorBanner.classList.remove('hidden');
};

const openCaptchaModal = (customUrl, errorMsg) => {
  captchaModal.classList.remove('hidden');
  const url = customUrl || (sessionData ? `/api/captcha?token=${encodeURIComponent(sessionData.token)}&cookies=${encodeURIComponent(sessionData.cookies)}` : '');
  if (url) {
    captchaImg.src = `${API_URL}${url}&t=${Date.now()}`;
  }
  captchaInput.value = '';
  showModalError(errorMsg || null);
  setTimeout(() => captchaInput.focus(), 150);
};

const closeCaptchaModal = () => {
  captchaModal.classList.add('hidden');
  captchaInput.value = '';
  showModalError(null);
  submitBtn.disabled = false;
  submitText.classList.remove('hidden');
  submitLoader.classList.add('hidden');
  validateForm();
};

closeModalBtn.addEventListener('click', closeCaptchaModal);
cancelModalBtn.addEventListener('click', closeCaptchaModal);

// Close on clicking outside modal
captchaModal.addEventListener('click', (e) => {
  if (e.target === captchaModal) {
    closeCaptchaModal();
  }
});

refreshCaptchaBtn.addEventListener('click', () => {
  if (sessionData) {
    captchaImg.src = `${API_URL}/api/captcha?token=${encodeURIComponent(sessionData.token)}&cookies=${encodeURIComponent(sessionData.cookies)}&t=${Date.now()}`;
    captchaInput.value = '';
    captchaInput.focus();
  }
});

const updateDetectedCollege = () => {
  const clean = enrollInput.value.trim().replace(/\D/g, '');
  if (clean.length < 6) {
    collegeBadge.classList.add('hidden');
    return;
  }

  clearTimeout(collegeDetectTimeout);
  collegeDetectTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${API_URL}/api/college?rollNo=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data.success && data.college) {
        detectedCollegeName.textContent = data.college.name;
        detectedCollegeCode.textContent = `AKTU Code: ${data.college.code} (College ID: ${data.college.id})`;
        collegeBadge.classList.remove('hidden');
      } else {
        collegeBadge.classList.add('hidden');
      }
    } catch {
      collegeBadge.classList.add('hidden');
    }
  }, 150);
};

const validateForm = () => {
  const clean = enrollInput.value.trim();
  const hasEnrollment = clean.length >= 6;
  
  if (hasEnrollment) {
    submitBtn.classList.remove('bg-slate-700/50', 'text-slate-500', 'cursor-not-allowed');
    submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-500', 'text-white', 'shadow-lg', 'shadow-blue-500/20');
    submitBtn.disabled = false;
  } else {
    submitBtn.classList.add('bg-slate-700/50', 'text-slate-500', 'cursor-not-allowed');
    submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-500', 'text-white', 'shadow-lg', 'shadow-blue-500/20');
    submitBtn.disabled = true;
  }
};

enrollInput.addEventListener('input', () => {
  updateDetectedCollege();
  validateForm();
});

captchaInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

captchaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    executeManualVerification();
  }
});

verifyModalBtn.addEventListener('click', () => {
  executeManualVerification();
});

const isHiddenFilter = (key) => {
  const k = key.toLowerCase();
  return k.includes('email') || k.includes('mobile') || k.includes('phone') || k.includes('kyc') || k.includes('attempt') || k.includes('nationality');
};

const renderResults = (data) => {
  const filteredData = Object.entries(data).filter(([key]) => !isHiddenFilter(key));
  resultGrid.innerHTML = '';
  
  if (filteredData.length === 0) {
    resultCard.classList.add('hidden');
    showError('User details not found.');
  } else {
    filteredData.forEach(([key, val]) => {
      const div = document.createElement('div');
      div.className = "flex flex-col sm:flex-row sm:justify-between py-2.5 border-b border-slate-700/30 last:border-0";
      div.innerHTML = `
        <span class="text-slate-400 mb-0.5 sm:mb-0">${key}</span>
        <span class="text-slate-200 font-medium text-left sm:text-right">${val || 'N/A'}</span>
      `;
      resultGrid.appendChild(div);
    });
    resultCard.classList.remove('hidden');
  }
};

// Main auto-solve search submission
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sessionData) return;

  showError(null);
  
  submitBtn.disabled = true;
  submitText.classList.add('hidden');
  submitLoader.classList.remove('hidden');
  submitLoaderText.textContent = 'Auto-verifying & Searching...';
  resultCard.classList.add('hidden');
  resultGrid.innerHTML = '';

  try {
    const res = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionData.sessionId,
        token: sessionData.token,
        cookies: sessionData.cookies,
        EnrollNo: enrollInput.value.trim(),
        Captcha: ''
      })
    });

    const data = await res.json();

    if (data.token) sessionData.token = data.token;
    if (data.cookies) sessionData.cookies = data.cookies;

    if (data.success && data.data && Object.keys(data.data).length > 0) {
      renderResults(data.data);
      submitBtn.disabled = false;
      submitText.classList.remove('hidden');
      submitLoader.classList.add('hidden');
    } else if (data.needsManualCaptcha) {
      // Auto-solve failed -> Open modal popup
      openCaptchaModal(data.captchaUrl, data.message);
    } else {
      resultCard.classList.add('hidden');
      resultGrid.innerHTML = '';
      showError(data.message || 'Student record not found for this enrollment number.');
      submitBtn.disabled = false;
      submitText.classList.remove('hidden');
      submitLoader.classList.add('hidden');
    }

  } catch (err) {
    showError('Network error handling request: ' + err.message);
    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitLoader.classList.add('hidden');
  }
});

// Manual CAPTCHA verification inside Modal
const executeManualVerification = async () => {
  const code = captchaInput.value.trim();
  if (!code) {
    showModalError('Please enter the CAPTCHA characters.');
    captchaInput.focus();
    return;
  }

  showModalError(null);
  verifyModalBtn.disabled = true;
  verifyText.classList.add('hidden');
  verifyLoader.classList.remove('hidden');

  try {
    const res = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionData.sessionId,
        token: sessionData.token,
        cookies: sessionData.cookies,
        EnrollNo: enrollInput.value.trim(),
        Captcha: code
      })
    });

    const data = await res.json();

    if (data.token) sessionData.token = data.token;
    if (data.cookies) sessionData.cookies = data.cookies;

    if (data.success && data.data && Object.keys(data.data).length > 0) {
      closeCaptchaModal();
      renderResults(data.data);
    } else if (data.isCaptchaError || data.needsManualCaptcha) {
      // Stay in modal, refresh CAPTCHA, and show error
      showModalError(data.message || 'Invalid CAPTCHA code. Please try again.');
      if (data.captchaUrl) {
        captchaImg.src = `${API_URL}${data.captchaUrl}&t=${Date.now()}`;
      }
      captchaInput.value = '';
      captchaInput.focus();
    } else {
      // Record not found or other non-captcha error
      closeCaptchaModal();
      resultCard.classList.add('hidden');
      resultGrid.innerHTML = '';
      showError(data.message || 'Student record not found for this enrollment number.');
    }
  } catch (err) {
    showModalError('Network error: ' + err.message);
  } finally {
    verifyModalBtn.disabled = false;
    verifyText.classList.remove('hidden');
    verifyLoader.classList.add('hidden');
  }
};

const initSession = async () => {
  showError(null);
  initLoader.classList.remove('hidden');
  searchForm.classList.add('hidden');
  try {
    const res = await fetch(`${API_URL}/api/start`);
    const data = await res.json();
    if (data.success) {
      sessionData = {
        sessionId: data.sessionId,
        token: data.token,
        cookies: data.cookies
      };
      initLoader.classList.add('hidden');
      searchForm.classList.remove('hidden');
      validateForm();
    } else {
      showError(data.message || 'Failed to start session');
      initLoader.classList.add('hidden');
    }
  } catch (err) {
    showError('Unable to connect to service: ' + err.message);
    initLoader.classList.add('hidden');
  }
};

window.addEventListener('DOMContentLoaded', initSession);