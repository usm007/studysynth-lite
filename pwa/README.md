# StudySynth Lite — 100% Offline Android Progressive Web App (PWA)

A fully standalone, zero-network, zero-LLM competitive exam study workspace and deterministic question generation studio designed to run offline on Android phones/tablets and modern desktop browsers.

---

## 🚀 Key Features

1. **100% Offline Client-Side Generation:**
   - Pure client-side JavaScript engine ported from StudySynth Lite (`engine/generator.js`).
   - Extracts knowledge statements, balances distractor lengths (±15%), rotates answer keys, and synthesizes single-choice, distinction, and UPSC-style multi-statement MCQs in **<200 milliseconds** on mobile CPUs.
   - **Zero external API keys, zero network traffic, zero hallucination risk.**

2. **Offline Document Ingestion & Local OCR (`engine/pdfParser.js` & `engine/ocr.js`):**
   - Parses Markdown (`.md`), plain text (`.txt`), JSON, and standard selectable vector PDFs (`.pdf`) using native browser array buffers and `DecompressionStream('deflate')`.
   - **Local On-Device OCR:** Includes an in-browser Web Worker OCR engine with Otsu adaptive binarization to extract text from scanned PDFs and textbook camera photos (`.jpg`, `.png`, `.webp`) completely offline on Android.
   - Includes 1-click preloaded demos (SPM IAS Academy Newspaper Analysis 19 Oct 2026 and Chandrayaan-3 Mission notes).

3. **Android PWA Ready (`manifest.webmanifest` & `sw.js`):**
   - Service Worker precaches all app assets on initial load.
   - Installable on Android via Chrome/Firefox ("Add to Home Screen" / "Install App") into a full-screen standalone application.
   - Persists all generated quiz modules and test attempts offline in **IndexedDB** (`engine/storage.js`).

4. **Interactive Modes & A4 PDF Export:**
   - **Practice Mode:** Instant answer feedback and source citation explanation.
   - **Exam Mode:** Timed test simulation with question palette, bookmarking, and comprehensive analytics scorecard.
   - **Flashcards:** Active recall cards with tap-to-flip source citations.
   - **Print-Ready A4 Booklet Export:** Native CSS Paged Media `@media print` generates two-column question papers and answer keys directly through Android's system print dialog.

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
│   ├── pdfParser.js         # Client-side PDF text stream extractor
│   ├── ocr.js               # Client-side local OCR engine with Otsu pre-processing
│   └── storage.js           # IndexedDB & LocalStorage offline manager
├── vendor/
│   └── tesseract/          # Offline WASM and worker binaries
├── assets/
│   └── icon.svg             # Modern vector PWA app icon
└── tests/
    ├── test_engine.js       # Node.js unit tests for deterministic generator
    └── test_integration.js  # Integration tests for DOM bindings, SW cache, and manifest
```

---

## 🧪 Testing & Verification

Run the automated test suites using Node.js:

```powershell
# Unit tests for deterministic question generator
node studysynth-pwa/tests/test_engine.js

# Integration tests for PWA manifest, service worker cache, and DOM bindings
node studysynth-pwa/tests/test_integration.js
```

Both test suites execute with **0 failures and 0 errors**.

---

## 📱 Running on Android / Localhost

To serve and test locally:

```powershell
# Start local server from workspace
python -m http.server 8899 --directory studysynth-pwa
```

1. Open `http://localhost:8899/index.html` (or `http://<your-local-ip>:8899` on your Android device over Wi-Fi).
2. Tap the browser menu (⋮) -> **"Install app"** or **"Add to Home Screen"**.
3. Turn off Wi-Fi/Airplane mode — the app remains 100% operational offline!
