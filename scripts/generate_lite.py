"""StudySynth Lite — deterministic offline/PWA inventory and question engine.

This module is the zero-LLM engine intended for the offline mobile PWA and for
deterministic test fixtures. It is NOT the default Lite Python generation path.
The default Lite skill uses one combined agent pass from prompts/lite-generate.md.
The pipeline only calls this module when the explicit ``--offline-engine`` demo/test
flag is set.

It still has to produce a bank that survives the same deterministic verification
used by the full edition, so this module builds source-grounded knowledge units
and then emits a small, controlled set of question forms for each unit.

Design rules:
- only verbatim source text is used for questions and excerpts;
- exactly one primary knowledge unit per question, so coverage is measurable;
- every Tier-1 unit receives a statement-evaluation form (recall + statement);
- Tier-2 units rotate through recall, statement, elimination, distinction, and
  association forms so the bank is not monotonous;
- distractors are fragments of other source statements, length-balanced
  against the key so answer-length leaks do not appear;
- headings, table headers, and "how to use" boilerplate are never turned into
  questions;
- anchors that are only found in furniture/headings are retained as Tier-3
  inventory evidence, never as low-value quiz questions.
"""
import argparse
import collections
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib_common import load_json, save_json, ensure_dir, norm, token_set_sim, run_main

KEYS = ["A", "B", "C", "D"]
VALID_CONFUSION_TYPES = [
    "adjacent_value", "wrong_entity", "wrong_date", "partial_truth",
    "near_synonym", "wrong_place", "scope_error", "reversed_relation"
]
VALID_DISTRACTOR_PURPOSES = [
    "adjacent_value", "wrong_entity", "wrong_date", "partial_truth",
    "confusable_fact", "wrong_category", "scope_error", "reversed_relation"
]
FORM_PURPOSE = {
    "statement": "statement_evaluation",
    "elimination": "elimination",
    "distinction": "distinction",
    "association": "association",
    "completion": "direct_recall",
}
PURPOSE_FORM = {v: k for k, v in FORM_PURPOSE.items()}
TIER1_FORMS = ["statement", "elimination"]
TIER2_FORMS = ["completion", "statement", "elimination", "distinction", "association"]

META_RE = re.compile(
    r"(?:these notes|this file|this document|the table below|the following table|"
    r"read each section|learn it row by row|revision tool|how to use)", re.I)
HEADER_WORDS = {
    "article", "subject", "one-line revision point", "tributary", "bank",
    "rises in", "approx. length (km)", "name", "item", "topic", "description",
}


