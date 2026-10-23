# StudySynth Lite

**A faster competitive-exam study pipeline, plus a fully offline Android PWA.**

StudySynth Lite keeps the same output contract as the full StudySynth pipeline — a
validated question bank, a standalone HTML study workspace, print-ready A/B/C PDFs, a
dashboard, and a coverage gate — while using far fewer AI passes.

## Three execution layers

| Layer | AI use | What it is for |
|---|---|---|
| **Full Python skill** | Many AI passes: extraction, design, generation, review, gap-fill | Maximum depth and coverage |
| **Lite Python skill** | **One combined AI generation pass**, plus at most **one targeted repair pass** | Fast, cheaper end-to-end packages |
| **Mobile PWA** | **Zero AI, zero network, fully deterministic** | Offline practice on an Android phone |

The deterministic rule-based question engine is the **PWA engine** and a test-fixture
generator. It is not the default Lite Python generation path.

## What Lite Python does

1. **Prepare** — deterministic ingestion and anchor extraction.
2. **Hand off** — stop with `lite_handoff.json` and ask for the single combined agent pass.
3. **Generate** — the agent reads `prompts/lite-generate.md` once and writes:
   - `knowledge_inventory.json`
   - `question_bank.json`
4. **Validate** — deterministic schema checks, quality scoring, duplicate detection,
   anchor recall, coverage, audit, and gate.
5. **Repair once (optional)** — if specific questions fail, repair only those items.
6. **Package** — `quiz_package.json`, standalone HTML, A/B/C PDFs, dashboard, and
   delivery files.

There is no multi-round gap-fill loop and no expensive blind-review pass.

## Quickstart (Lite Python)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Prepare the source and get the agent handoff
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --run-id my_run \
  --build-dir build \
  --full
```

The first run stops after preparation and prints the prompt, the two output paths, and
the exact rerun command. It does **not** silently generate a bank.

```bash
# 3. Run prompts/lite-generate.md once as the agent.
#    Write the two files, then record the pass:
python scripts/record_lite_pass.py \
  --run-dir build/my_run \
  --stage lite_generate \
  --pass-number 1

# 4. Rerun with the generated files (use the command printed by step 2)
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --inventory build/my_run/knowledge_inventory.json \
  --bank build/my_run/question_bank.json \
  --run-id my_run \
  --build-dir build \
  --full
```

If validation rejects items, `repair_queue.json` lists only those items. Repair them,
record one `lite_repair` pass, and rerun. Do not run a second repair round.

### Using an existing bank

```bash
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --inventory examples/sample_inventory.json \
  --bank examples/question_bank_apsc.json \
  --run-id supplied \
  --build-dir build \
  --full
```

A bank supplied directly, with no Lite handoff, reports `model_calls: 0`. If a run has a
`lite_handoff.json` but no `llm_trace.jsonl`, metrics report the count as unavailable
rather than guessing zero. A `PARTIAL` gate means the bank does not cover every knowledge
unit or cognitive form; it does not mean packaging failed.

### Offline/demo engine

For tests, demos, and PWA parity fixtures only:

```bash
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --run-id offline_demo \
  --build-dir build \
  --full \
  --offline-engine
```

This explicitly uses the deterministic engine and reports zero model calls.

## Quickstart (Android PWA)

1. Open the live app: [https://studysynth-pwa.vercel.app](https://studysynth-pwa.vercel.app)
2. Install it from the browser menu (**Install app** / **Add to Home Screen**).
3. Switch on Airplane mode. The app continues to work offline with local storage.

The PWA opens on a **Library** that lists every saved set on the device.
Each card exposes **Practice**, **Revision**, and **Exam Test** directly, so a saved PDF
or note set is one tap away from the right study mode. On phones and compact tablets the
navigation is a slide-out sidebar; on larger screens it stays docked. The quiz keeps the
question and all options compact, then lets answer explanations flow into the same surface.
When the page grows, it scrolls as one page while Previous/Next/Submit stay pinned at the
bottom. Iconography is a locally bundled Material
Symbols Rounded subset, so the interface uses Material 3 expressive icons and never asks
for a remote icon font.

The PWA parses text, Markdown, JSON, and text-layer PDFs locally. It bundles PDF.js for
selectable PDFs and Tesseract for optional on-device OCR. If the OCR language data is
missing, the app reports that OCR is unavailable and text-based ingestion still works.

### Native Android APK (Capacitor)

```bash
npm install
npm run android:sync      # builds www/ from pwa/ and syncs the Android project
npm run android:apk       # writes android/app/build/outputs/apk/debug/app-debug.apk
```

Requirements: Node 22+, JDK 21, and Android SDK platform 36 with build-tools 36.
The current APK is a **debug build** signed with the local debug key; use your own
release keystore before distributing it. The native build disables the service worker
because the web payload is already packaged inside the APK, and it still makes no
network or AI calls. A copy of the verified build is kept at `output/StudySynth.apk`.

## Output contract

- `quiz_package.json` — validated, quality-accepted questions.
- `quiz.html` / `[slug].html` — standalone offline study workspace.
- `pdf/question-paper-A.pdf`, `pdf/answer-key-B.pdf`, `pdf/explanations-C.pdf`.
- `pdf_check_report.json` — PDF verification result.
- `gate.json` — `COMPREHENSIVE`, `PARTIAL`, or `LIMITED`.
- `run_metrics_lite.json` — stage timings, model-call count, and LLM telemetry.
- `lite_handoff.json` — pending agent-generation handoff (source-only runs).
- `llm_trace.jsonl` — truthful record of generation and repair passes.

## Repository layout

```
studysynth-lite/
├── SKILL.md                     # Lite operating instructions
├── prompts/lite-generate.md     # One combined agent prompt
├── scripts/
│   ├── pipeline_lite.py         # Main Lite coordinator
│   ├── pipeline.py              # Drop-in alias for pipeline_lite.py
│   ├── generate_lite.py         # Offline/PWA deterministic engine (explicit only)
│   ├── llm_trace.py             # Truthful pass telemetry
│   ├── record_lite_pass.py      # Record one generation/repair pass
│   ├── quality.py               # Quality scoring
│   ├── validate_questions.py    # Structural validation
│   └── ...                      # Ingest, anchors, packaging, rendering
├── pwa/                         # Zero-LLM offline Android PWA
├── android/                     # Capacitor Android project (debug APK)
├── www/                         # Generated Capacitor web payload
├── capacitor.config.json        # Native app id, name, and web directory
├── profiles/                    # Exam profiles
├── templates/                   # HTML and PDF templates
└── tests/                       # Python and Node test suites
```

## Verification

```bash
pytest tests/test_skill_lite.py
npm test --prefix pwa
```

The Python suite covers the agent handoff, supplied-bank packaging, repair queue,
trace-based call counting, HTML/PDF contracts, and the explicit offline engine. The PWA
suite proves deterministic generation and answer-key rotation with no network or AI calls.

## Limitations

- The Lite Python skill still needs one agent pass; it is not a zero-LLM pipeline.
- The PWA exam mode uses +2.00/−0.66 marking and a scorecard; it does not attempt
  sectional cut-offs or adaptive difficulty.
- Optional PWA OCR requires the local Tesseract runtime and English language data.
- The APK is debug-signed; a release build needs the operator's own keystore.
- Coverage and gate status reflect the source and bank actually supplied; a small source
  or a partial bank can legitimately produce a `PARTIAL` gate.

## License

MIT License.
