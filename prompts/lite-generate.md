# lite-generate — Single-Pass Knowledge & Question Generation

Role: Competitive exam author and knowledge engineer.
Goal: In a single direct pass, transform the provided document structure into an authoritative knowledge inventory and a comprehensive question bank.

## Inputs
- `blocks[]`: List of parsed source blocks, each with `{block_id, page, section_path, text, table_ref}`.
- `anchors[]`: Key dates, numbers, entities, and provisions to ensure 100% recall.
- `fidelity_mode`: SOURCE_BOUND (no external ungrounded facts).

## Core Requirements

1. **Knowledge Units (`units[]`)**:
   - Split source blocks into atomic examinable facts (`KU-0001`, `KU-0002`, ...).
   - `supporting_excerpt`: Exact verbatim snippet (<=400 chars) from the source block.
   - `tier`: 1 (critical facts/core concepts), 2 (important details/relationships), or 3 (supporting/table items).
   - `source`: `{page, section_path, block_id, char_start, char_end}`.
   - `origin`: "source".

2. **Question Bank (`questions[]`)**:
   - Cover 100% of Tier 1 and Tier 2 Knowledge Units as primary roles.
   - Single defensible key: exactly 1 option has `is_correct: true`, matching `answer_key`.
   - 4 options per question (A, B, C, D).
   - Distractors must be plausible alternatives from the document or domain, specifying:
     - `distractor_origin`: "source"
     - `confusion_type`: one of `near_synonym`, `adjacent_value`, `reversed_causality`, `wrong_date`, `wrong_person`, `wrong_place`, `partial_truth`, `scope_error`
     - `distractor_purpose`: one of `confusable_fact`, `adjacent_value`, `partial_truth`, `reversed_relation`, `wrong_category`, `wrong_entity`, `wrong_date`, `scope_error`
   - Purpose must match cognitive mechanism: `direct_recall`, `statement_evaluation`, `distinction`, `elimination`, `chronology`, `classification`, `association`, `cause_effect`.
   - Statement questions must have >=2 statements with boolean `truth_value` and substantive alterations (date, entity, place, causality, scope).
   - Clear pedagogical `explanation` citing the source evidence. No artificial filler.

## Output Format
```json
{
  "units": [
    {
      "id": "KU-0001",
      "topic": "...",
      "subtopic": "...",
      "type": "concept",
      "statement": "...",
      "supporting_excerpt": "verbatim text from block",
      "source": {"page": 1, "section_path": ["..."], "block_id": "B-0001", "char_start": 0, "char_end": 50},
      "origin": "source",
      "tier": 1,
      "tier_history": [],
      "dimensions": {"importance": "high", "exam_relevance": "high", "factual_density": "high", "discrimination_value": "high"},
      "language": "en"
    }
  ],
  "questions": [
    {
      "id": "Q-0001",
      "type": "factual_mcq",
      "stem": "...",
      "purpose": "direct_recall",
      "options": [
        {"key": "A", "text": "...", "is_correct": true},
        {"key": "B", "text": "...", "is_correct": false, "distractor_origin": "source", "confusion_type": "adjacent_value", "distractor_purpose": "adjacent_value"},
        {"key": "C", "text": "...", "is_correct": false, "distractor_origin": "source", "confusion_type": "wrong_entity", "distractor_purpose": "wrong_entity"},
        {"key": "D", "text": "...", "is_correct": false, "distractor_origin": "source", "confusion_type": "partial_truth", "distractor_purpose": "partial_truth"}
      ],
      "answer_key": "A",
      "knowledge_units": [{"ku_id": "KU-0001", "role": "primary"}],
      "source": [{"block_id": "B-0001", "page": 1}],
      "supporting_excerpt": "verbatim text from block",
      "explanation": "...",
      "difficulty": "medium",
      "difficulty_reason": "direct factual recall with plausible distractors"
    }
  ]
}
```
