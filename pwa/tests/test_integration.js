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
const jobsJs = fs.readFileSync(path.join(pwaDir, 'engine', 'jobs.js'), 'utf-8');
const workerJs = fs.readFileSync(path.join(pwaDir, 'engine', 'worker.js'), 'utf-8');
const analyzeJs = fs.readFileSync(path.join(pwaDir, 'engine', 'analyze.js'), 'utf-8');
const manifest = JSON.parse(fs.readFileSync(path.join(pwaDir, 'manifest.webmanifest'), 'utf-8'));
const sw = fs.readFileSync(path.join(pwaDir, 'sw.js'), 'utf-8');

// 2. Test Manifest Integrity
console.log('[Test 1] Testing Web App Manifest for Android PWA...');
assert.strictEqual(manifest.display, 'standalone', 'PWA display must be standalone');
assert.strictEqual(manifest.start_url, './?mode=standalone', 'start_url must be relative and open standalone mode');
assert.strictEqual(manifest.scope, './', 'PWA scope must be relative for sub-path hosting');
assert.strictEqual(manifest.orientation, 'any', 'PWA must support portrait and landscape');
assert.strictEqual(manifest.prefer_related_applications, false, 'PWA must prefer the web app');
assert(Array.isArray(manifest.display_override) && manifest.display_override.includes('standalone'), 'display_override must include standalone');
assert(manifest.icons && manifest.icons.filter(i => i.purpose === 'maskable').length >= 2, 'PWA must declare maskable icons');
assert(manifest.icons.every(i => i.src.startsWith('./')), 'Manifest icon paths must be relative');
assert(manifest.theme_color && manifest.background_color, 'PWA must declare theme and background colors');
console.log('  ✓ Manifest is valid for Android PWA installation.');

