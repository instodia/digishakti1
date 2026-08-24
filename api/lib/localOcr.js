const Tesseract = require('tesseract.js');
const sharp = require('sharp');

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        });
        return worker;
      } catch (err) {
        console.error('Failed to initialize local Tesseract worker:', err.message);
        workerPromise = null;
        return null;
      }
    })();
  }
  return workerPromise;
}

async function preprocessImage(imageBuffer) {
  try {
    return await sharp(imageBuffer)
      .resize(420, 112)
      .grayscale()
      .median(3)
      .threshold(145)
      .toBuffer();
  } catch {
    return imageBuffer;
  }
}

async function solveWithTesseract(imageBuffer) {
  try {
    const worker = await getWorker();
    if (!worker) return null;

    // Apply sharp pre-processing to remove background noise & enhance contrast
    const cleanedBuffer = await preprocessImage(imageBuffer);
    const res = await worker.recognize(cleanedBuffer);
    const text = res.data.text ? res.data.text.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

    if (text.length >= 4 && text.length <= 6) {
      return { text, confidence: res.data.confidence || 0 };
    }
    return null;
  } catch (err) {
    console.error('Tesseract local OCR error:', err.message);
    return null;
  }
}

module.exports = { solveWithTesseract };
