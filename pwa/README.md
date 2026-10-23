# StudySynth Lite — 100% Offline Android Progressive Web App (PWA)

A fully standalone, zero-network, zero-LLM competitive exam study workspace and deterministic question generation studio designed to run offline on Android phones/tablets and modern desktop browsers.

> This PWA is the zero-LLM layer. The Python Lite skill uses one combined agent
> generation pass plus at most one repair pass; it is not a zero-LLM pipeline.

---

## 🚀 Key Features

1. **100% Offline Client-Side Generation:**
   - Pure client-side JavaScript engine ported from StudySynth Lite (`engine/generator.js`).
   - Extracts knowledge statements, balances distractor lengths (±15%), rotates answer keys, and synthesizes single-choice, distinction, and UPSC-style multi-statement MCQs in **<200 milliseconds** on mobile CPUs.
   - **Zero external API keys, zero network traffic, zero hallucination risk.**

2. **Offline Document Ingestion & Optional Local OCR (`engine/pdfParser.js` & `engine/ocr.js`):**
   - Parses Markdown (`.md`), plain text (`.txt`), JSON, and selectable PDFs (`.pdf`) with bundled PDF.js, falling back to a local stream extractor.
   - **Local On-Device OCR:** Includes an in-browser Web Worker OCR engine with Otsu adaptive binarization for scanned PDFs and textbook camera photos (`.jpg`, `.png`, `.webp`). OCR runs offline when the Tesseract runtime and English language data (`vendor/tesseract/eng.traineddata`) are present. Without that data file, the app reports a clear "OCR unavailable" message and text-based ingestion still works.
   - Includes 1-click preloaded demos (SPM IAS Academy Newspaper Analysis 19 Oct 2026 and Chandrayaan-3 Mission notes).

3. **Android PWA Ready (`manifest.webmanifest` & `sw.js`):**
   - Service Worker precaches all app assets on initial load.
   - Installable on Android via Chrome/Firefox ("Add to Home Screen" / "Install App") into a full-screen standalone application.
   - Persists all generated quiz modules and test attempts offline in **IndexedDB** (`engine/storage.js`).

4. **Library-First Modes & A4 PDF Export:**
   - **Library:** The default screen. It lists the bundled starter set and every saved set, and each card starts **Practice**, **Revision**, or **Exam Test** with one tap.
   - **Practice Mode:** Instant answer feedback and source citation explanation in the page flow below the options.
   - **Exam Mode:** A start screen selects the question count and time per question, then runs a countdown for `questions × time` with answered progress, bookmarking, persistent Previous/Next/Submit controls, +2.00/−0.66 marking, automatic submission at zero, and a scorecard with correct/wrong/skipped totals, review, attempt history, and retake. Results stay hidden until submission.
   - **Revision:** Active recall cards with tap-to-flip source citations.
   - **Single-surface quiz scroll:** The question, options, and answer explanation grow together. When content exceeds the viewport, the whole quiz page scrolls while Previous/Next/Submit stay pinned at the bottom; there is no nested answer or question scroll container.
   - **Print-Ready A4 Booklet Export:** Native CSS Paged Media `@media print` generates two-column question papers and answer keys directly through Android's system print dialog.

5. **Background Processing, Honest Progress & Crash Recovery:**
   - Document imports and question generation run as app-level jobs in a background Web Worker, so moving between Library, Practice, Revision, Exam, and Generator never cancels or restarts them.
   - One reusable dialog shows the real stage, a determinate bar only when the source supplies real measurements (PDF pages, Tesseract recognition ratio), and an explicit indeterminate state otherwise. It can be minimised to a persistent shell indicator and reopened.
   - Source text/file and bounded page checkpoints are stored once in IndexedDB. After a tab close, app kill, or crash, the interrupted job is detected on launch and resumed from the latest valid checkpoint; a missing checkpoint is explained rather than silently retried.
   - Cancellation stops at a safe boundary, terminates the worker, keeps the typed text and existing modules, and never saves a partial module.

6. **Responsive Shell & Material 3 Icons:**
   - Docked sidebar on tablets and desktops; slide-out drawer with backdrop, Escape handling, and focus restoration on compact screens.
   - Material Symbols Rounded icon subset bundled under `assets/material/` with its Apache 2.0 license. No emoji UI icons and no remote icon font requests.
   - Safe-area padding, reduced-motion support, visible focus states, and light/dark themes.

> Icon attribution: Material Symbols Rounded, Copyright Google, licensed under the
> Apache License 2.0. The full license text ships at
> `assets/material/LICENSE.txt`.

---

## 📁 Directory Structure

```
studysynth-pwa/
├── index.html               # Main PWA application shell & UI
├── styles.css               # Glassmorphic responsive styling & @media print A4 booklet CSS
├── app.js                   # Application controller & state management
├── sample_data.js           # Preloaded offline study materials
├── sw.js                    # Service worker implementing Cache-First offline strategy
├── manifest.webmanifest     # Android PWA install configuration
├── engine/
│   ├── generator.js         # Deterministic question generator & 11-D quality validator
│   ├── analyze.js           # Shared analysis orchestration used by the page and worker
│   ├── worker.js            # Background generation worker
│   ├── jobs.js              # Job lifecycle, cancellation, checkpoints, recovery
│   ├── pdfParser.js         # Client-side PDF text stream extractor
│   ├── ocr.js               # Client-side local OCR engine with Otsu pre-processing
│   └── storage.js           # IndexedDB & LocalStorage offline manager
├── vendor/
│   ├── pdfjs/               # Bundled offline PDF.js runtime and worker
│   └── tesseract/           # Offline WASM, worker, and eng.traineddata
├── assets/
│   ├── icon.svg             # Modern vector PWA app icon
│   ├── icon-192.png         # Android launcher icon
│   ├── icon-512.png         # Android launcher / splash icon
│   └── material/            # Material Symbols Rounded subset + Apache 2.0 license
└── tests/
    ├── test_engine.js       # Node.js unit tests for deterministic generator
    ├── test_integration.js  # Integration tests for DOM bindings, SW cache, and manifest
    └── test_processing.js   # Job lifecycle, progress, cancellation, and recovery tests
```

---

## 🧪 Testing & Verification

Run the automated test suites using Node.js:

```powershell
# All suites: engine, integration/contracts, and processing jobs
npm test --prefix pwa

# Or individually
node pwa/tests/test_engine.js
node pwa/tests/test_integration.js
node pwa/tests/test_processing.js
```

All three suites execute with **0 failures and 0 errors**. `test_processing.js`
covers navigation-safe continuation, accurate and indeterminate progress, stale
worker rejection, cancellation, checkpoint persistence, resume, missing
checkpoints, quota failure, and the guarantee that no partial module is saved.

---

## 📱 Running on Android / Localhost

To serve and test locally:

```powershell
# Start local server from the repository root
python -m http.server 8899 --directory pwa
```

1. Open `http://localhost:8899/index.html` (or `http://<your-local-ip>:8899` on your Android device over Wi-Fi).
2. Tap the browser menu (⋮) -> **"Install app"** or **"Add to Home Screen"**.
3. Turn off Wi-Fi/Airplane mode — the app remains 100% operational offline!

### Native APK

The repository root contains a Capacitor Android project. From the root:

```powershell
npm install
npm run android:sync
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.
A verified copy is kept at `output/StudySynth-v1.0-debug.apk`. It packages the same
zero-network web payload and does not register a service worker.
