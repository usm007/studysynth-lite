# StudySynth Lite & Offline Android PWA

> **A Lightweight, Deterministic, 100% Offline Competitive Study Workspace, MCQ Generator, and Android PWA.**

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20PWA-10b981?logo=vercel)](https://studysynth-pwa.vercel.app)
[![Zero-LLM Offline](https://img.shields.io/badge/Engine-Deterministic%20Zero--LLM-3943d3)](#)
[![Android PWA](https://img.shields.io/badge/Platform-Android%20%7C%20Web%20PWA-6366f1)](#)

---

## 🌟 Overview

StudySynth Lite delivers the full capabilities of the competitive study quiz workspace with **dramatically reduced intermediate processing, lower token consumption, zero hallucination risk, and instantaneous sub-second execution**.

It is delivered in two complementary editions:

1. **Python CLI Pipeline (`scripts/pipeline_lite.py`):**
   - High-throughput desktop runner for batch processing textbooks, PDF notes, and syllabus packages into interactive HTML workspaces and print-ready dual-column A4 test booklets.
2. **Offline Android PWA (`pwa/`):**
   - 100% client-side Progressive Web App running directly in mobile Chrome/Firefox on Android.
   - Hosted live on Vercel: [https://studysynth-pwa.vercel.app](https://studysynth-pwa.vercel.app).
   - Installable to the Android Home Screen with zero external network or API dependencies.

---

## 🚀 Key Features

### 1. Deterministic Question Engine
- **Zero Hallucination Risk:** Every factual MCQ, relationship distinction, and multi-statement UPSC-style question is deterministically derived from verified text anchors in the source document.
- **11-Dimension Quality Compliance:** Balanced distractor lengths (±15% rule to eliminate answer-length leaks), rotated answer keys (`A`, `B`, `C`, `D`), and explicit distractor purpose mappings.
- **Sub-Second Execution:** Completes full knowledge extraction and quiz synthesis in **<200 milliseconds** on mobile CPUs and **~1.5 seconds** on desktop Python.

### 2. Multi-Mode Study Workspace
- **💡 Practice Mode:** Instant feedback with comprehensive source citations and explanations.
- **⏱️ Exam Mode:** Realistic exam timer, negative marking simulation, and complete scorecard analytics.
- **📇 Revision Flashcards:** Active recall cards with tap-to-flip explanations.
- **🖨️ Print-Ready A4 Booklet Export:** Dual-column question papers, answer keys, and explanations via browser print / ReportLab.

### 3. Local On-Device Ingestion & OCR
- Native parsing of `.pdf`, `.docx`, `.md`, `.txt`, and `.json`.
- In-browser local OCR engine (`pwa/engine/ocr.js`) using WebAssembly and Otsu adaptive binarization to extract text from physical textbook photos and low-contrast scanned notes.

---

## 📁 Repository Structure

```
studysynth-lite/
├── SKILL.md                 # Lite Skill specification & operating instructions
├── prompts/
│   └── lite-generate.md     # Compact single-pass model prompt (<80 lines)
├── scripts/
│   ├── generate_lite.py     # Deterministic knowledge extractor & MCQ synthesizer
│   ├── pipeline_lite.py     # Fast 6-stage CLI coordinator (also aliased as pipeline.py)
│   ├── quality.py           # 11-dimension question quality scoring engine
│   ├── validate_questions.py# Structural & schema validation rules
│   └── ...                  # Ingest, anchors, package, and render modules
├── pwa/                     # 100% Offline Android Progressive Web App
│   ├── index.html           # Main PWA application shell
│   ├── styles.css           # Responsive design system matching original StudySynth
│   ├── app.js               # Client controller & PWA lifecycle manager
│   ├── manifest.webmanifest # Android PWA manifest (standalone, adaptive icons)
│   ├── sw.js                # Bulletproof Service Worker (Cache-First offline strategy)
│   ├── engine/              # Client-side generator, PDF parser, OCR, & IndexedDB storage
│   └── assets/              # Icons and brand logo
├── profiles/                # Exam profiles (UPSC, State PSCs, CBSE, Corporate)
├── templates/               # HTML study workspace & PDF booklet templates
└── tests/                   # Automated pytest and Node.js test suites
```

---

## 💻 Quickstart (Python CLI)

```bash
# Clone the repository
git clone https://github.com/usm007/studysynth-lite.git
cd studysynth-lite

# Generate complete study package from a document
python scripts/pipeline_lite.py --source examples/my_notes.pdf --out-dir build/my_test

# Run tests
pytest tests/test_skill_lite.py
```

---

## 📱 Quickstart (Android PWA)

1. Open the live app on your phone: [https://studysynth-pwa.vercel.app](https://studysynth-pwa.vercel.app)
2. Tap the **"📲 Install App"** badge in the top bar (or browser menu ⋮ -> **"Install app"** / **"Add to Home Screen"**).
3. Switch on Airplane mode — StudySynth runs 100% offline with full persistence in IndexedDB!

---

## 📜 License

MIT License. Designed and engineered for high-performance competitive study preparation.
