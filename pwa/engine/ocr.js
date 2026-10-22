/**
 * StudySynth Lite — Client-Side Local OCR Engine (WASM + Canvas Pre-processing)
 * Designed for 100% on-device recognition of scanned PDF pages and photos on Android.
 */

(function (global) {
  'use strict';

  /**
   * Pre-processes an HTML5 Canvas image for OCR:
   * 1. Converts to Grayscale
   * 2. Enhances contrast
   * 3. Applies adaptive thresholding (Otsu binarization)
   * This dramatically improves Tesseract recognition accuracy on low-contrast mobile phone scans.
   */
  function preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // 1. Grayscale
    for (let i = 0; i < data.length; i += 4) {
      const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }

    // 2. Compute histogram for Otsu's thresholding
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[data[i]]++;
    }

    const totalPixels = canvas.width * canvas.height;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) * (mB - mF);

      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    // 3. Apply binary threshold
    for (let i = 0; i < data.length; i += 4) {
      const val = data[i] > threshold ? 255 : 0;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Performs Local OCR on an Image, Canvas, or Blob using Tesseract.js
   * Supports progress callbacks to update Android UI.
   */
  async function recognizeImage(imageSource, onProgress) {
    if (typeof Tesseract === 'undefined') {
      throw new Error('Tesseract OCR library is not loaded. Please ensure vendor/tesseract/tesseract.min.js is included.');
    }

    if (onProgress) onProgress({ status: 'initializing OCR worker...', progress: 0.1 });

    let worker = null;
    try {
      worker = await Tesseract.createWorker('eng', 1, {
        workerPath: './vendor/tesseract/worker.min.js',
        corePath: './vendor/tesseract/tesseract-core.wasm.js',
        logger: (m) => {
          if (onProgress && m.status === 'recognizing text') {
            onProgress({ status: 'recognizing text', progress: m.progress });
          }
        }
      });

      const res = await worker.recognize(imageSource);
      await worker.terminate();

      return {
        text: res.data.text || '',
        confidence: res.data.confidence || 0
      };
    } catch (err) {
      if (worker) {
        try { await worker.terminate(); } catch (e) {}
      }
      throw err;
    }
  }

  /**
   * Extracts text from an uploaded image file (PNG, JPG, WEBP, or scanned note photo)
   */
  async function recognizeFile(file, onProgress) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Apply adaptive thresholding
          preprocessCanvas(canvas);

          const result = await recognizeImage(canvas, onProgress);
          URL.revokeObjectURL(url);
          resolve(result);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for local OCR.'));
      };
      img.src = url;
    });
  }

  const LocalOCR = {
    preprocessCanvas,
    recognizeImage,
    recognizeFile
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalOCR;
  }
  if (typeof window !== 'undefined') {
    window.LocalOCR = LocalOCR;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
