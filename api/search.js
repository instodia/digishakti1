const axios = require('axios');
const { getCaptchaData, tryCaptchaSubmit, generateCaptchaVariations } = require('./lib/index');
const { resolveCollegeByRollNo } = require('./lib/collegeResolver');

const OCR_API_URL = 'https://api.ocr.space/parse/image';
const OCR_KEYS = [
  process.env.OCR_API_KEY,
  'K88753232888957',
  'K84126154688957',
  'helloworld'
].filter(Boolean);

async function solveCaptchaWithOCR(token, cookies) {
  try {
    const captchaBuffer = await getCaptchaData(token, cookies);
    const base64Image = Buffer.from(captchaBuffer).toString('base64');
    
    const formData = new URLSearchParams();
    formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
    formData.append('OCREngine', '2');
    formData.append('scale', 'true');
    formData.append('detectOrientation', 'true');

    for (const key of OCR_KEYS) {
      try {
        const response = await axios.post(OCR_API_URL, formData.toString(), {
          headers: {
            'apikey': key,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 3000
        });

        if (response.data && response.data.ParsedResults && response.data.ParsedResults.length > 0) {
          const rawText = response.data.ParsedResults[0].ParsedText || '';
          const cleaned = rawText.trim().replace(/[^a-zA-Z0-9]/g, '');
          if (cleaned.length >= 4 && cleaned.length <= 6) {
            return cleaned;
          }
        }
      } catch (err) {
        // Try next key if this one fails
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

function filterPII(details) {
  if (!details || typeof details !== 'object') return {};
  const filtered = {};
  const hiddenTerms = ['email', 'mobile', 'phone', 'kyc', 'attempt', 'nationality', 'password', 'token'];
  for (const [key, val] of Object.entries(details)) {
    const lower = key.toLowerCase();
    if (!hiddenTerms.some(t => lower.includes(t))) {
      filtered[key] = val;
    }
  }
  return filtered;
}

module.exports = async (req, res) => {
  const { sessionId, token, cookies, EnrollNo, Captcha, collegeId } = req.body;

  if (!sessionId || !EnrollNo || !token || !cookies) {
    return res.status(400).json({ success: false, message: "Missing required session or search fields." });
  }

  const cleanEnrollNo = EnrollNo.trim();

  // Automatically resolve college ID from roll number if not provided
  let targetCollegeId = collegeId;
  let collegeInfo = null;

  if (!targetCollegeId) {
    collegeInfo = resolveCollegeByRollNo(cleanEnrollNo);
    if (collegeInfo) {
      targetCollegeId = collegeInfo.collegeId;
    }
  }

  if (!targetCollegeId) {
    return res.status(400).json({
      success: false,
      message: "Unable to identify AKTU college from the roll number. Please ensure you entered a valid 13-digit AKTU roll number."
    });
  }

  let currentToken = token;
  let currentCookies = cookies;
  const userCaptcha = Captcha ? Captcha.trim() : '';

  // 1. If manual Captcha is provided by user, submit directly
  if (userCaptcha) {
    try {
      const result = await tryCaptchaSubmit(currentToken, currentCookies, cleanEnrollNo, userCaptcha, targetCollegeId);
      const updatedToken = result.newToken || currentToken;
      const updatedCookies = result.newCookies || currentCookies;
      const nextCaptchaUrl = `/api/captcha?token=${encodeURIComponent(updatedToken)}&cookies=${encodeURIComponent(updatedCookies)}`;

      if (result.success) {
        const sanitized = filterPII(result.details);
        if (!sanitized['College'] && !sanitized['Institute'] && collegeInfo?.collegeName) {
          sanitized['Detected College'] = collegeInfo.collegeName;
        }
        return res.json({ 
          success: true, 
          data: sanitized,
          college: collegeInfo ? { name: collegeInfo.collegeName, code: collegeInfo.collegeCode } : null,
          captchaUrl: nextCaptchaUrl,
          token: updatedToken,
          cookies: updatedCookies
        });
      }

      if (result.captchaError) {
        return res.json({ 
          success: false, 
          needsManualCaptcha: true,
          isCaptchaError: true,
          message: "Invalid CAPTCHA entered. Please enter the characters shown below.",
          captchaUrl: nextCaptchaUrl,
          token: updatedToken,
          cookies: updatedCookies
        });
      }

      return res.json({ 
        success: false, 
        message: result.message || "Student record not found for this enrollment number.",
        captchaUrl: nextCaptchaUrl,
        token: updatedToken,
        cookies: updatedCookies
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Search failed: ' + error.message });
    }
  }

  // Exclude specific roll numbers from auto-solving (manual CAPTCHA required)
  const EXCLUDED_AUTO_SOLVE_ROLLS = ['2500541530140'];
  if (EXCLUDED_AUTO_SOLVE_ROLLS.includes(cleanEnrollNo)) {
    const nextCaptchaUrl = `/api/captcha?token=${encodeURIComponent(currentToken)}&cookies=${encodeURIComponent(currentCookies)}`;
    return res.json({ 
      success: false, 
      needsManualCaptcha: true, 
      message: "Please enter the security code below to proceed.",
      captchaUrl: nextCaptchaUrl,
      token: currentToken,
      cookies: currentCookies
    });
  }

  // 2. No manual Captcha provided -> AUTO-SOLVE with OCR Space (Up to 3 attempts)
  const MAX_AUTO_ATTEMPTS = 3;

  try {
    for (let attempt = 1; attempt <= MAX_AUTO_ATTEMPTS; attempt++) {
      const solvedCaptcha = await solveCaptchaWithOCR(currentToken, currentCookies);

      if (solvedCaptcha) {
        const variations = generateCaptchaVariations(solvedCaptcha);

        for (const variant of variations) {
          const result = await tryCaptchaSubmit(currentToken, currentCookies, cleanEnrollNo, variant, targetCollegeId);
          if (result.newToken) currentToken = result.newToken;
          if (result.newCookies) currentCookies = result.newCookies;

          if (result.success) {
            const sanitized = filterPII(result.details);
            if (!sanitized['College'] && !sanitized['Institute'] && collegeInfo?.collegeName) {
              sanitized['Detected College'] = collegeInfo.collegeName;
            }
            return res.json({ 
              success: true, 
              data: sanitized,
              college: collegeInfo ? { name: collegeInfo.collegeName, code: collegeInfo.collegeCode } : null,
              captchaUrl: `/api/captcha?token=${encodeURIComponent(currentToken)}&cookies=${encodeURIComponent(currentCookies)}`,
              token: currentToken,
              cookies: currentCookies
            });
          }

          // If not a captcha error (e.g. Student record not found), return response directly without retrying
          if (!result.captchaError) {
            return res.json({ 
              success: false, 
              message: result.message || "Student record not found for this enrollment number.",
              captchaUrl: `/api/captcha?token=${encodeURIComponent(currentToken)}&cookies=${encodeURIComponent(currentCookies)}`,
              token: currentToken,
              cookies: currentCookies
            });
          }
        }
      }

      // Short delay between auto-solve retries if not the last attempt
      if (attempt < MAX_AUTO_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // If all 3 auto-solving attempts failed or were rejected -> Prompt manual CAPTCHA
    const nextCaptchaUrl = `/api/captcha?token=${encodeURIComponent(currentToken)}&cookies=${encodeURIComponent(currentCookies)}`;
    return res.json({ 
      success: false, 
      needsManualCaptcha: true, 
      message: "Please enter the security code below to proceed.",
      captchaUrl: nextCaptchaUrl,
      token: currentToken,
      cookies: currentCookies
    });

  } catch (error) {
    const nextCaptchaUrl = `/api/captcha?token=${encodeURIComponent(currentToken)}&cookies=${encodeURIComponent(currentCookies)}`;
    return res.json({
      success: false,
      needsManualCaptcha: true,
      message: "Please enter the security code below to proceed.",
      captchaUrl: nextCaptchaUrl,
      token: currentToken,
      cookies: currentCookies
    });
  }
};