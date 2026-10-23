# lite-generate — One Combined Knowledge & Question Pass

Role: Competitive exam author and knowledge engineer.

Budget: **one combined agent pass.** Do not split this into a separate extraction pass,
blueprint pass, generation pass, or review pass. Read the prepared structure once, write
the knowledge inventory, and write the question bank from that same reading.

This is the default Lite Python generation path. Do **not** call `scripts/generate_lite.py`;
that deterministic engine is only for the offline mobile PWA and explicit test fixtures.

## Inputs

Read `lite_handoff.json` in the run directory. It gives the exact paths for:

- `document_structure.json`: parsed source blocks, each with
  `{block_id, page, section_path, text, table_ref}`.
- `anchors.json`: key dates, numbers, entities, and provisions that must not be lost.
- `profile`: exam profile with target counts and section weights.
- `config`: fidelity mode, options per question, and limits.

Fidelity is **SOURCE_BOUND** by default: no external facts, no invented dates, and no
claims that are not supported by the source blocks.

## Required Outputs

Write two separate files into the run directory named in `lite_handoff.json`:

1. `knowledge_inventory.json`
2. `question_bank.json`

Do not put both objects in one file. Do not write a second inventory or bank version.

### `knowledge_inventory.json`

```json
{
  "units": [
    {
      "id": "KU-0001",
      "topic": "Polity",
      "subtopic": "Fundamental Rights",
      "type": "date",
      "statement": "The Constitution of India was adopted on 26 November 1949.",
      "supporting_excerpt": "The Constitution of India was adopted on 26 November 1949",
      "source": {
        "page": 1,
        "section_path": ["Chapter 1", "Fundamental Rights"],
        "block_id": "B-0005",
        "char_start": 460,
        "char_end": 517,
        "table_ref": null
      },
      "origin": "source",
      "tier": 1,
      "tier_history": [],
      "dimensions": {
        "importance": "high",
        "exam_relevance": "high",
        "factual_density": "high",
        "discrimination_value": "high"
      },
      "language": "en"
    }
  ]
}
```

Rules for units:

- Split the source into atomic examinable facts (`KU-0001`, `KU-0002`, ...).
- `supporting_excerpt` must be an exact verbatim snippet (<=400 chars) from the
  cited block.
- `source.char_start` and `source.char_end` must locate that excerpt in the block.
- `tier` is 1 for critical facts/core concepts, 2 for important details and
  relationships, and 3 for supporting/table items.
- Never create a unit from a heading, table header, page number, or "how to use"
  boilerplate.
- Cover the source; do not pad the inventory with unsupported facts.

### `question_bank.json`

```json
{
  "questions": [
    {
      "id": "Q-0001",
      "type": "factual_mcq",
      "stem": "The Constitution of India was adopted on:",
      "purpose": "direct_recall",
      "options": [
        {"key": "A", "text": "26 November 1949", "is_correct": true},
        {"key": "B", "text": "26 January 1950", "is_correct": false, "distractor_origin": "source", "confusion_type": "wrong_date", "distractor_purpose": "wrong_date"},
        {"key": "C", "text": "15 August 1947", "is_correct": false, "distractor_origin": "source", "confusion_type": "wrong_date", "distractor_purpose": "wrong_date"},
        {"key": "D", "text": "26 November 1950", "is_correct": false, "distractor_origin": "source", "confusion_type": "adjacent_value", "distractor_purpose": "adjacent_value"}
      ],
      "answer_key": "A",
      "knowledge_units": [{"ku_id": "KU-0001", "role": "primary"}],
      "source": [{"block_id": "B-0005", "page": 1}],
      "supporting_excerpt": "The Constitution of India was adopted on 26 November 1949",
      "explanation": "The source states that the Constitution was adopted on 26 November 1949.",
      "difficulty": "medium",
      "difficulty_reason": "direct factual recall with plausible date distractors"
    }
  ]
}
```

Rules for questions:

- Cover 100% of Tier 1 and Tier 2 units as primary roles. A unit may appear as a
  secondary role in other questions, but every Tier 1/2 unit needs at least one
  primary question.
- Every question has exactly four options (A, B, C, D) and exactly one
  `is_correct: true`. `answer_key` must match that option.
- Distractors must be plausible and source-grounded. Each distractor needs
  `distractor_origin`, `confusion_type`, and `distractor_purpose`.
- `confusion_type` is one of: `near_synonym`, `adjacent_value`, `reversed_causality`,
  `wrong_date`, `wrong_person`, `wrong_place`, `partial_truth`, `scope_error`.
- `distractor_purpose` is one of: `confusable_fact`, `adjacent_value`, `partial_truth`,
  `reversed_relation`, `wrong_category`, `wrong_entity`, `wrong_date`, `scope_error`.
- Use varied forms where the source supports them: direct recall, statement
  evaluation, distinction, elimination, chronology, classification, association,
  and cause/effect.
- Statement questions must contain at least two statements with boolean
  `truth_value` values. Alter the false statement substantively (date, entity,
  place, causality, or scope), not by adding meaningless words.
- Keep option lengths balanced. Do not make the correct answer visibly longer or
  more detailed than the distractors.
- Explanations must cite the source evidence. No filler.
- Do not duplicate a question with different wording.

## Record the Pass

After writing both files, record exactly one generation entry:

```bash
python scripts/record_lite_pass.py \
  --run-dir "<RUN_DIR>" \
  --stage lite_generate \
  --pass-number 1 \
  --model "<MODEL>" \
  --provider "<PROVIDER>"
```

Then rerun the command in `lite_handoff.json` with `--inventory` and `--bank`.
The downstream validation, quality, coverage, gate, HTML, and PDF stages are
deterministic and must not be replaced with another model pass.

## Optional Single Repair

If `repair_queue.json` exists after validation, fix only the listed failed items.
Keep accepted questions unchanged. Record one repair entry:

```bash
python scripts/record_lite_pass.py \
  --run-dir "<RUN_DIR>" \
  --stage lite_repair \
  --pass-number 1 \
  --model "<MODEL>" \
  --provider "<PROVIDER>"
```

Then rerun with the same inventory and bank. Do not run a second repair round.

## Completion Checklist

- [ ] `knowledge_inventory.json` and `question_bank.json` are separate, valid JSON files.
- [ ] Every Tier 1 and Tier 2 unit has at least one primary question.
- [ ] Every question has four options and exactly one correct answer.
- [ ] Every question has a source-grounded explanation.
- [ ] `llm_trace.jsonl` contains one `lite_generate` entry (and at most one
      `lite_repair` entry).
- [ ] The printed pipeline rerun command completes and writes the package,
      HTML, and PDFs.
