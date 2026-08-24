const Tesseract = require('tesseract.js');

async function solveWithTesseract(imageBuffer, timeoutMs = 2500) {
  let timeoutId;
  const timeoutPromise = new Promise(resolve => {
    timeoutId = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });

  const ocrPromise = (async () => {
    let worker = null;
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        cachePath: '/tmp',
        logger: () => {}
      });
      
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      });

      const res = await worker.recognize(imageBuffer);
      await worker.terminate();

      const text = res.data?.text ? res.data.text.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

      if (text.length >= 4 && text.length <= 6) {
        return { text, confidence: res.data.confidence || 0 };
      }
      return null;
    } catch (err) {
      if (worker) {
        try { await worker.terminate(); } catch {}
      }
      return null;
    }
  })();

  const result = await Promise.race([ocrPromise, timeoutPromise]);
  clearTimeout(timeoutId);
  return result;
}

module.exports = { solveWithTesseract };
