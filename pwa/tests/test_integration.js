/**
 * StudySynth Lite PWA Integration & Contract Test
 * Verifies DOM element bindings, event contracts, generator outputs, and offline data schemas.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Running StudySynth Lite PWA Integration & Contract Tests ---');

// 1. Read files
const pwaDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(pwaDir, 'index.html'), 'utf-8');
const appJs = fs.readFileSync(path.join(pwaDir, 'app.js'), 'utf-8');
const manifest = JSON.parse(fs.readFileSync(path.join(pwaDir, 'manifest.webmanifest'), 'utf-8'));
const sw = fs.readFileSync(path.join(pwaDir, 'sw.js'), 'utf-8');

// 2. Test Manifest Integrity
console.log('[Test 1] Testing Web App Manifest for Android PWA...');
assert.strictEqual(manifest.display, 'standalone', 'PWA display must be standalone');
assert(manifest.start_url.includes('standalone'), 'start_url must point to standalone mode');
assert(manifest.icons && manifest.icons.length > 0, 'PWA must declare icons');
console.log('  ✓ Manifest is valid for Android PWA installation.');

// 3. Test Service Worker precache list
console.log('[Test 2] Verifying Service Worker precache files...');
const precachedFiles = [
  'index.html', 'styles.css', 'app.js', 'sample_data.js',
  'engine/generator.js', 'engine/pdfParser.js', 'engine/ocr.js', 'engine/storage.js',
  'manifest.webmanifest', 'assets/logo.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/favicon.png', 'assets/apple-touch-icon.png'
];
for (const file of precachedFiles) {
  assert(sw.includes(file), `Service worker must cache ${file}`);
  const diskPath = path.join(pwaDir, file);
  assert(fs.existsSync(diskPath), `Precached file must exist on disk: ${file}`);
}
console.log(`  ✓ All ${precachedFiles.length} precached assets exist on disk and are declared in sw.js.`);

// 4. Test DOM IDs referenced in app.js exist in index.html
console.log('[Test 3] Verifying DOM element bindings between index.html and app.js...');
const idMatches = appJs.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g);
const missingIds = [];
for (const match of idMatches) {
  const id = match[1];
  const regex = new RegExp(`id=["']${id}["']`);
  if (!regex.test(html) && !['btn-review', 'btn-restart'].includes(id)) { // dynamically rendered
    missingIds.push(id);
  }
}
assert.strictEqual(missingIds.length, 0, `Missing DOM element IDs in index.html: ${missingIds.join(', ')}`);
console.log('  ✓ All DOM references in app.js correctly bind to elements in index.html.');

// 5. Test Engine Multilingual & Scientific Ingestion
console.log('[Test 4] Testing Engine on Science & Tech sample...');
const Engine = require('../engine/generator.js');
const SampleData = require('../sample_data.js');

const sciSections = Engine.parseRawDocument(global.StudySamples.science_space, 'Chandrayaan-3');
const sciInv = Engine.buildKnowledgeInventory(sciSections);
const sciBank = Engine.generateQuestionBank(sciInv, { targetCount: 8 });
const sciVal = Engine.validateQuestionBank(sciBank);

assert(sciBank.length >= 5, 'Should generate at least 5 science questions');
assert.strictEqual(sciVal.valid, true, 'Science questions should pass all validation rules');
console.log('[Test 5] Verifying Local OCR module integration...');
const LocalOCR = require('../engine/ocr.js');
assert(typeof LocalOCR.preprocessCanvas === 'function', 'LocalOCR must export preprocessCanvas');
assert(typeof LocalOCR.recognizeImage === 'function', 'LocalOCR must export recognizeImage');
assert(typeof LocalOCR.recognizeFile === 'function', 'LocalOCR must export recognizeFile');
console.log('  ✓ Local OCR engine exports verified successfully.');

console.log('\n=============================================');
console.log('ALL INTEGRATION & CONTRACT TESTS PASSED (0 ERRORS)');
console.log('=============================================\n');
