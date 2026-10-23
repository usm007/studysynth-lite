# StudySynth Lite — Operating Instructions

A lightweight, drop-in edition of the StudySynth competitive-study skill. It keeps the
same user-facing deliverables as the full edition — a validated question bank, a
standalone HTML workspace, print-ready A4 A/B/C PDFs, a dashboard, and a coverage gate —
with far fewer AI passes.

## 1. Three execution layers

| Layer | AI budget | Purpose |
|---|---|---|
| **Full Python edition** | Multi-pass: extract, design, generate, review, gap-fill | Maximum depth and coverage |
| **Lite Python edition** | **1 combined generation pass + at most 1 targeted repair pass** | Fast, cheaper packages |
| **Mobile PWA** | **0 AI passes** | Offline, deterministic practice on a phone |

The deterministic rule-based generator (`scripts/generate_lite.py`) is the **PWA engine**
and a test-fixture generator. It is not the default Lite Python generation path.

## 2. Core principles

- **L1 — One combined agent pass.** Read the prepared source once and write both the
  knowledge inventory and the question bank. Do not split extraction, design, and
  generation into separate model passes.
- **L2 — Generalized processing.** One workflow with sensible defaults. No persona
  routing or audience-specific prompt selection.
- **L3 — Deterministic quality and validation.** Preserve the 11-dimension quality bar,
  structural validation, anchor recall, coverage, audit, and gate.
- **L4 — Deterministic checks over model critique.** Use scripts, schema checks, and
  rubric scoring instead of blind re-solve or semantic review loops.
- **L5 — Localized repair only.** If concrete validation failures occur, repair only the
  listed items, once. Never regenerate the whole bank speculatively.
- **L6 — Contract parity.** Keep the same input interface and final deliverables as the
  full edition.

## 3. Execution model

```
SOURCE DOCUMENT
  |
  |-- deterministic ingest.py + anchors.py
  |      -> document_structure.json, anchors.json
  |
  |-- lite_handoff.json (when no inventory/bank is supplied)
  |      -> prompt path, input paths, output paths, rerun command
  |
  |-- ONE combined agent pass (prompts/lite-generate.md)
  |      -> knowledge_inventory.json
  |      -> question_bank.json
  |      -> llm_trace.jsonl
  |
  |-- deterministic validation and quality (parallel)
  |      -> validation_results.json, quality_report.json, dedupe_report.json
  |
  |-- coverage + audit + gate
  |      -> coverage_matrix.json, audit_report.json, gate.json
  |
  |-- package + render
  |      -> quiz_package.json, quiz.html, pdf/*.pdf
  |
  |-- optional delivery
         -> output/index.html, delivery files
```

The pipeline stops at the handoff instead of silently substituting the deterministic
engine. The agent performs the one pass, writes the two files, records the pass, then
reruns with `--inventory` and `--bank`.

## 4. Model-call accounting

`run_metrics_lite.json` reports `model_calls` from `llm_trace.jsonl`:

- **1** — one combined generation pass.
- **2** — generation plus one targeted repair pass.
- **0** — a directly supplied bank with no Lite handoff, or an explicit
  `--offline-engine` demo/test run.
- **pending (agent generation)** — source-only handoff before the agent pass.
- **unavailable** — a Lite handoff exists but the agent did not record a trace. The
  pipeline never guesses zero in this case.

Record passes with:

```bash
python scripts/record_lite_pass.py \
  --run-dir <RUN_DIR> \
  --stage lite_generate \
  --pass-number 1
```

Use `--stage lite_repair` for the single optional repair pass. Do not claim zero calls
when an agent pass actually occurred.

## 5. CLI usage

`scripts/pipeline.py` is a drop-in alias for `scripts/pipeline_lite.py`; both behave
identically in this repository.

### 5.1 Source-only handoff

```bash
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --run-id lite_run \
  --profile profiles/GENERAL_PSC.json \
  --config config.default.json \
  --full
```

This writes `lite_handoff.json` and stops. Follow the printed instructions.

### 5.2 Agent-generated bank

```bash
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --inventory build/lite_run/knowledge_inventory.json \
  --bank build/lite_run/question_bank.json \
  --run-id lite_run \
  --profile profiles/GENERAL_PSC.json \
  --config config.default.json \
  --full
```

### 5.3 Existing or custom bank

```bash
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --inventory examples/sample_inventory.json \
  --bank examples/question_bank_apsc.json \
  --run-id lite_custom \
  --profile profiles/APSC_PRELIMS.json \
  --config config.default.json \
  --full
```

`--inventory` and `--bank` must be supplied together. The bank is validated and packaged
as-is; a `PARTIAL` gate means coverage gaps, not packaging failure.

### 5.4 Offline/demo engine

```bash
python scripts/pipeline_lite.py \
  --source examples/sample_source.md \
  --run-id offline_demo \
  --build-dir build \
  --full \
  --offline-engine
```

This is the explicit deterministic path for tests, demos, and PWA parity fixtures. It is
never the default.

## 6. Agent prompt requirements

`prompts/lite-generate.md` must produce:

- `knowledge_inventory.json` with source-grounded atomic units, exact excerpts, tiers,
  and source locations.
- `question_bank.json` with four options per question, exactly one correct key, varied
  cognitive forms, plausible source-grounded distractors, and explanations citing the
  source.
- 100% Tier 1 and Tier 2 primary coverage.
- No unsupported facts under `SOURCE_BOUND`.

The agent must not call `scripts/generate_lite.py` during the Lite Python path.

## 7. Repair policy

- Validation writes `repair_queue.json` containing only rejected items and reasons.
- Repair only those items; keep accepted questions unchanged.
- Record exactly one `lite_repair` pass.
- Rerun with the same inventory and bank.
- No second repair round and no full-bank regeneration.

## 8. Output verification

- `quiz_package.json`: validated, quality-accepted questions conforming to the package
  schema.
- `quiz.html` / `[slug].html`: standalone offline study workspace.
- `pdf/question-paper-A.pdf`, `pdf/answer-key-B.pdf`, `pdf/explanations-C.pdf`: verified
  by `check_pdf.py`.
- `gate.json`: authoritative `COMPREHENSIVE`, `PARTIAL`, or `LIMITED` status.
- `run_metrics_lite.json`: timings, model-call count, and LLM telemetry.
- `lite_handoff.json`: pending agent handoff.
- `llm_trace.jsonl`: truthful generation/repair pass record.

## 9. What is intentionally removed

- Second-pass blind sweep.
- Separate classification and blueprint passes.
- Multi-batch question generation.
- Blind re-solve and semantic review loops.
- Multi-round gap-fill.

The deterministic audit, gate, packaging, HTML, and PDF stages are retained.
