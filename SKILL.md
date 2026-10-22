# StudySynth Lite — Operating Instructions (Lightweight Edition)

A high-performance, lightweight, drop-in edition of the StudySynth / Competitive Quiz skill. Delivers the exact same user-facing deliverables (standalone HTML study workspaces, master dashboard, desktop shortcuts, and print-ready A4 test PDFs) with dramatically fewer model calls, zero redundant intermediate artifacts, lower token consumption, and faster execution.

---

## 1. Core Principles (L1–L6)

- **L1 — Single-Pass Generation**: Extract knowledge units and generate high-yield competitive exam questions in a single, direct pass. No multi-pass extraction, second-pass blind sweeps, or 5-round gap-fill loops.
- **L2 — Generalized Processing**: One standard workflow with sensible defaults. No user profiling, persona routing, or audience-specific prompt selection. Essential subject matter is derived solely from the source document.
- **L3 — Deterministic Quality and Validation**: Maintain the established 11-dimension quality bar (`quality.py`), structural validation (`validate_questions.py`), anchor recall (`inventory_check.py`), and mathematical coverage (`coverage.py` + `gate.py`). Never bypass validation or lower quality standards.
- **L4 — Inexpensive Deterministic Checks Over Model Critique**: Replace expensive LLM self-critique, blind redaction, and semantic review loops with deterministic validation, schema checks, and rubric evaluation.
- **L5 — Localized Repair Only**: Repair specific defect items only when concrete validation failures occur. Never execute speculative full-bank regeneration or multi-round gap refinement by default.
- **L6 — Strict Contract Parity**: The input interface (`--source`, `--run-id`, `--profile`, `--config`, etc.) and final deliverables (`quiz_package.json`, `quiz.html`, `pdf/*.pdf`, `output/index.html`) remain 100% contract-compatible with the full edition.

---

## 2. Lean Execution Pipeline

```
SOURCE DOCUMENT (.pdf, .docx, .pptx, .xlsx, .txt, .md, .html)
   │
   ▼ [1. Receive & Prepare]
deterministic ingest.py + anchors.py
   │  → document_structure.json, anchors.json
   ▼ [2. Generate directly]
prompts/lite-generate.md OR scripts/generate_lite.py
   │  → knowledge_inventory.json, question_bank.json (single pass)
   ▼ [3. Deterministic Validation & Quality (Parallel)]
validate_questions.py + quality.py + dedupe.py
   │  → validation_results.json, quality_report.json, dedupe_report.json
   ▼ [4. Coverage & Audit Gate]
coverage.py + audit.py + gate.py
   │  → coverage_matrix.json, audit_report.json, gate.json
   ▼ [5. Package & Render (Parallel)]
package.py + build_web.py + build_pdf.py + check_pdf.py
   │  → quiz_package.json, quiz.html / [slug].html, pdf/*.pdf
   ▼ [6. Delivery (Optional)]
package_delivery.py + dashboard.py + desktop_shortcut.py
   │  → output/index.html, OS shortcuts
```

---

## 3. Stages Removed vs Retained

| Stage in Full Edition | Lite Edition Action | Rationale |
|---|---|---|
| Ingest (`scripts/ingest.py`) | **Retained** | Essential for document parsing, table extraction, and normalization |
| Anchors (`scripts/anchors.py`) | **Retained** | Deterministic, sub-second entity and date extraction for recall audit |
| First-pass extraction (`extract.md`) | **Simplified** | Inlined into single-pass generator |
| Locate excerpts (`locate_excerpts.py`) | **Retained/Inlined** | Fast deterministic span and offset verification |
| Second-pass blind sweep (`second-pass.md`) | **Removed** | Eliminates redundant re-reading of identical blocks and diff tracking |
| Classification pass (`classify.md`) | **Simplified** | Standardized tier assignments (Tier 1/2) generated directly |
| Exam design blueprinting (`exam-design.md`) | **Simplified** | Generalized question distribution replaces heavy blueprint phase |
| Batch question generation (`generate.md`) | **Simplified** | Direct generation replaces multiple 6-8 item batch requests |
| Statement engine (`statement-engine.md`) | **Inlined** | Statement logic generated inline with question objects |
| Blind re-solve review (`review-blind-batch.md`) | **Removed** | Deterministic `validate_questions.py` and `quality.py` catch ambiguities |
| Semantic review (`review-semantic-batch.md`) | **Removed** | Deterministic 11-dimension quality engine already grades Rubric A–D |
| Iterative gap-fill loop (`gap-fill.md`) | **Removed** | Replaced by single-pass complete coverage; local repair only if flagged |
| Revision review prompt (`prompts/revision.md`) | **Removed** | Deterministic `scripts/revision.py` handles mastery algorithms |
| Deterministic audit & gate (`audit.py`, `gate.py`) | **Retained** | Non-negotiable mathematical coverage and gate integrity |
| Package & rendering (`package.py`, `build_web.py`, etc.) | **Retained** | Produces exact same user-facing standalone HTML and PDF deliverables |

---

## 4. Drop-in CLI Usage

The Lite edition provides `scripts/pipeline_lite.py` as a drop-in replacement for `scripts/pipeline.py`:

```bash
# Complete end-to-end execution in Lite edition
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --run-id lite_run \
  --profile profiles/GENERAL_PSC.json \
  --config config.default.json \
  --full

# With existing or custom inventory and bank
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --inventory examples/sample_inventory.json \
  --bank examples/sample_bank.json \
  --run-id lite_custom \
  --profile profiles/APSC_PRELIMS.json \
  --config config.default.json \
  --full
```

---

## 5. Output Verification

Outputs match the full edition specification:
- `quiz_package.json`: Contains validated, quality-accepted questions conforming to `quiz-package.schema.json`.
- `quiz.html` / `[slug].html`: Standalone offline study desk with Practice, Test, Revision, and Analytics modes.
- `pdf/question-paper-A.pdf`, `pdf/answer-key-B.pdf`, `pdf/explanations-C.pdf`: Print-ready A4 test documents verified by `check_pdf.py`.
- `gate.json`: Authoritative gate status (`COMPREHENSIVE`, `PARTIAL`, or `LIMITED`).
- `run_metrics_lite.json`: Performance benchmark report with stage timings and token/call metrics.
