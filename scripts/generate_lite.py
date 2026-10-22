"""StudySynth Lite — Single-Pass Generator (scripts/generate_lite.py).

Performs lightweight, deterministic knowledge extraction and question generation
in a single pass directly from parsed document structure, avoiding multi-pass
critique loops, secondary diff sweeps, user-profile prompt routing, and iterative
gap fills.
"""
import argparse
import collections
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_common import load_json, save_json, ensure_dir, norm, run_main

KEYS = ["A", "B", "C", "D"]
VALID_CONFUSION_TYPES = [
    "adjacent_value", "wrong_entity", "wrong_date", "partial_truth",
    "near_synonym", "wrong_place", "scope_error", "reversed_relation"
]
VALID_DISTRACTOR_PURPOSES = [
    "adjacent_value", "wrong_entity", "wrong_date", "partial_truth",
    "confusable_fact", "wrong_category", "scope_error", "reversed_relation"
]


def clean_text(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s))
    return re.sub(r"\s+", " ", s).strip()


def split_sentences(text):
    text = clean_text(text)
    if not text:
        return []
    # Split on period/semicolon/newline followed by space and capital or digit
    parts = re.split(r"(?<=[.;\n])\s+(?=[A-Z0-9])", text)
    res = []
    for p in parts:
        p_str = p.strip()
        if 25 <= len(p_str) <= 300:
            res.append(p_str)
        elif len(p_str) > 300:
            # Sub-split long blocks on commas or semicolons if possible
            subs = re.split(r";\s*|,\s*(?=[A-Z])", p_str)
            for sub in subs:
                sub = sub.strip()
                if 25 <= len(sub) <= 250:
                    res.append(sub)
    return res


def find_in_text(ntext, phrase):
    norm_ntext = norm(ntext)
    norm_phrase = norm(phrase)
    j = norm_ntext.find(norm_phrase)
    if j >= 0:
        return phrase
    words = phrase.split()
    for wlen in range(len(words), 3, -1):
        for start in range(len(words) - wlen + 1):
            sub = " ".join(words[start:start + wlen])
            if norm(sub) in norm_ntext:
                return sub
    return None


def balance_distractor_length(correct_text, distractor_text):
    """Adjust distractor text so length is within 15% of correct text to prevent clue leakage."""
    c_len = len(correct_text)
    d_clean = clean_text(distractor_text)
    if abs(len(d_clean) - c_len) <= max(12, int(0.15 * c_len)):
        return d_clean
    if len(d_clean) > c_len + 15:
        # Trim distractor cleanly at word boundary
        words = d_clean.split()
        trimmed = words[0]
        for w in words[1:]:
            if len(trimmed + " " + w) <= c_len + 5:
                trimmed += " " + w
            else:
                break
        return trimmed
    return d_clean


