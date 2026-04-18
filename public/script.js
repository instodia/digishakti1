const API_URL = window.location.origin;

let sessionData = null;

const initLoader = document.getElementById('init-loader');
const searchForm = document.getElementById('search-form');
const errorBanner = document.getElementById('error-banner');
const errorText = document.getElementById('error-text');

const captchaSection = document.getElementById('captcha-section');
const captchaImg = document.getElementById('captcha-img');
const refreshCaptchaBtn = document.getElementById('refresh-captcha-btn');
const captchaInput = document.getElementById('captcha-input');

const enrollInput = document.getElementById('enrollment-input');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const submitLoader = document.getElementById('submit-loader');
const submitLoaderText = document.getElementById('submit-loader-text');

const resultCard = document.getElementById('result-card');
const resultGrid = document.getElementById('result-grid');

const collegeSelect = document.getElementById('college-select');
let selectedCollegeId = '11041';

collegeSelect.addEventListener('change', (e) => {
  selectedCollegeId = e.target.value;
});

const showError = (msg) => {
  if (!msg) {
    errorBanner.classList.add('hidden');
    return;
  }
  errorText.textContent = msg;
  errorBanner.classList.remove('hidden');
};

const showCaptcha = (captchaUrl) => {
  captchaSection.classList.remove('hidden');
  captchaImg.src = `${API_URL}${captchaUrl}&t=${Date.now()}`;
  captchaInput.value = '';
  validateForm();
};

const hideCaptcha = () => {
  captchaSection.classList.add('hidden');
  captchaInput.value = '';
};

const validateForm = () => {
  const hasEnrollment = enrollInput.value.trim() !== '';
  const hasCaptcha = !captchaSection.classList.contains('hidden') ? captchaInput.value.trim() !== '' : true;
  
  if (hasEnrollment && hasCaptcha) {
    submitBtn.classList.remove('bg-slate-700/50', 'text-slate-500', 'cursor-not-allowed');
    submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-500', 'text-white', 'shadow-lg', 'shadow-blue-500/20');
    submitBtn.disabled = false;
  } else {
    submitBtn.classList.add('bg-slate-700/50', 'text-slate-500', 'cursor-not-allowed');
    submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-500', 'text-white', 'shadow-lg', 'shadow-blue-500/20');
    submitBtn.disabled = true;
  }
};

enrollInput.addEventListener('input', validateForm);
captchaInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
  validateForm();
});

const initSession = async () => {
  showError(null);
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
    } else {
      showError(data.message || 'Failed to start session');
    }
  } catch (err) {
    showError('Backend offline. Please try again later.');
  }
};

refreshCaptchaBtn.addEventListener('click', () => {
  if (captchaImg.src) {
    captchaImg.src = `${API_URL}/api/captcha?token=${encodeURIComponent(sessionData.token)}&cookies=${encodeURIComponent(sessionData.cookies)}&t=${Date.now()}`;
  }
});

const isHiddenFilter = (key) => {
  const k = key.toLowerCase();
  return k.includes('email') || k.includes('mobile') || k.includes('phone') || k.includes('kyc') || k.includes('attempt') || k.includes('nationality');
};

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!sessionData || !selectedCollegeId) return;

  showError(null);
  
  submitBtn.disabled = true;
  submitText.classList.add('hidden');
  submitLoader.classList.remove('hidden');
  submitLoaderText.textContent = 'Processing...';
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
        Captcha: captchaInput.value.trim(),
        collegeId: selectedCollegeId
      })
    });

    const data = await res.json();

    if (data.success && data.data && Object.keys(data.data).length > 0) {
      const filteredData = Object.entries(data.data).filter(([key]) => !isHiddenFilter(key));
      
      if (filteredData.length === 0) {
        resultCard.classList.add('hidden');
        showError('User details not found.');
      } else {
        filteredData.forEach(([key, val]) => {
          const div = document.createElement('div');
          div.className = "flex flex-col sm:flex-row sm:justify-between py-2 border-b border-slate-700/30 last:border-0";
          div.innerHTML = `
            <span class="text-slate-400 mb-0.5 sm:mb-0">${key}</span>
            <span class="text-slate-200 font-medium text-left sm:text-right">${val || 'N/A'}</span>
          `;
          resultGrid.appendChild(div);
        });
        resultCard.classList.remove('hidden');
        hideCaptcha();
      }
    } else if (data.needsManualCaptcha) {
      resultCard.classList.add('hidden');
      resultGrid.innerHTML = '';
      showCaptcha(data.captchaUrl);
      showError(data.message);
      submitLoaderText.textContent = 'Manual verification needed';
    } else {
      resultCard.classList.add('hidden');
      resultGrid.innerHTML = '';
      showError(data.message || 'User details not found.');
    }

  } catch (err) {
    showError('Network error handling request.');
  } finally {
    submitBtn.disabled = false;
    submitText.classList.remove('hidden');
    submitLoader.classList.add('hidden');
    validateForm();
  }
});

window.addEventListener('DOMContentLoaded', initSession);