// 3. Test Service Worker precache list
console.log('[Test 2] Verifying Service Worker precache files...');
const precachedFiles = [
  'index.html', 'styles.css', 'app.js', 'sample_data.js',
  'engine/generator.js', 'engine/analyze.js', 'engine/pdfParser.js', 'engine/ocr.js',
  'engine/storage.js', 'engine/jobs.js', 'engine/worker.js',
  'manifest.webmanifest', 'assets/logo.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'assets/favicon.png', 'assets/apple-touch-icon.png',
  'assets/material/material-symbols-rounded-subset.woff2',
  'vendor/pdfjs/pdf.mjs', 'vendor/pdfjs/pdf.worker.mjs',
  'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  'vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  'vendor/tesseract/tesseract-core-simd-lstm.wasm',
  'vendor/tesseract/eng.traineddata'
];
for (const file of precachedFiles) {
  assert(sw.includes(file), `Service worker must cache ${file}`);
  const diskPath = path.join(pwaDir, file);
  assert(fs.existsSync(diskPath), `Precached file must exist on disk: ${file}`);
}
assert(/CACHE_NAME\s*=\s*['"]studysynth-v\d+['"]/.test(sw), 'Service worker must version its cache');
assert(!/https?:\/\//.test(sw), 'Service worker asset list must not depend on remote URLs');
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

// 4b. Responsive shell, sidebar, Library-first, and exam scorecard contract
console.log('[Test 3b] Verifying sidebar, Library-first, single-page quiz scroll, and scorecard bindings...');
const css = fs.readFileSync(path.join(pwaDir, 'styles.css'), 'utf-8');
assert(/env\(safe-area-inset-bottom/.test(css), 'CSS must respect device safe areas');
assert(/@media \(max-width:\s*860px\)/.test(css), 'CSS must define a phone/tablet sidebar breakpoint');
assert(/@media \(max-height:\s*520px\) and \(max-width:\s*900px\)/.test(css), 'CSS must define a short-landscape layout');
assert(/prefers-reduced-motion:\s*reduce/.test(css), 'CSS must respect reduced-motion preferences');
assert(/\.rail\s*\{[^}]*position:\s*fixed/s.test(css), 'The compact sidebar must be an overlay');
assert(/\.rail\s*\{[^}]*transform:\s*translateX\(-10[04]%\)/s.test(css), 'The compact sidebar must start off-canvas');
assert(/body\.nav-open \.rail\s*\{\s*transform:\s*translateX\(0\)/.test(css), 'The sidebar must slide in for compact screens');
assert(/\.nav-toggle\s*\{[^}]*display:\s*(inline-flex|block)/s.test(css), 'Phones and tablets must expose a sidebar toggle');
assert(/\.nav-backdrop/.test(css), 'An overlay backdrop must close the compact sidebar');
assert(!/inset:\s*auto 0 0 0/.test(css), 'Bottom navigation must not be used');
assert(/@font-face/.test(css) && /assets\/material\/material-symbols-rounded-subset\.woff2/.test(css), 'Icons must use the bundled Material Symbols Rounded font');
assert(fs.existsSync(path.join(pwaDir, 'assets/material/material-symbols-rounded-subset.woff2')), 'Material Symbols icon font must be bundled locally');
assert(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html), 'Interface icons must not use emoji');
assert(/<body data-mode="library">/.test(html), 'Library must be the default document mode');
assert(/switchMode\('library'\)/.test(appJs), 'The app must open on the Library');
assert(/data-mode="library"/.test(html) && html.indexOf('data-mode="library"') < html.indexOf('data-mode="practice"'), 'Library must lead the sidebar navigation');
assert(/data-action="practice"/.test(appJs) && /data-action="revision"/.test(appJs) && /data-action="test"/.test(appJs), 'Each Library card must expose Practice, Revision, and Test actions');
assert(/\.workspace\s*\{[^}]*overflow-y:\s*auto/s.test(css), 'The workspace must provide the single page scroll');
assert(/\.sheet-body\s*\{[^}]*overflow:\s*visible/s.test(css), 'The quiz sheet must not create a nested scroll container');
assert(/\.question-content\s*\{[^}]*overflow:\s*visible/s.test(css), 'Question content must grow with the page');
assert(/\.answer-panel\s*\{[^}]*overflow:\s*visible/s.test(css), 'Answer explanations must grow with the page instead of scrolling in a container');
assert(/id=["']answerPanel["']/.test(html), 'Answers need a dedicated, non-scrolling explanation panel');
assert(/\.actions\s*\{[^}]*flex:\s*none/s.test(css) && /\.actions\s*\{[^}]*position:\s*sticky/s.test(css), 'Quiz controls must stay visible while the page scrolls');
assert(/class="exam-answered"/.test(html), 'Test mode must show answered progress');
assert(/id=["']testSetup["']/.test(html) && /id=["']testQuestionCount["']/.test(html) && /id=["']testSecondsPerQuestion["']/.test(html) && /id=["']testStartBtn["']/.test(html), 'Test mode must expose a start screen with question count and time per question');
assert(/function startTest\s*\(/.test(appJs) && /testDurationSeconds/.test(appJs) && /testEndsAt/.test(appJs), 'Starting a test must create a timed countdown');
assert(/function completeTest\s*\(/.test(appJs) && /remaining <= 0/.test(appJs) && /completeTest\(\)/.test(appJs), 'The test countdown must auto-submit when time expires');
assert(/#quizView\.is-test-setup\s*>\s*:not\(#testSetup\)/.test(css) && /body\[data-test-setup=["']true["']\]\s*\.livebar/.test(css), 'The test start screen must replace the quiz runner and analytics rail');
for (const id of ['scoreModal', 'scoreTitle', 'scoreMax', 'scoreBand', 'scoreCorrect', 'scoreWrong', 'scoreSkipped', 'scoreTime', 'scoreReviewBtn', 'scoreRetakeBtn', 'scoreCloseBtn', 'examSubmitBtn']) {
  assert(new RegExp(`id=["']${id}["']`).test(html), `Scorecard must expose #${id}`);
}
assert(/\+2\.00/.test(html) && /−0\.66|&minus;0\.66/.test(html), 'Scorecard copy must disclose negative marking');
assert((html.match(/aria-label="With love, usm007"/g) || []).length >= 2, 'Credit must appear on desktop and compact layouts');
assert(/localStorage|indexedDB/i.test(appJs), 'Exam attempts must persist locally');
const mainActivity = fs.readFileSync(
  path.join(pwaDir, '..', 'android/app/src/main/java/com/usm007/studysynth/MainActivity.java'),
  'utf-8'
);
assert(/window\.__studysynthBack/.test(appJs), 'The PWA must expose an Android hardware-back handler');
assert(/window\.__studysynthBack/.test(mainActivity), 'The Android back dispatcher must call the PWA back handler');
console.log('  ✓ Sidebar/Library/single-page-scroll/scorecard/credit contracts verified.');

// 5. Test Engine Multilingual & Scientific Ingestion
console.log('[Test 4] Testing source-verified Engine on Science & Tech sample...');
const Engine = require('../engine/generator.js');
require('../sample_data.js');

const sciSections = Engine.parseRawDocument(global.StudySamples.science_space, 'Chandrayaan-3');
const sciExtracted = Engine.extractSourceFacts(sciSections);
const sciConflicts = Engine.detectFactConflicts(sciExtracted);
const sciInv = Engine.buildKnowledgeInventory(sciSections, {
  facts: sciConflicts.facts,
  conflicts: sciConflicts.conflicts
});
const sciBank = Engine.generateQuestionBank(sciInv, {
  targetCount: 8,
  facts: sciConflicts.facts,
  conflicts: sciConflicts.conflicts,
  sections: sciSections
});
const sciVal = Engine.validateQuestionBank(sciBank, {
  facts: sciConflicts.facts,
  sections: sciSections,
  candidateCount: sciBank.generation.totalCandidates,
  rejectionCounts: sciBank.generation.rejectionCounts
});

assert(sciBank.length >= 5, 'Should generate at least 5 science questions');
assert.strictEqual(sciVal.valid, true, 'Science questions should pass all validation rules');
assert.strictEqual(sciVal.accepted, sciBank.length, 'Validation must accept every published science question');
assert(sciVal.rejected >= 0, 'Validation must report rejected candidates');
assert(sciBank.generation.factCount >= sciBank.length, 'Every question must come from the extracted fact pool');
for (const question of sciBank) {
  assert(['single_choice', 'multi_statement'].includes(question.type), 'Published questions must use an existing renderer contract');
  assert(Array.isArray(question.options) && question.options.length === 4, 'Every question must have four options');
  assert(question.options.filter((option) => option.is_correct).length === 1, 'Every question must have exactly one correct option');
  assert(question.options.some((option) => option.key === question.answer_key && option.is_correct), 'answer_key must point to the correct option');
  assert(question.expected_answer, 'Published questions must record the verified expected answer');
  assert(question.evidence && question.evidence.fact_ids.length, 'Published questions must retain evidence metadata');
  assert(question.supporting_excerpt && question.explanation.includes(question.supporting_excerpt), 'Explanations must quote the source evidence');
}
console.log(`  ✓ ${sciBank.length} source-verified science questions published from ${sciInv.length} knowledge units.`);

console.log('[Test 5] Verifying Local OCR and detailed file metadata...');
const LocalOCR = require('../engine/ocr.js');
const OfflineDocParser = require('../engine/pdfParser.js');
assert(typeof LocalOCR.preprocessCanvas === 'function', 'LocalOCR must export preprocessCanvas');
assert(typeof LocalOCR.recognizeImage === 'function', 'LocalOCR must export recognizeImage');
assert(typeof LocalOCR.recognizeFile === 'function', 'LocalOCR must export recognizeFile');
assert(typeof OfflineDocParser.readFileContentDetailed === 'function', 'The file reader must expose source origin and OCR confidence');
assert(typeof OfflineDocParser.readFileContent === 'function', 'The string file reader must remain backward compatible');
assert(/NO_VERIFIED_QUESTIONS/.test(jobsJs), 'The job manager must distinguish verified generation from a revision-only result');
assert(/readFileContentDetailed/.test(appJs), 'The app must use OCR confidence metadata');
assert(/lowConfidence/.test(appJs) && /confirmed/.test(appJs), 'The app must require confirmation or correction for low-confidence OCR');
assert(/revisionOnly/.test(appJs) && /Revision only/.test(appJs), 'The Library must mark revision-only sets');
assert(/disabled aria-disabled/.test(appJs), 'Revision-only sets must disable Practice and Exam Test actions');
assert(/\.lib-mode:disabled/.test(css), 'Revision-only actions must be visually disabled');
console.log('  ✓ Local OCR, file-source metadata, low-confidence confirmation, and revision-only contracts verified.');

console.log('[Test 6] Verifying background processing contracts...');
// The dialog is a single reusable surface with an explicit minimizable shell indicator.
['processModal', 'processTitle', 'processMessage', 'processTrack', 'processBar',
  'processCount', 'processPct', 'processStages', 'processMinimizeBtn', 'processCancelBtn',
  'processResumeBtn', 'processRetryBtn', 'processOpenBtn', 'processDiscardBtn',
  'processCloseBtn', 'processChip', 'processLive'].forEach((id) => {
  assert(new RegExp(`id="${id}"`).test(html), `index.html must contain #${id}`);
});
assert(/aria-modal="true"/.test(html), 'The processing dialog must be modal while expanded');
assert(/engine\/worker\.js/.test(sw), 'The generation worker must be precached for offline use');
assert(/engine\/analyze\.js/.test(sw), 'The shared analysis module must be precached');
assert(/engine\/jobs\.js/.test(sw), 'The job manager must be precached');
assert(/new URL\('\.\/engine\/worker\.js', document\.baseURI\)/.test(appJs), 'The worker must resolve relative to the app base URL');
assert(/Worker\(/.test(appJs) && /studysynth-generator/.test(appJs), 'Generation must run in a named worker');
assert(/importScripts\('\.\/generator\.js', '\.\/analyze\.js'\)/.test(workerJs), 'The worker must reuse the real engine and shared analysis');
assert(/startGeneration/.test(appJs) && /startImport/.test(appJs), 'The app must start jobs through the manager');
assert(/Processing\.isBusy\(\)/.test(appJs), 'Duplicate processing must be rejected');
assert(!/analyzeSource\(text, title, sourceMeta, 15\)/.test(appJs), 'The page must not run generation synchronously');
assert(/NO_VERIFIED_QUESTIONS/.test(jobsJs) && /revisionOnly/.test(jobsJs), 'The manager must preserve revision-only completion');
assert(/checkpoint\.module/.test(jobsJs), 'A module must be checkpointed before the final write');
assert(/SAVE_FAILED/.test(jobsJs), 'Write failures must be handled explicitly');
assert(/visibilitychange/.test(appJs) && !/visibilitychange[\s\S]{0,400}\.cancel\(/.test(appJs), 'Becoming visible must not cancel processing');
assert(/listInterrupted/.test(appJs) && /resumeRecovery/.test(appJs), 'Interrupted jobs must be offered for recovery');
assert(/process-track\.is-indeterminate/.test(css), 'Indeterminate stages need a distinct visual state');
assert(/prefers-reduced-motion: reduce/.test(css) && /\.process-track\.is-indeterminate/.test(css), 'Motion must respect reduced-motion preferences');
assert(/safe-bottom/.test(css) && /\.process-chip/.test(css), 'The shell indicator must respect safe areas');
const switchBody = (appJs.match(/function switchMode\(mode\) \{([\s\S]*?)\n  \}/) || [])[1] || '';
assert(!/Processing\.(cancel|dismiss)/.test(switchBody), 'Changing screens must not cancel or dismiss a job');
console.log('  ✓ Worker isolation, single dialog, persistent indicator, recovery, and navigation contracts verified.');

console.log('\n=============================================');
console.log('ALL INTEGRATION & CONTRACT TESTS PASSED (0 ERRORS)');
console.log('=============================================\n');