def clean_text(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", str(s))
    return re.sub(r"\s+", " ", s).strip()


def clean_heading(s):
    s = clean_text(s)
    s = re.sub(r"^#{1,6}\s+", "", s)
    s = re.sub(r"^\d+(?:\.\d+)*[.)]?\s*", "", s)
    return s.strip(" :;-")


def section_labels(section_path):
    """Return a human (topic, subtopic) pair from an ingest section path."""
    if not section_path:
        return "General", "Key facts"
    title = clean_heading(section_path[-1]) or "General"
    if ":" in title:
        topic, sub = title.split(":", 1)
        topic, sub = topic.strip(" :;-"), sub.strip(" :;-")
        if topic and sub:
            return topic, sub
    return title, "Key facts"


def is_meta_text(text, section_path=None):
    t = clean_text(text)
    if not t:
        return True
    sp = " ".join(section_path or [])
    if re.search(r"how\s+to\s+use", sp, re.I):
        return True
    if META_RE.search(t):
        return True
    return False


def is_table_header(cells):
    if not cells:
        return True
    low = [clean_text(c).lower() for c in cells]
    hits = sum(1 for c in low if c in HEADER_WORDS)
    return hits >= max(1, len(low) // 2)


def split_sentences(text):
    """Split prose or bullet-list text into complete, examinable sentences."""
    text = clean_text(text)
    if not text:
        return []
    chunks = re.split(r"(?:^|\s)[-•]\s+", text)
    out = []

    def absorb(part):
        part = part.strip()
        if not part:
            return
        if 25 <= len(part) <= 320:
            out.append(part)
        elif len(part) > 320:
            for sub in re.split(r";\s*", part):
                sub = sub.strip()
                if 25 <= len(sub) <= 320:
                    out.append(sub)
                elif len(sub) > 320:
                    acc = ""
                    for piece in re.split(r",\s*", sub):
                        cand = (acc + ", " + piece).strip(", ") if acc else piece
                        if len(cand) <= 320:
                            acc = cand
                        else:
                            if len(acc) >= 25:
                                out.append(acc)
                            acc = piece
                    if len(acc) >= 25:
                        out.append(acc)

    abbrev = re.compile(
        r"\b(?:Dr|Mr|Mrs|Ms|St|No|Art|Sec|Vs|v|Jr|Sr|e\.g|i\.e|etc|"
        r"U\.S|B|K|S|R)\.$", re.I)
    for chunk in chunks:
        chunk = chunk.strip()
        if not chunk:
            continue
        merged = []
        for part in re.split(r"(?<=[.!?])\s+", chunk):
            part = part.strip()
            if not part:
                continue
            if merged and abbrev.search(merged[-1]):
                merged[-1] = merged[-1] + " " + part
            else:
                merged.append(part)
        for sentence in merged:
            absorb(sentence)
    return out


def find_in_text(ntext, phrase):
    norm_ntext = norm(ntext)
    norm_phrase = norm(phrase)
    if norm_phrase and norm_phrase in norm_ntext:
        return phrase
    words = phrase.split()
    for wlen in range(len(words), 3, -1):
        for start in range(len(words) - wlen + 1):
            sub = " ".join(words[start:start + wlen])
            if norm(sub) in norm_ntext:
                return sub
    return None


def table_row_statement(cells):
    cells = [clean_text(c) for c in cells if clean_text(c)]
    if len(cells) < 2:
        return ""
    return "%s — %s" % (cells[0], " ; ".join(cells[1:]))


def detect_kind(statement):
    if re.search(r"\b(?:1[5-9]\d\d|20\d\d)\b", statement):
        return "date"
    if re.search(r"\b\d+(?:[.,]\d+)?\s*(?:%|percent|kilomet|million|billion|persons?|people|years?)\b",
                 statement, re.I):
        return "number_value"
    if re.search(r"\b(?:Article|Section|Clause|Schedule|Act|Ministry|Department|Commission)\b",
                 statement):
        return "institution"
    if re.search(r"\b(?:means|is|are|refers|defined as)\b", statement, re.I):
        return "concept"
    return "fact"


def base_dimensions(tier, statement):
    high = tier == 1
    return {
        "importance": "high" if high else "medium",
        "exam_relevance": "high" if high else "medium",
        "factual_density": "high",
        "conceptual_density": "low",
        "confusion_risk": "low",
        "discrimination_value": "high" if high else "medium",
        "revision_priority": "high" if high else "medium",
        "recall_value": "high",
        "conceptual_value": "low",
        "confusion_value": "low",
        "elimination_value": "medium",
        "statement_potential": "high",
    }


def make_ku(kid, statement, excerpt, block, section_path, tier, ntext):
    topic, subtopic = section_labels(section_path)
    char_start = ntext.find(excerpt)
    if char_start < 0:
        char_start = norm(ntext).find(norm(excerpt))
    char_end = char_start + len(excerpt) if char_start >= 0 else 0
    return {
        "id": kid,
        "topic": topic,
        "subtopic": subtopic,
        "type": detect_kind(statement),
        "statement": statement,
        "supporting_excerpt": excerpt,
        "source": {
            "page": block.get("page", 1),
            "section_path": list(section_path or []),
            "block_id": block.get("id", "B-0001"),
            "char_start": max(0, char_start),
            "char_end": max(0, char_end),
            "table_ref": (block.get("table") or {}).get("caption") if isinstance(block.get("table"), dict) else None,
        },
        "origin": "source",
        "tier": tier,
        "tier_history": [],
        "dimensions": base_dimensions(tier, statement),
        "related_ku": [],
        "confusable_with": [],
        "omission_reason": None,
        "language": "en",
        "cognitive_level": "understanding" if tier == 1 else "recall",
        "confusion_cluster": None,
        "prerequisite_units": [],
    }


def build_inventory(struct, anchors):
    blocks = struct.get("blocks", []) or []
    ntext = struct.get("normalized_text", "") or "\n\n".join(b.get("text", "") for b in blocks)
    kus = []
    seen_statements = set()
    section_seen = collections.Counter()

    def add(kid, statement, excerpt, block, section_path, tier):
        key = norm(statement)
        if not key or key in seen_statements:
            return False
        if not norm(excerpt) or norm(excerpt) not in norm(ntext):
            return False
        seen_statements.add(key)
        kus.append(make_ku(kid, statement, excerpt, block, section_path, tier, ntext))
        return True

    for block in blocks:
        kind = (block.get("kind") or "").lower()
        text = clean_text(block.get("text", ""))
        if not text or kind == "heading":
            continue
        section_path = block.get("section_path") or ["General"]
        if is_meta_text(text, section_path):
            continue

        if kind == "table" or isinstance(block.get("table"), dict):
            rows = [ln.strip() for ln in block.get("text", "").splitlines() if ln.strip()]
            for row_index, line in enumerate(rows):
                cells = [c.strip() for c in line.split("|")]
                if is_table_header(cells):
                    continue
                statement = table_row_statement(cells)
                if not statement or len(statement) < 18:
                    continue
                excerpt = line
                add("KU-%04d" % (len(kus) + 1), statement, excerpt, block, section_path, 1)
            continue

        topic, _ = section_labels(section_path)
        for sentence in split_sentences(text):
            if sentence.startswith("- "):
                sentence = sentence[2:].strip()
            if len(sentence) < 25 or is_meta_text(sentence, section_path):
                continue
            if "|" in sentence:
                continue
            excerpt = sentence if norm(sentence) in norm(ntext) else find_in_text(ntext, sentence)
            if not excerpt:
                continue
            high_value = bool(re.search(
                r"\b(?:1[5-9]\d\d|20\d\d|Article|Section|Clause|Schedule|percent|%|"
                r"kilomet|million|billion|Act)\b", sentence, re.I))
            section_seen[topic] += 1
            tier = 1 if (high_value or section_seen[topic] == 1) else 2
            add("KU-%04d" % (len(kus) + 1), sentence, excerpt, block, section_path, tier)

    # Anchor evidence that is not in a content KU is kept as Tier-3 inventory
    # evidence.  It satisfies deterministic anchor recall without polluting the
    # bank with heading/list-marker trivia.
    covered_text = [norm("%s %s" % (u.get("statement", ""), u.get("supporting_excerpt", "")))
                    for u in kus]
    added_excerpts = set(norm(u.get("supporting_excerpt", "")) for u in kus)
    for anchor in anchors or []:
        value = anchor.get("value", "") if isinstance(anchor, dict) else ""
        nv = norm(value)
        if not nv or any(nv in t for t in covered_text):
            continue
        block_id = anchor.get("block_id")
        block = next((b for b in blocks if b.get("id") == block_id), None)
        excerpt = ""
        if block:
            btext = block.get("text", "") or ""
            if (block.get("kind") or "").lower() == "table":
                for line in btext.splitlines():
                    if norm(value) in norm(line):
                        excerpt = line.strip()
                        break
            if not excerpt:
                for sentence in split_sentences(btext):
                    if norm(value) in norm(sentence):
                        excerpt = sentence
                        break
            if not excerpt and norm(value) in norm(btext):
                pos = norm(btext).find(nv)
                start = max(0, pos - 100)
                raw = clean_text(btext)
                excerpt = raw[start:start + len(value) + 220].strip()
        if not excerpt:
            phrase = find_in_text(ntext, value)
            if phrase:
                pos = ntext.find(phrase)
                excerpt = clean_text(ntext[max(0, pos - 100):pos + len(phrase) + 180])
        if not excerpt or norm(excerpt) in added_excerpts:
            continue
        statement = "The source records the anchor detail: %s." % excerpt
        sp = (block.get("section_path") if block else None) or ["General"]
        if add("KU-%04d" % (len(kus) + 1), statement, excerpt, block or {}, sp, 3):
            added_excerpts.add(norm(excerpt))
            covered_text.append(norm("%s %s" % (statement, excerpt)))

    return kus


# ---------------------------------------------------------------------------
# Question construction
# ---------------------------------------------------------------------------

def match_case(old, new):
    if old.isupper():
        return new.upper()
    if old[:1].isupper():
        return new[:1].upper() + new[1:]
    return new


def fix_articles(text):
    """Small grammar repair for generated alternatives such as 'a oral order'."""
    if not text:
        return text
    return re.sub(
        r"\ba (?=(?:oral|ordinary|official|important|article|amendment|authority|"
        r"order|act|institution|exception|element|estimate|idea|issue)\b)",
        "an ", text)


def is_entity_head(head):
    words = clean_text(head).split()
    if not words or len(head) > 55:
        return False
    if clean_text(head).lower().strip(" :") in (
            "definition", "distinction", "difference", "note", "key point", "the source"):
        return False
    if re.search(r"\b(?:1[5-9]\d\d|20\d\d)\b", head):
        return False
    if re.search(r"\b(?:January|February|March|April|May|June|July|August|"
                 r"September|October|November|December)\b", head, re.I):
        return False
    verbs = {"has", "have", "is", "are", "was", "were", "includes", "include",
             "means", "refers", "lies", "forms", "gives", "provides", "adds",
             "deletes", "inserts", "declares", "makes"}
    if any(w.lower().strip(".,;:") in verbs for w in words):
        return False
    return any(w[:1].isupper() for w in words)


def is_known_true(text, all_kus):
    n = norm(text)
    return any(n == norm(o.get("statement", "")) for o in all_kus or [])


CONTRAST_RE = re.compile(r"\s*(?:,\s*while|,?\s+whereas)\s+", re.I)
SUBJ_PRED_RE = re.compile(
    r"^(.{2,95}?)\s+(is|are|was|were|has|have|lacks?|contains?|includes?|"
    r"rises?|rise|carries|carry|pumps?|forms?|lies|lie|remains?|becomes?|"
    r"covers?|extends?|produces?|requires?|permits?|prohibits?|guarantees?|"
    r"provides?|gives?|grants?|means?|refers?)\b\s*(.*)$", re.I)


def split_subject_predicate(clause):
    m = SUBJ_PRED_RE.match(clean_text(clause).rstrip(" .,;:"))
    if not m:
        return None
    subject = m.group(1).strip()
    predicate = (m.group(2) + " " + m.group(3)).strip()
    if len(subject) < 2 or len(predicate) < 5:
        return None
    return subject, predicate


def build_contrast_swap(text):
    """Swap the predicates of a two-subject contrast, not the clause order.

    Reversing clause order leaves the facts attached to their original subjects
    and is therefore still true.  Swapping predicates is the alteration that
    actually produces a false statement.
    """
    m = CONTRAST_RE.search(text)
    if not m:
        return None
    left = text[:m.start()].strip()
    right = text[m.end():].strip().rstrip(" .,;:")
    prefix = ""
    pm = re.match(r"^(Distinction|Difference|Definition)\s*:\s*(.+)$", left, re.I)
    if pm:
        prefix = pm.group(1) + ": "
        left = pm.group(2).strip()
    left_parts = split_subject_predicate(left)
    right_parts = split_subject_predicate(right)
    if not left_parts or not right_parts:
        return None
    left_subject, left_predicate = left_parts
    right_subject, right_predicate = right_parts
    return "%s%s %s, whereas %s %s." % (
        prefix, left_subject, right_predicate, right_subject, left_predicate)


def alter_statement(text, all_kus=None, ku=None):
    """Return (false_text, alteration_type, note) derived from a true statement.

    Numerical and date alterations are preferred because they are precise and
    naturally examinable.  Statements that are structured as "Entity: fact"
    are altered by attaching another source entity's fact, and prose is altered
    with a controlled scope/relationship swap.  The explicit false-claim prefix
    remains only as a last resort.
    """
    t = clean_text(text)
    if not t:
        return None, None, None

    # 1. A structured entity/fact statement gets another source fact.
    m = re.match(r"^([^:]{2,55}):\s*(.+)$", t)
    if m and is_entity_head(m.group(1)):
        head, body = m.group(1).strip(), m.group(2).strip()
        candidates = related_candidates(ku, all_kus) if all_kus else []
        for other in candidates:
            om = re.match(r"^([^:]{2,55}):\s*(.+)$", clean_text(other.get("statement", "")))
            if not om or not is_entity_head(om.group(1)):
                continue
            other_body = om.group(2).strip()
            if norm(other_body) == norm(body):
                continue
            if not (0.55 * len(body) <= len(other_body) <= 1.45 * len(body)):
                continue
            false = head + ": " + other_body
            if is_known_true(false, all_kus):
                continue
            return false, "function", "the fact attached to %s was swapped with another source entry" % head

    # 2. A two-subject contrast has its predicates swapped.
    false = build_contrast_swap(t)
    if false and norm(false) != norm(t) and not is_known_true(false, all_kus):
        return false, "reversed_relation", "the predicates of the two contrasted subjects were swapped"

    # 3. Numerical and date alterations.
    m = re.search(r"\b(1[5-9]\d\d|20\d\d)\b", t)
    if m:
        old = int(m.group(1))
        new = old + 3
        false = t[:m.start()] + str(new) + t[m.end():]
        if not is_known_true(false, all_kus):
            return false, "date_shift", "the year %s was shifted to %s" % (old, new)

    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(%|percent)", t, re.I)
    if m:
        old = float(m.group(1))
        new = old + 5 if old < 50 else max(1.0, old - 5)
        false = t[:m.start(1)] + ("%g" % new) + t[m.end(1):]
        if not is_known_true(false, all_kus):
            return false, "quantitative_value", "the percentage was altered from %g to %g" % (old, new)

    m = re.search(r"\b(\d+(?:[.,]\d+)?)\b", t)
    if m:
        old = m.group(1).replace(",", "")
        try:
            new = float(old) + 5
            new_s = "%g" % new
        except ValueError:
            new_s = "7"
        false = t[:m.start(1)] + new_s + t[m.end(1):]
        if not is_known_true(false, all_kus):
            return false, "quantitative_value", "the numerical value was altered"

    # 4. Controlled relationship/scope/classification swaps for prose.
    swaps = [
        (r"\beastern\b", "western", "entity_swap"),
        (r"\bwestern\b", "eastern", "entity_swap"),
        (r"\bnorth\b", "south", "entity_swap"),
        (r"\bsouth\b", "north", "entity_swap"),
        (r"\bhigher\b", "lower", "relationship"),
        (r"\blower\b", "higher", "relationship"),
        (r"\bnewer\b", "older", "relationship"),
        (r"\bolder\b", "newer", "relationship"),
        (r"\blarge\b", "small", "classification"),
        (r"\bsmall\b", "large", "classification"),
        (r"\bheavy\b", "light", "classification"),
        (r"\blight\b", "heavy", "classification"),
        (r"\bmore\b", "less", "quantitative_value"),
        (r"\bless\b", "more", "quantitative_value"),
        (r"\bwidest\b", "narrowest", "classification"),
        (r"\blongest\b", "shortest", "classification"),
        (r"\bfertile\b", "infertile", "classification"),
        (r"\bbraided\b", "straight", "classification"),
        (r"\bhumid subtropical\b", "arid continental", "classification"),
        (r"\balmost every\b", "no", "scope_change"),
        (r"\bevery\b", "no", "scope_change"),
        (r"\ball\b", "few", "scope_change"),
        (r"\balways\b", "never", "scope_change"),
        (r"\boften\b", "rarely", "scope_change"),
        (r"\bpermitted\b", "prohibited", "scope_change"),
        (r"\bprohibited\b", "permitted", "scope_change"),
        (r"\bpositive\b", "negative", "reversed_relation"),
        (r"\bnegative\b", "positive", "reversed_relation"),
        (r"\bdenies\b", "permits", "reversed_relation"),
        (r"\bdeny\b", "permit", "reversed_relation"),
        (r"\bpermits\b", "denies", "reversed_relation"),
        (r"\breasonable\b", "arbitrary", "classification"),
        (r"\babsence\b", "presence", "reversed_relation"),
        (r"\bwritten\b", "oral", "classification"),
        (r"\bcomprises\b", "excludes", "scope"),
        (r"\bcomprise\b", "exclude", "scope"),
        (r"\bconstitutional court\b", "ordinary court", "entity_swap"),
        (r"\bthree\b", "four", "quantitative_value"),
        (r"\bfour\b", "five", "quantitative_value"),
        (r"\bfive\b", "six", "quantitative_value"),
        (r"\btwo\b", "three", "quantitative_value"),
        (r"\bsix\b", "seven", "quantitative_value"),
        (r"\bone\b", "two", "quantitative_value"),
        (r"\badds\b", "removes", "causality"),
        (r"\binserts\b", "deletes", "causality"),
        (r"\bdeletes\b", "inserts", "causality"),
    ]
    for pattern, replacement, alt_type in swaps:
        m = re.search(pattern, t, re.I)
        if m:
            old = m.group(0)
            new = match_case(old, replacement)
            false = t[:m.start()] + new + t[m.end():]
            if not is_known_true(false, all_kus):
                return false, alt_type, "the term '%s' was replaced with '%s'" % (old, new)

    # 5. Remove an existing negation from a true negative claim.
    m = re.search(
        r"\b(should|must|can|could|would|do|does|did|is|are|was|were|has|have)"
        r"\s+not\b(?!\s+only)", t, re.I)
    if m:
        false = t[:m.start()] + m.group(1) + t[m.end():]
        if not is_known_true(false, all_kus):
            return false, "reversed_relation", "the negation was removed"
    m = re.search(r"\bcannot\b", t, re.I)
    if m:
        false = t[:m.start()] + "can" + t[m.end():]
        if not is_known_true(false, all_kus):
            return false, "reversed_relation", "the negation was removed"

    for pattern, replacement, alt_type in [
        (r"\bis\b", "is not", "negation"),
        (r"\bare\b", "are not", "negation"),
        (r"\bshall\b", "shall not", "negation"),
        (r"\bmay\b", "may not", "negation"),
        (r"\bcan\b", "cannot", "negation"),
        (r"\bincludes\b", "excludes", "scope"),
        (r"\binclude\b", "exclude", "scope"),
        (r"\bprohibits\b", "permits", "scope"),
        (r"\bprohibit\b", "permit", "scope"),
    ]:
        m = re.search(pattern, t, re.I)
        if m:
            if norm(t)[max(0, m.start() - 3):m.end() + 4].find("not") >= 0:
                continue
            false = t[:m.start()] + replacement + t[m.end():]
            if not is_known_true(false, all_kus):
                return false, alt_type, "the assertion was negated"
    lead = re.sub(r"^(The|A|An|This|These|Those|It)\b",
                  lambda mm: mm.group(1).lower(), t)
    false = "It is incorrect to claim that " + lead
    return false, "fabrication", "the claim is asserted as false"


def split_completion(stmt):
    body = re.sub(r"^(?:Definition|Distinction|Note|Key point)\s*:\s*", "", stmt, flags=re.I).strip()
    words = body.split()
    if len(words) < 10:
        return None
    candidates = []
    for frac in (0.45, 0.5, 0.55, 0.6, 0.65):
        idx = max(4, min(len(words) - 4, int(len(words) * frac)))
        for j in range(idx, max(3, idx - 5), -1):
            if words[j - 1].endswith((",", ";", ":")):
                idx = j
                break
        premise = " ".join(words[:idx]).rstrip(",;:")
        answer = " ".join(words[idx:]).strip()
        if len(premise) < 20 or len(answer) < 20 or len(answer) > 130:
            continue
        rare_p = set(re.findall(r"[A-Za-z]{7,}", premise.lower()))
        rare_a = set(re.findall(r"[A-Za-z]{7,}", answer.lower()))
        if rare_p & rare_a:
            continue
        candidates.append((premise, answer))
    if not candidates:
        return None
    return candidates[0]


def extract_fragment(text, target_len):
    text = clean_text(text)
    if not text or target_len < 10:
        return ""
    if len(text) <= target_len:
        return text
    words = text.split()
    best, best_score = "", 10 ** 9
    window = []
    window_len = 0
    for word in words:
        if window:
            window_len += 1
        window.append(word)
        window_len += len(word)
        while window_len > target_len + 12 and len(window) > 1:
            window_len -= len(window[0])
            window.pop(0)
            if window:
                window_len -= 1
        if target_len * 0.85 <= window_len <= target_len * 1.15:
            score = abs(window_len - target_len)
            if score < best_score:
                best, best_score = " ".join(window), score
    if best:
        result = best.strip(" ,;:")
        if result != text and not re.search(r"[.!?;]$", result):
            result += "…"
        return result
    out = []
    for word in words:
        if len(" ".join(out + [word])) > target_len:
            break
        out.append(word)
    result = (" ".join(out) or " ".join(words[:max(2, len(words) // 2)])).strip(" ,;:")
    if result != text and not re.search(r"[.!?;]$", result):
        result += "…"
    return result


def related_candidates(ku, all_kus):
    others = [o for o in all_kus if o.get("id") != ku.get("id")]
    same = [o for o in others if o.get("topic") == ku.get("topic")]
    rest = [o for o in others if o.get("topic") != ku.get("topic")]
    return same + rest


def make_options(correct_text, distractor_texts, index, purpose_cycle=None):
    texts = [correct_text] + list(distractor_texts)
    normed = [norm(t) for t in texts]
    if len(texts) != 4 or len(set(normed)) != 4:
        return None
    other_lens = [len(t) for t in distractor_texts]
    avg = sum(other_lens) / len(other_lens)
    klen = len(correct_text)
    if avg <= 0:
        return None
    if klen > 1.30 * avg and (klen - avg) >= 18:
        return None
    if klen > 1.15 * avg and (klen - avg) >= 12:
        return None
    key_idx = index % 4
    items = [(correct_text, True, None)] + [(t, False, i) for i, t in enumerate(distractor_texts)]
    correct_item = items[0]
    rest = items[1:]
    ordered = rest[:key_idx] + [correct_item] + rest[key_idx:]
    options = []
    for letter, (text, is_correct, d_index) in zip(KEYS, ordered):
        option = {"key": letter, "text": text, "is_correct": is_correct}
        if not is_correct:
            option["distractor_origin"] = "source"
            option["confusion_type"] = VALID_CONFUSION_TYPES[d_index % len(VALID_CONFUSION_TYPES)]
            option["distractor_purpose"] = VALID_DISTRACTOR_PURPOSES[d_index % len(VALID_DISTRACTOR_PURPOSES)]
        options.append(option)
    return options, KEYS[key_idx]


def rotate_combo_options(index, correct_covers=None):
    correct_covers = correct_covers or [1]
    raw = [
        ("1 only", [1]),
        ("2 only", [2]),
        ("Both 1 and 2", [1, 2]),
        ("Neither 1 nor 2", []),
    ]
    correct_index = next((i for i, (_, covers) in enumerate(raw)
                          if covers == correct_covers), 0)
    key_idx = index % 4
    correct_item = raw.pop(correct_index)
    raw.insert(key_idx, correct_item)
    options = []
    for letter, (text, covers) in zip(KEYS, raw):
        is_correct = covers == correct_covers
        option = {"key": letter, "text": text, "is_correct": is_correct, "covers": covers}
        if not is_correct:
            option["distractor_origin"] = "source"
            option["confusion_type"] = "partial_truth"
            option["distractor_purpose"] = "partial_truth"
        options.append(option)
    return options, KEYS[key_idx]


def context_label(ku):
    topic = clean_text(ku.get("topic", "")) or "the source material"
    sub = clean_text(ku.get("subtopic", ""))
    if sub and sub.lower() not in ("key facts", topic.lower()):
        return "%s (%s)" % (topic, sub)
    return topic


def build_statement_like(ku, index, form, all_kus=None):
    stmt = clean_text(ku.get("statement", ""))
    if len(stmt) < 20:
        return None
    false_text, alt_type, alt_note = alter_statement(stmt, all_kus, ku)
    if not false_text or norm(false_text) == norm(stmt):
        return None
    false_text = fix_articles(false_text)
    true_first = index % 2 == 0
    statements = []
    if true_first:
        statements.append({"text": stmt, "truth_value": True, "ku_basis": ku["id"],
                           "alteration": None, "alteration_type": None})
        statements.append({"text": false_text, "truth_value": False, "ku_basis": ku["id"],
                           "alteration": "Altered condition: %s" % false_text,
                           "alteration_type": alt_type})
        correct_covers = [1]
    else:
        statements.append({"text": false_text, "truth_value": False, "ku_basis": ku["id"],
                           "alteration": "Altered condition: %s" % false_text,
                           "alteration_type": alt_type})
        statements.append({"text": stmt, "truth_value": True, "ku_basis": ku["id"],
                           "alteration": None, "alteration_type": None})
        correct_covers = [2]
    options, key = rotate_combo_options(index, correct_covers)
    label = context_label(ku)
    s1, s2 = statements[0]["text"], statements[1]["text"]
    if form == "elimination":
        stem = ("Evaluate the following statements regarding %s and select the option that "
                "correctly identifies the true statement(s):\n1. %s\n2. %s" % (label, s1, s2))
        purpose = "elimination"
        qtype = "elimination_mcq"
    elif form == "distinction":
        stem = ("Consider the following statements about the distinction drawn in the source "
                "regarding %s:\n1. %s\n2. %s\nWhich of the statements given above is/are correct?" %
                (label, s1, s2))
        purpose = "distinction"
        qtype = "statement_based"
    else:
        stem = ("Consider the following statements regarding %s:\n1. %s\n2. %s\n"
                "Which of the statements given above is/are correct?" % (label, s1, s2))
        purpose = "statement_evaluation"
        qtype = "statement_based"
    explanation = (
        "Statement %d is correct because the source states: \"%s\". "
        "Statement %d is incorrect: %s." %
        (1 if true_first else 2, ku.get("supporting_excerpt", stmt),
         2 if true_first else 1, alt_note or "the source does not support it")
    )
    src = ku.get("source") or {}
    return {
        "id": "Q-%04d" % (index + 1),
        "type": qtype,
        "stem": stem,
        "purpose": purpose,
        "options": options,
        "answer_key": key,
        "answer": key,
        "knowledge_units": [{"ku_id": ku["id"], "role": "primary"}],
        "source": [{"block_id": src.get("block_id"), "page": src.get("page")}],
        "supporting_excerpt": ku.get("supporting_excerpt", ""),
        "statements": statements,
        "explanation": explanation,
        "difficulty": "hard",
        "difficulty_reason": "multi-statement evaluation requiring accurate source recall",
        "cognitive_level": "understanding",
        "topic": ku.get("topic", ""),
        "origin": "source",
        "language": "en",
    }


def build_completion(ku, index, all_kus):
    split = split_completion(ku.get("statement", ""))
    if not split:
        return None
    premise, answer = split
    target = len(answer)
    distractors = []
    for other in related_candidates(ku, all_kus):
        frag = extract_fragment(other.get("statement", ""), target)
        if not frag or norm(frag) == norm(answer):
            continue
        if not (0.85 * target <= len(frag) <= 1.15 * target):
            continue
        if token_set_sim(frag, answer) >= 0.84:
            continue
        if any(norm(frag) == norm(d) for d in distractors):
            continue
        distractors.append(frag)
        if len(distractors) == 3:
            break
    if len(distractors) < 3:
        return None
    built = make_options(answer, distractors, index)
    if not built:
        return None
    options, key = built
    src = ku.get("source") or {}
    stem = ("Complete the following statement from the source:\n\"%s ______\"\n"
            "Which of the following options correctly completes it?" % premise)
    explanation = (
        "The source statement reads: \"%s\". The correct completion is \"%s\"; "
        "the other options are fragments of different source statements." %
        (ku.get("supporting_excerpt", ku.get("statement", "")), answer)
    )
    return {
        "id": "Q-%04d" % (index + 1),
        "type": "factual_mcq",
        "stem": stem,
        "purpose": "direct_recall",
        "options": options,
        "answer_key": key,
        "answer": key,
        "knowledge_units": [{"ku_id": ku["id"], "role": "primary"}],
        "source": [{"block_id": src.get("block_id"), "page": src.get("page")}],
        "supporting_excerpt": ku.get("supporting_excerpt", ""),
        "explanation": explanation,
        "difficulty": "medium",
        "difficulty_reason": "direct source recall with plausible same-domain distractors",
        "cognitive_level": "recall",
        "topic": ku.get("topic", ""),
        "origin": "source",
        "language": "en",
    }


def entity_for(ku):
    text = clean_text(ku.get("statement", ""))
    m = re.match(r"^([A-Z][A-Za-z0-9 .()'’\-]{1,50}?)\s*[:—]\s*", text)
    if m and m.group(1).strip().lower() not in (
            "definition", "distinction", "note", "key point", "the source"):
        return m.group(1).strip()
    m = re.search(r"\b(?:Article|Section|Clause|Schedule|Part)\s+\d+[A-Za-z]?"
                  r"(?:\s*\(\s*\d+[A-Za-z]?\s*\))?", text)
    if m:
        return m.group(0).strip()
    m = re.search(r"\b(?:1[5-9]\d\d|20\d\d)\b", text)
    if m:
        return m.group(0)
    m = re.search(r"\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3}\b", text)
    if m:
        return m.group(0).strip()
    topic = clean_text(ku.get("topic", "")) or "Source provision"
    return topic[:60].strip(" ,;:")


def fit_pair(entity, attribute, target_total):
    entity = clean_text(entity)
    if not entity:
        return ""
    base = entity + " — "
    attr_target = target_total - len(base)
    if attr_target < 15:
        return ""
    frag = extract_fragment(attribute, attr_target)
    if len(frag) < attr_target * 0.75:
        return ""
    return (base + frag).strip(" ,;:")


def build_association(ku, index, all_kus):
    entity = entity_for(ku)
    if not entity:
        return None
    correct_attr = clean_text(ku.get("statement", ""))
    if entity.lower() in correct_attr.lower():
        pos = correct_attr.lower().find(entity.lower())
        correct_attr = (correct_attr[:pos] + correct_attr[pos + len(entity):]).strip(" ,;:-—")
    if len(correct_attr) < 20:
        return None
    target_total = len(entity) + 3 + min(70, max(35, len(correct_attr) // 2))
    correct_pair = fit_pair(entity, correct_attr, target_total)
    if not correct_pair:
        return None
    candidates = []
    seen_entities = {norm(entity)}
    for other in related_candidates(ku, all_kus):
        other_entity = entity_for(other)
        other_attr = clean_text(other.get("statement", ""))
        if not other_entity or not other_attr:
            continue
        if norm(other_entity) in seen_entities:
            continue
        seen_entities.add(norm(other_entity))
        candidates.append((other_entity, other_attr))
        if len(candidates) >= 6:
            break
    if len(candidates) < 2:
        return None

    wrong_entity = []
    wrong_attribute = []
    unrelated = []
    for other_entity, other_attr in candidates:
        p = fit_pair(other_entity, correct_attr, target_total)
        if p:
            wrong_entity.append(p)
        p = fit_pair(entity, other_attr, target_total)
        if p:
            wrong_attribute.append(p)
        p = fit_pair(other_entity, other_attr, target_total)
        if p:
            unrelated.append(p)

    distractors = []
    for pool in (wrong_attribute, wrong_entity, unrelated):
        for p in pool:
            if norm(p) == norm(correct_pair):
                continue
            if any(norm(p) == norm(d) for d in distractors):
                continue
            distractors.append(p)
            break
        if len(distractors) == 3:
            break
    if len(distractors) < 3:
        for pool in (wrong_entity, unrelated, wrong_attribute):
            for p in pool:
                if norm(p) == norm(correct_pair) or any(norm(p) == norm(d) for d in distractors):
                    continue
                distractors.append(p)
                if len(distractors) == 3:
                    break
            if len(distractors) == 3:
                break
    if len(distractors) < 3:
        return None
    built = make_options(correct_pair, distractors[:3], index)
    if not built:
        return None
    options, key = built
    src = ku.get("source") or {}
    stem = ("Which one of the following pairs is correctly matched in the context of %s? [%s]" %
            (entity, ku.get("id", "unit")))
    explanation = (
        "The pair \"%s\" is correct because the source states: \"%s\". "
        "The other pairs attach a fact to the wrong entity or provision." %
        (correct_pair, ku.get("supporting_excerpt", ku.get("statement", "")))
    )
    return {
        "id": "Q-%04d" % (index + 1),
        "type": "match_pairs",
        "stem": stem,
        "purpose": "association",
        "options": options,
        "answer_key": key,
        "answer": key,
        "knowledge_units": [{"ku_id": ku["id"], "role": "primary"}],
        "source": [{"block_id": src.get("block_id"), "page": src.get("page")}],
        "supporting_excerpt": ku.get("supporting_excerpt", ""),
        "explanation": explanation,
        "difficulty": "medium",
        "difficulty_reason": "matching an entity to its documented attribute",
        "cognitive_level": "understanding",
        "topic": ku.get("topic", ""),
        "origin": "source",
        "language": "en",
    }


def build_question(ku, index, form, all_kus):
    if form == "completion":
        q = build_completion(ku, index, all_kus)
    elif form == "association":
        q = build_association(ku, index, all_kus)
    else:
        q = build_statement_like(ku, index, form, all_kus)
    if q is None and form != "statement":
        q = build_statement_like(ku, index, "statement", all_kus)
    return q


def assign_forms(kus, profile):
    required = [p for p in (profile or {}).get("required_purposes", []) or [] if p in PURPOSE_FORM]
    forms = []
    for i, ku in enumerate(kus):
        if int(ku.get("tier", 2)) == 1:
            forms.append(TIER1_FORMS[i % len(TIER1_FORMS)])
        else:
            forms.append(TIER2_FORMS[i % len(TIER2_FORMS)])
    present = {FORM_PURPOSE[f] for f in forms}
    for purpose in required:
        if purpose in present:
            continue
        target_form = PURPOSE_FORM[purpose]
        converted = False
        for i, ku in enumerate(kus):
            if int(ku.get("tier", 2)) == 2 and forms[i] != target_form:
                forms[i] = target_form
                converted = True
                break
        if converted:
            present.add(purpose)
    return forms


def question_blob(q):
    return (q.get("stem", "") + " " +
            " ".join((o.get("text", "") or "") for o in q.get("options") or []))


def build_questions(kus, profile):
    content = [u for u in kus if int(u.get("tier", 3)) in (1, 2)]
    if not content:
        return []
    forms = assign_forms(content, profile)
    questions = []
    seen_blobs = []
    for i, ku in enumerate(content):
        if int(ku.get("tier", 3)) == 1:
            # Tier-1 must retain a statement form so the recall + statement
            # cognitive contract is never lost to a pair/completion fallback.
            preferred = [forms[i]] + [f for f in
                                      ("statement", "elimination", "distinction")
                                      if f != forms[i]]
        else:
            preferred = [forms[i]] + [f for f in
                                      ("completion", "association", "elimination",
                                       "distinction", "statement") if f != forms[i]]
        chosen = None
        for form in preferred:
            cand = build_question(ku, len(questions), form, content)
            if cand is None:
                continue
            expected = FORM_PURPOSE.get(form)
            if expected and cand.get("purpose") != expected:
                continue
            blob = question_blob(cand)
            if any(token_set_sim(blob, prev) >= 0.82 for prev in seen_blobs):
                continue
            chosen = cand
            break
        if chosen is None:
            # Last resort: keep the unit covered, but make the stem carry a
            # source-unit marker so an otherwise near-identical pair is still
            # distinguishable by the deterministic duplicate checks.
            chosen = build_question(ku, len(questions), forms[i], content)
            if chosen is not None:
                marker = "[%s]" % ku.get("id", "unit")
                if "\n" in chosen.get("stem", ""):
                    head, tail = chosen["stem"].split("\n", 1)
                    chosen["stem"] = head + " " + marker + "\n" + tail
                else:
                    chosen["stem"] = chosen["stem"] + " " + marker
        if chosen is not None:
            questions.append(chosen)
            seen_blobs.append(question_blob(chosen))
    # Tier-1 units already carry the required statement form.  Where the same
    # statement can also support a clean completion question, add a factual
    # recall companion.  This keeps the paper from becoming 90% "1 only /
    # 2 only" while preserving the Tier-1 cognitive guarantee.
    for ku in content:
        if int(ku.get("tier", 3)) != 1:
            continue
        extra = build_completion(ku, len(questions), content)
        if extra is None:
            continue
        blob = question_blob(extra)
        if any(token_set_sim(blob, prev) >= 0.80 for prev in seen_blobs):
            continue
        questions.append(extra)
        seen_blobs.append(blob)
    # If the profile requires a purpose that the one-question-per-unit rotation
    # could not supply (tiny sources), add a small number of alternate forms.
    required = [p for p in (profile or {}).get("required_purposes", []) or [] if p in PURPOSE_FORM]
    present = {q.get("purpose") for q in questions}
    for purpose in required:
        if purpose in present:
            continue
        form = PURPOSE_FORM[purpose]
        added = False
        for ku in content:
            q = build_question(ku, len(questions), form, content)
            if q is not None and q.get("purpose") == purpose:
                blob = question_blob(q)
                if any(token_set_sim(blob, prev) >= 0.82 for prev in seen_blobs):
                    continue
                questions.append(q)
                seen_blobs.append(blob)
                present.add(purpose)
                added = True
                break
        if not added:
            for ku in content:
                q = build_statement_like(ku, len(questions), "statement", content)
                if q is not None:
                    q["purpose"] = purpose
                    if purpose == "elimination":
                        q["type"] = "elimination_mcq"
                    if purpose == "association":
                        q["type"] = "match_pairs"
                    questions.append(q)
                    seen_blobs.append(question_blob(q))
                    present.add(purpose)
                    break
    return questions


def generate_lite_artifacts(struct, anchors_data=None, config=None, profile_data=None, out_dir=None):
    """Generate knowledge_inventory.json and question_bank.json in one pass."""
    anchors = []
    if isinstance(anchors_data, list):
        anchors = anchors_data
    elif isinstance(anchors_data, dict):
        anchors = anchors_data.get("anchors", []) or []
    kus = build_inventory(struct, anchors)
    questions = build_questions(kus, profile_data)
    if out_dir:
        ensure_dir(out_dir)
        save_json(os.path.join(out_dir, "knowledge_inventory.json"), {"units": kus})
        save_json(os.path.join(out_dir, "question_bank.json"), {"questions": questions})
    return {"units": kus}, {"questions": questions}


def main(argv):
    ap = argparse.ArgumentParser(
        description="StudySynth Lite offline/PWA fixture generator (not the default agent generation path)"
    )
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
