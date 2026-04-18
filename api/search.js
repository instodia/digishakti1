const axios = require('axios');
const { getCaptchaData, tryCaptchaSubmit, generateCaptchaVariations, randomDelay, MAIN_URL } = require('./lib/index');

const OCR_API_URL = 'https://api.ocr.space/parse/image';
const OCR_SPACE_API_KEY = process.env.OCR_API_KEY || 'helloworld';
const MAX_CAPTCHA_RETRIES = 3;

async function solveCaptcha(token, cookies) {
  try {
    const captchaBuffer = await getCaptchaData(token, cookies);
    const base64Image = Buffer.from(captchaBuffer).toString('base64');
    
    const formData = new URLSearchParams();
    formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
    formData.append('OCREngine', '2');
    formData.append('scale', 'true');
    formData.append('detectOrientation', 'true');

    const response = await axios.post(OCR_API_URL, formData.toString(), {
      headers: {
        'apikey': OCR_SPACE_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (response.data.ParsedResults && response.data.ParsedResults.length > 0) {
      let captchaText = response.data.ParsedResults[0].ParsedText
        .trim()
        .replace(/[^a-zA-Z0-9]/g, '');
      return captchaText;
    }
    return null;
  } catch (error) {
    return null;
  }
}

module.exports = (req, res) => {
  const { sessionId, token, cookies, EnrollNo, Captcha, collegeId } = req.body;

  if (!sessionId || !EnrollNo || !token || !cookies) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const processSearch = async () => {
    let captcha = Captcha;
    let attempts = 0;

    if (!captcha) {
      while (attempts < MAX_CAPTCHA_RETRIES) {
        attempts++;
        
        const solvedCaptcha = await solveCaptcha(token, cookies);
        
        if (solvedCaptcha && solvedCaptcha.length > 0) {
          const variations = generateCaptchaVariations(solvedCaptcha);
          
          for (const variant of variations) {
            const result = await tryCaptchaSubmit(token, cookies, EnrollNo, variant, collegeId);
            
            if (result.success) {
              return res.json({ success: true, data: result.details });
            }
            
            if (!result.captchaError) {
              return res.json({ success: false, message: result.message });
            }
          }
        }
        
        await new Promise(r => setTimeout(r, 1000));
      }

      return res.json({ 
        success: false, 
        needsManualCaptcha: true, 
        message: "Auto CAPTCHA solve failed.",
        captchaUrl: `/api/captcha?token=${encodeURIComponent(token)}&cookies=${encodeURIComponent(cookies)}`
      });
    }

    const result = await tryCaptchaSubmit(token, cookies, EnrollNo, captcha, collegeId);
    
    if (result.success) {
      return res.json({ success: true, data: result.details });
    }
    
    if (result.captchaError) {
      return res.json({ 
        success: false, 
        needsManualCaptcha: true, 
        message: "CAPTCHA verification failed.",
        captchaUrl: `/api/captcha?token=${encodeURIComponent(token)}&cookies=${encodeURIComponent(cookies)}`
      });
    }
    
    return res.json({ success: false, message: result.message });
  };

  processSearch().catch(error => {
    res.status(500).json({ success: false, message: error.message });
  });
};