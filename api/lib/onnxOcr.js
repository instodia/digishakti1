const ort = require('onnxruntime-node');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MODEL_PATH = path.join(__dirname, '..', '..', 'data', 'digishakti_captcha.onnx');
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const INT_TO_CHAR = {};
for (let i = 0; i < CHARS.length; i++) {
  INT_TO_CHAR[i + 1] = CHARS[i];
}

let sessionPromise = null;

async function getSession() {
  if (!fs.existsSync(MODEL_PATH)) return null;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const session = await ort.InferenceSession.create(MODEL_PATH);
        return session;
      } catch (err) {
        console.error('Failed to load local ONNX session:', err.message);
        sessionPromise = null;
        return null;
      }
    })();
  }
  return sessionPromise;
}

async function solveWithONNX(imageBuffer) {
  try {
    const session = await getSession();
    if (!session) return null;

    const rawPixelBuffer = await sharp(imageBuffer)
      .resize(128, 32, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();

    const float32Data = new Float32Array(1 * 1 * 32 * 128);
    for (let i = 0; i < rawPixelBuffer.length; i++) {
      float32Data[i] = (rawPixelBuffer[i] / 255.0 - 0.5) / 0.5;
    }

    const tensor = new ort.Tensor('float32', float32Data, [1, 1, 32, 128]);
    const outputs = await session.run({ input: tensor });
    const outputTensor = outputs.output;
    const data = outputTensor.data;
    const dims = outputTensor.dims; // [1, W, 37]

    const width = dims[1];
    const numClasses = dims[2];

    let rawSequence = [];
    for (let w = 0; w < width; w++) {
      let maxIdx = 0;
      let maxVal = -Infinity;
      for (let c = 0; c < numClasses; c++) {
        const val = data[w * numClasses + c];
        if (val > maxVal) {
          maxVal = val;
          maxIdx = c;
        }
      }
      rawSequence.push(maxIdx);
    }

    let prev = -1;
    let text = '';
    for (const idx of rawSequence) {
      if (idx !== 0 && idx !== prev) {
        if (INT_TO_CHAR[idx]) text += INT_TO_CHAR[idx];
      }
      prev = idx;
    }

    const clean = text.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length >= 4 && clean.length <= 6) {
      return clean;
    }
    return null;
  } catch (err) {
    console.error('ONNX model inference error:', err.message);
    return null;
  }
}

module.exports = { solveWithONNX };
