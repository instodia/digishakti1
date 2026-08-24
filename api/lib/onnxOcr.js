const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
let ort;
try {
  ort = require('onnxruntime-node');
} catch {
  ort = null;
}

const MODEL_PATH = path.join(__dirname, '..', '..', 'data', 'digishakti_captcha.onnx');
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const INT_TO_CHAR = {};
for (let i = 0; i < CHARS.length; i++) {
  INT_TO_CHAR[i + 1] = CHARS[i];
}

let sessionPromise = null;

async function getOnnxSession() {
  if (!ort || !fs.existsSync(MODEL_PATH)) return null;
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        const session = await ort.InferenceSession.create(MODEL_PATH);
        console.log('[ONNX] Custom DigiShakti neural network loaded successfully!');
        return session;
      } catch (err) {
        console.error('[ONNX] Failed to load model:', err.message);
        sessionPromise = null;
        return null;
      }
    })();
  }
  return sessionPromise;
}

async function preprocessForOnnx(buffer) {
  // Resize to 128x32 grayscale
  const rawData = await sharp(buffer)
    .resize(128, 32, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();

  // Create Float32Array normalized [-1.0, 1.0]
  const floatArray = new Float32Array(128 * 32);
  for (let i = 0; i < rawData.length; i++) {
    const val = rawData[i] / 255.0;
    floatArray[i] = (val - 0.5) / 0.5;
  }
  return new ort.Tensor('float32', floatArray, [1, 1, 32, 128]);
}

function ctcDecode(logitsData, dims) {
  // dims: [1, sequence_length (32), num_classes (37)]
  const seqLen = dims[1];
  const numClasses = dims[2];
  
  const rawIndices = [];
  for (let t = 0; t < seqLen; t++) {
    let maxIdx = 0;
    let maxVal = -Infinity;
    for (let c = 0; c < numClasses; c++) {
      const val = logitsData[t * numClasses + c];
      if (val > maxVal) {
        maxVal = val;
        maxIdx = c;
      }
    }
    rawIndices.push(maxIdx);
  }

  // CTC Greedy decoder: collapse duplicates & skip blank (0)
  let prev = -1;
  let text = '';
  for (const idx of rawIndices) {
    if (idx !== 0 && idx !== prev) {
      if (INT_TO_CHAR[idx]) {
        text += INT_TO_CHAR[idx];
      }
    }
    prev = idx;
  }
  return text;
}

async function solveWithCustomOnnx(imageBuffer) {
  try {
    const session = await getOnnxSession();
    if (!session) return null;

    const tensor = await preprocessForOnnx(imageBuffer);
    const results = await session.run({ input: tensor });

    const outputTensor = results.output || Object.values(results)[0];
    if (!outputTensor) return null;

    const decoded = ctcDecode(outputTensor.data, outputTensor.dims);
    const clean = decoded.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (clean.length >= 4 && clean.length <= 6) {
      return { text: clean, method: 'Custom Neural Network (ONNX)' };
    }
    return null;
  } catch (err) {
    console.error('[ONNX] Inference error:', err.message);
    return null;
  }
}

module.exports = { solveWithCustomOnnx, isModelAvailable: () => fs.existsSync(MODEL_PATH) };