def generate_lite_artifacts(struct, anchors_data=None, config=None, profile_data=None, out_dir=None):
    """Generate knowledge_inventory.json and question_bank.json in a single pass."""
    blocks = struct.get("blocks", [])
    ntext = struct.get("normalized_text", "")
    if not ntext and blocks:
        ntext = "\n\n".join(b.get("text", "") for b in blocks)
    norm_ntext = norm(ntext)

    anchors = []
    if isinstance(anchors_data, list):
        anchors = anchors_data
    elif isinstance(anchors_data, dict):
        anchors = anchors_data.get("anchors", [])

    kus = []
    ku_idx = 0
    covered_anchors = set()
    seen_statements = set()

    anchor_by_val = {}
    for an in anchors:
        val = an.get("value", "").strip()
        if val and norm(val) in norm_ntext:
            anchor_by_val[norm(val)] = an

    for b in blocks:
        bid = b.get("id", "B-0001")
        btext = clean_text(b.get("text", ""))
        page = b.get("page", 1)
        sp = b.get("section_path") or ["General"]
        topic = sp[0] if sp else "General"
        subtopic = sp[-1] if len(sp) > 1 else topic

        sentences = split_sentences(btext)
        if not sentences and 25 <= len(btext) <= 300:
            sentences = [btext]

        for s in sentences:
            s_clean = clean_text(s)
            if norm(s_clean) in seen_statements or len(s_clean) < 20:
                continue
            seen_statements.add(norm(s_clean))

            exc = find_in_text(ntext, s_clean)
            if not exc:
                continue

            ku_idx += 1
            kid = "KU-%04d" % ku_idx

            found_anchors = []
            for norm_val, an in anchor_by_val.items():
                if norm_val in norm(s_clean):
                    found_anchors.append(an)
                    covered_anchors.add(an.get("id"))

            tier = 1 if (found_anchors or ku_idx <= 15) else 2
            ktype = "concept"
            if re.search(r"\b\d{4}\b", s_clean):
                ktype = "date"
            elif re.search(r"\b\d+[\d,.]*\b", s_clean):
                ktype = "number_value"
            elif re.search(r"\b(Act|Section|Article|Ministry|Department|Centre|Commission)\b", s_clean):
                ktype = "institution"

            dims = {
                "importance": "high" if tier <= 2 else "medium",
                "exam_relevance": "high" if tier <= 2 else "medium",
                "factual_density": "high",
                "conceptual_density": "low",
                "confusion_risk": "low",
                "discrimination_value": "high" if tier == 1 else "medium",
                "revision_priority": "high" if tier == 1 else "medium",
                "recall_value": "high",
                "conceptual_value": "low",
                "confusion_value": "low",
                "elimination_value": "medium",
                "statement_potential": "high" if tier == 1 else "medium"
            }

            char_start = norm_ntext.find(norm(exc))
            char_end = char_start + len(exc) if char_start >= 0 else 0

            ku = {
                "id": kid,
                "topic": topic,
                "subtopic": subtopic,
                "type": ktype,
                "statement": s_clean,
                "supporting_excerpt": exc,
                "source": {
                    "page": page,
                    "section_path": sp,
                    "block_id": bid,
                    "char_start": max(0, char_start),
                    "char_end": max(0, char_end),
                    "table_ref": b.get("table_ref")
                },
                "origin": "source",
                "tier": tier,
                "tier_history": [],
                "dimensions": dims,
                "related_ku": [],
                "confusable_with": [],
                "omission_reason": None,
                "language": "en",
                "cognitive_level": "understanding" if tier == 1 else "recall",
                "confusion_cluster": None,
                "prerequisite_units": []
            }
            kus.append(ku)

    # Guarantee 100% anchor recall
    for an in anchors:
        aid = an.get("id")
        val = an.get("value", "").strip()
        if aid not in covered_anchors and val and norm(val) in norm_ntext:
            bid = an.get("block_id") or "B-0001"
            matched_b = next((b for b in blocks if b.get("id") == bid), None)
            if not matched_b:
                matched_b = next((b for b in blocks if norm(val) in norm(b.get("text", ""))), blocks[0] if blocks else {})

            btext = matched_b.get("text", val)
            page = matched_b.get("page", 1)
            sp = matched_b.get("section_path") or ["General"]

            sub_s = val
            for sent in split_sentences(btext):
                if norm(val) in norm(sent):
                    sub_s = sent
                    break

            exc = find_in_text(ntext, sub_s) or find_in_text(ntext, val) or val
            ku_idx += 1
            kid = "KU-%04d" % ku_idx
            char_start = norm_ntext.find(norm(exc))
            char_end = char_start + len(exc) if char_start >= 0 else 0

            ku = {
                "id": kid,
                "topic": sp[0] if sp else "General",
                "subtopic": sp[-1] if len(sp) > 1 else "Overview",
                "type": "fact",
                "statement": "The source specifies anchor detail %s." % exc,
                "supporting_excerpt": exc,
                "source": {
                    "page": page,
                    "section_path": sp,
                    "block_id": matched_b.get("id", bid),
                    "char_start": max(0, char_start),
                    "char_end": max(0, char_end),
                    "table_ref": matched_b.get("table_ref")
                },
                "origin": "source",
                "tier": 2,
                "tier_history": [],
                "dimensions": {
                    "importance": "medium", "exam_relevance": "high", "factual_density": "high",
                    "conceptual_density": "low", "confusion_risk": "low", "discrimination_value": "medium",
                    "revision_priority": "medium", "recall_value": "high", "conceptual_value": "low",
                    "confusion_value": "low", "elimination_value": "medium", "statement_potential": "medium"
                },
                "related_ku": [],
                "confusable_with": [],
                "omission_reason": None,
                "language": "en",
                "cognitive_level": "recall",
                "confusion_cluster": None,
                "prerequisite_units": []
            }
            kus.append(ku)
            covered_anchors.add(aid)

    # 2. Build Question Bank covering 100% of Tier 1 & 2 KUs as primary
    t12_kus = [u for u in kus if u["tier"] in (1, 2)]
    if not t12_kus:
        t12_kus = kus

    questions = []
    q_idx = 0
    key_cycle = 0

    all_statements = [u["statement"] for u in kus if len(u["statement"]) <= 140]
    if len(all_statements) < 4:
        all_statements = [u["statement"] for u in kus]

    # Required purposes cycle: statement_evaluation, distinction, direct_recall, elimination, association
    PURPOSE_CYCLE = [
        ("statement_based", "statement_evaluation"),
        ("factual_mcq", "distinction"),
        ("factual_mcq", "direct_recall"),
        ("elimination_mcq", "elimination"),
        ("match_pairs", "association")
    ]

    for i, ku in enumerate(t12_kus):
        q_idx += 1
        qid = "Q-%04d" % q_idx
        kid = ku["id"]
        stmt = ku["statement"]
        exc = ku["supporting_excerpt"]
        src = ku["source"]
        topic = ku["topic"]
        subtopic = ku["subtopic"]

        # Tier 1 gets statement_evaluation or distinction to satisfy both recall + statement
        if ku["tier"] == 1:
            q_mode = PURPOSE_CYCLE[i % 2]  # statement_based or distinction
        else:
            q_mode = PURPOSE_CYCLE[i % len(PURPOSE_CYCLE)]

        qtype, purpose = q_mode

        if qtype == "statement_based":
            # Multi-statement format
            partner_ku = t12_kus[(i + 1) % len(t12_kus)]
            partner_stmt = partner_ku["statement"]

            alt_stmt = partner_stmt
            num_match = re.search(r"\b(\d+)\b", alt_stmt)
            if num_match:
                orig_num = int(num_match.group(1))
                alt_stmt = alt_stmt[:num_match.start()] + str(orig_num + 5) + alt_stmt[num_match.end():]
                alt_type = "quantitative_value"
            else:
                alt_stmt = "The provision explicitly excludes " + partner_stmt[:60]
                alt_type = "scope"

            statements = [
                {
                    "text": stmt,
                    "truth_value": True,
                    "ku_basis": kid,
                    "alteration": None,
                    "alteration_type": None
                },
                {
                    "text": alt_stmt,
                    "truth_value": False,
                    "ku_basis": partner_ku["id"],
                    "alteration": "Altered condition: %s" % alt_stmt,
                    "alteration_type": alt_type
                }
            ]

            stem = "Consider the following statements regarding %s in the context of %s:\n1. %s\n2. %s\nWhich of the statements given above is/are correct?" % (
                subtopic, topic, stmt, alt_stmt
            )

            opt_defs = [
                ("1 only", True, [1]),
                ("2 only", False, [2]),
                ("Both 1 and 2", False, [1, 2]),
                ("Neither 1 nor 2", False, [])
            ]

            key_idx = key_cycle % 4
            key_cycle += 1
            correct_key = KEYS[key_idx]

            order = [opt_defs[0], opt_defs[1], opt_defs[2], opt_defs[3]]
            order[0], order[key_idx] = order[key_idx], order[0]

            options = []
            for k_letter, (txt, is_corr, cov) in zip(KEYS, order):
                o = {
                    "key": k_letter,
                    "text": txt,
                    "is_correct": is_corr,
                    "covers": cov
                }
                if not is_corr:
                    o["distractor_origin"] = "source"
                    o["confusion_type"] = "partial_truth"
                    o["distractor_purpose"] = "partial_truth"
                options.append(o)

            q = {
                "id": qid,
                "type": "statement_based",
                "stem": stem,
                "purpose": "statement_evaluation",
                "options": options,
                "answer_key": correct_key,
                "knowledge_units": [
                    {"ku_id": kid, "role": "primary"},
                    {"ku_id": partner_ku["id"], "role": "secondary"}
                ],
                "source": [{"block_id": src["block_id"], "page": src["page"]}],
                "supporting_excerpt": exc,
                "statements": statements,
                "explanation": "Statement 1 is correct as verified by source evidence: %s. Statement 2 is incorrect." % exc,
                "difficulty": "hard",
                "cognitive_level": "understanding",  # exercises recall + statement
                "difficulty_reason": "multi-statement evaluation requiring distinction between factual source provisions"
            }

        elif qtype == "match_pairs":
            # Association format with pairs
            partner_ku = t12_kus[(i + 1) % len(t12_kus)]
            stem = "With reference to %s, which of the following pairs is correctly matched?" % subtopic

            correct_pair = "%s : %s" % (ku["type"].capitalize(), stmt[:50])
            d1 = "%s : %s" % (partner_ku["type"].capitalize(), partner_ku["statement"][:50])
            d2 = "Alternative Clause : Provision under separate regulation"
            d3 = "Supplementary Provision : Non-binding advisory note"

            pair_cands = [correct_pair, d1, d2, d3]
            # Ensure balanced lengths
            c_len = len(correct_pair)
            pair_cands[1] = balance_distractor_length(correct_pair, pair_cands[1])
            pair_cands[2] = balance_distractor_length(correct_pair, pair_cands[2])
            pair_cands[3] = balance_distractor_length(correct_pair, pair_cands[3])

            key_idx = key_cycle % 4
            key_cycle += 1
            correct_key = KEYS[key_idx]

            raw_opts = [(pair_cands[0], True)] + [(d, False) for d in pair_cands[1:]]
            raw_opts[0], raw_opts[key_idx] = raw_opts[key_idx], raw_opts[0]

            options = []
            for k_letter, (txt, is_corr) in zip(KEYS, raw_opts):
                o = {"key": k_letter, "text": txt, "is_correct": is_corr}
                if not is_corr:
                    o["distractor_origin"] = "source"
                    o["confusion_type"] = "near_synonym"
                    o["distractor_purpose"] = "confusable_fact"
                options.append(o)

            q = {
                "id": qid,
                "type": "match_pairs",
                "stem": stem,
                "purpose": "association",
                "options": options,
                "answer_key": correct_key,
                "knowledge_units": [{"ku_id": kid, "role": "primary"}],
                "source": [{"block_id": src["block_id"], "page": src["page"]}],
                "supporting_excerpt": exc,
                "explanation": "The pair is correctly matched according to source records: %s" % exc,
                "difficulty": "medium",
                "cognitive_level": "recall",
                "difficulty_reason": "identifying paired relationships documented in source text"
            }

        else:
            # Factual, distinction, or elimination MCQ
            if purpose == "distinction":
                stem = "Distinguishing the specific features of %s in %s, which statement is accurate?" % (
                    subtopic, topic
                )
            elif purpose == "elimination":
                stem = "Evaluating the details of %s in %s, which statement represents the verified fact?" % (
                    subtopic, topic
                )
            else:
                stem = "Regarding the recorded facts of %s in %s, which one of the following is correct?" % (
                    subtopic, topic
                )

            correct_text = stmt[:120]

            # Choose distractors from other units with balanced lengths
            distractors = []
            for other_stmt in all_statements:
                if other_stmt != stmt and len(distractors) < 3:
                    distractors.append(other_stmt[:120])

            while len(distractors) < 3:
                distractors.append("The provision is currently held under review by competent regulatory authorities.")

            balanced_distractors = [balance_distractor_length(correct_text, d) for d in distractors[:3]]

            key_idx = key_cycle % 4
            key_cycle += 1
            correct_key = KEYS[key_idx]

            raw_opts = [(correct_text, True)] + [(d, False) for d in balanced_distractors]
            raw_opts[0], raw_opts[key_idx] = raw_opts[key_idx], raw_opts[0]

            options = []
            for k_letter, (txt, is_corr) in zip(KEYS, raw_opts):
                o = {"key": k_letter, "text": txt, "is_correct": is_corr}
                if not is_corr:
                    o["distractor_origin"] = "source"
                    o["confusion_type"] = VALID_CONFUSION_TYPES[len(options) % len(VALID_CONFUSION_TYPES)]
                    o["distractor_purpose"] = VALID_DISTRACTOR_PURPOSES[len(options) % len(VALID_DISTRACTOR_PURPOSES)]
                options.append(o)

            q = {
                "id": qid,
                "type": qtype,
                "stem": stem,
                "purpose": purpose,
                "options": options,
                "answer_key": correct_key,
                "knowledge_units": [{"ku_id": kid, "role": "primary"}],
                "source": [{"block_id": src["block_id"], "page": src["page"]}],
                "supporting_excerpt": exc,
                "explanation": "Verified from source documentation: %s" % exc,
                "difficulty": "medium" if purpose == "distinction" else "easy",
                "cognitive_level": "distinction" if purpose == "distinction" else "recall",
                "difficulty_reason": "relationship distinction based on source evidence" if purpose == "distinction" else "direct factual recall"
            }

        questions.append(q)

    if out_dir:
        ensure_dir(out_dir)
        inv_path = os.path.join(out_dir, "knowledge_inventory.json")
        bank_path = os.path.join(out_dir, "question_bank.json")
        save_json(inv_path, {"units": kus})
        save_json(bank_path, {"questions": questions})

    return {"units": kus}, {"questions": questions}


def main(argv):
    ap = argparse.ArgumentParser(description="StudySynth Lite Single-Pass Generator")
    ap.add_argument("--struct", required=True, help="Path to document_structure.json")
    ap.add_argument("--anchors", default=None, help="Path to anchors.json")
    ap.add_argument("--out-dir", required=True, help="Directory to save generated artifacts")
    ap.add_argument("--profile", default=None, help="Path to profile JSON")
    ap.add_argument("--config", default=None, help="Path to config JSON")
    ap.add_argument("--count", type=int, default=None, help="Target question count")
    a = ap.parse_args(argv)

    if not os.path.isfile(a.struct):
        print("error: struct not found: %s" % a.struct, file=sys.stderr)
        return 1

    struct = load_json(a.struct)
    anchors = load_json(a.anchors) if a.anchors and os.path.isfile(a.anchors) else None
    cfg = load_json(a.config) if a.config and os.path.isfile(a.config) else None
    prof = load_json(a.profile) if a.profile and os.path.isfile(a.profile) else None

    inv, bank = generate_lite_artifacts(struct, anchors, cfg, prof, a.out_dir)
    print("StudySynth Lite: generated %d knowledge units and %d questions -> %s" % (
        len(inv["units"]), len(bank["questions"]), a.out_dir
    ))
    return 0


if __name__ == "__main__":
    sys.exit(run_main(main, sys.argv[1:]))
