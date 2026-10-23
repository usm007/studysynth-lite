/**
 * StudySynth Lite — Client-Side Deterministic Quiz Engine
 * Runs 100% offline in browser (Android PWA) and Node.js environments.
 * Ported from StudySynth Lite deterministic architecture.
 */

(function (global) {
  'use strict';

  const KEYS = ['A', 'B', 'C', 'D'];
  const VALID_CONFUSION_TYPES = [
    'adjacent_value', 'wrong_entity', 'wrong_date', 'partial_truth',
    'near_synonym', 'wrong_place', 'scope_error', 'reversed_relation'
  ];
  const VALID_DISTRACTOR_PURPOSES = [
    'adjacent_value', 'wrong_entity', 'wrong_date', 'partial_truth',
    'confusable_fact', 'wrong_category', 'scope_error', 'reversed_relation'
  ];

  function cleanText(str) {
    if (!str) return '';
    return str.toString().normalize('NFKC').replace(/\s+/g, ' ').trim();
  }

  function splitSentences(text, locale = 'en') {
    text = cleanText(text);
    if (!text) return [];

    // Prefer native Intl.Segmenter if available (covers multilingual & Indic scripts)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try {
        const segmenter = new Intl.Segmenter(locale, { granularity: 'sentence' });
        const segments = Array.from(segmenter.segment(text), s => s.segment.trim());
        const result = [];
        for (const seg of segments) {
          if (seg.length >= 25 && seg.length <= 320) {
            result.push(seg);
          } else if (seg.length > 320) {
            // sub-split long compound sentences on semicolons or bullet delimiters
            const subs = seg.split(/;\s*|(?<=\w)\s*●\s*|(?<=\w)\s*[-—]\s*(?=[A-Z0-9])/);
            for (const sub of subs) {
              const cleanSub = cleanText(sub);
              if (cleanSub.length >= 25 && cleanSub.length <= 250) {
                result.push(cleanSub);
              }
            }
          }
        }
        if (result.length > 0) return result;
      } catch (e) {
        // fallback to regex below
      }
    }

    // Fallback regex supporting Latin and Indic sentence endings (., !, ?, ।, ॥)
    const rawParts = text.split(/(?<=[.!?;।॥\n])\s+(?=[A-Z0-9A-Za-z\u0900-\u097F])/);
    const res = [];
    for (const p of rawParts) {
      const pStr = cleanText(p);
      if (pStr.length >= 25 && pStr.length <= 320) {
        res.push(pStr);
      } else if (pStr.length > 320) {
        const subs = pStr.split(/;\s*|,\s*(?=[A-Z\u0900-\u097F])/);
        for (const sub of subs) {
          const cleanSub = cleanText(sub);
          if (cleanSub.length >= 25 && cleanSub.length <= 250) {
            res.push(cleanSub);
          }
        }
      }
    }
    return res;
  }

  function extractAnchors(text) {
    const anchors = new Set();
    const clean = cleanText(text);

    // Entity patterns (Schemes, Articles, Institutions, Quantities, Years)
    const patterns = [
      /\b(?:Article\s+\d+(?:\([a-z0-9]+\))*)/gi,
      /\b(?:Act,?\s+\d{4})/gi,
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
      /\b[A-Z]{2,}(?:-[A-Z]+)?\b/g,
      /(?:₹|\$|US\$)\s*[\d,.]+\s*(?:crore|billion|lakh|million|trillion)?/gi,
      /\b(?:19|20)\d{2}\b/g
    ];

    for (const pat of patterns) {
      const matches = clean.match(pat);
      if (matches) {
        for (const m of matches) {
          const item = m.trim();
          if (item.length >= 3 && !/^(The|And|With|From|This|That|Under|Also|Such|Into)$/i.test(item)) {
            anchors.add(item);
          }
        }
      }
    }

    return Array.from(anchors);
  }

  function balanceDistractorLength(correctText, distractorText) {
    const targetLen = correctText.length;
    let d = cleanText(distractorText);

    // If distractor is much shorter (<75% of correct length), pad with context
    if (d.length < targetLen * 0.75) {
      const diff = targetLen - d.length;
      if (diff > 25) {
        d = d.replace(/[.]+$/, '') + ', in accordance with statutory guidelines and regulatory frameworks.';
      } else {
        d = d.replace(/[.]+$/, '') + ' under applicable norms.';
      }
    }
    // If distractor is much longer (>130% of correct length), truncate cleanly
    else if (d.length > targetLen * 1.30 && d.length > 50) {
      const cut = d.slice(0, Math.floor(targetLen * 1.15));
      const lastSpace = cut.lastIndexOf(' ');
      if (lastSpace > 30) {
        d = cut.slice(0, lastSpace) + '.';
      } else {
        d = cut + '.';
      }
    }

    return d;
  }

  function splitSubjectPredicate(clause) {
    const text = cleanText(clause).replace(/[.,;:]+$/, '');
    const m = text.match(/^(.{2,95}?)\s+(is|are|was|were|has|have|lacks?|contains?|includes?|rises?|rise|carries|carry|pumps?|forms?|lies|lie|remains?|becomes?|covers?|extends?|produces?|requires?|permits?|prohibits?|guarantees?|provides?|gives?|grants?|means?|refers?)\b\s*(.*)$/i);
    if (!m) return null;
    const subject = m[1].trim();
    const predicate = (m[2] + ' ' + m[3]).trim();
    if (subject.length < 2 || predicate.length < 5) return null;
    return { subject, predicate };
  }

  // Deterministic false-statement builder.  It never uses randomness or a
  // model call; the same source sentence always yields the same alternative.
  function falsifyStatement(statement) {
    const text = cleanText(statement);
    if (!text) {
      return { text: 'This statement is not supported by the source.', note: 'empty statement' };
    }

    // Two-subject contrast: swap the predicates so the facts are attached to
    // the wrong subjects.  Reversing clause order would still be true.
    const cm = text.match(/\s*(?:,\s*while|,?\s+whereas)\s+/i);
    if (cm) {
      let left = text.slice(0, cm.index).trim();
      const right = text.slice(cm.index + cm[0].length).replace(/[.,;:]+$/, '').trim();
      let prefix = '';
      const pm = left.match(/^(Distinction|Difference|Definition)\s*:\s*(.+)$/i);
      if (pm) {
        prefix = pm[1] + ': ';
        left = pm[2].trim();
      }
      const lp = splitSubjectPredicate(left);
      const rp = splitSubjectPredicate(right);
      if (lp && rp) {
        const swapped = `${prefix}${lp.subject} ${rp.predicate}, whereas ${rp.subject} ${lp.predicate}.`;
        if (swapped !== text) {
          return {
            text: swapped,
            note: 'the predicates of the two contrasted subjects were swapped'
          };
        }
      }
    }

    let m = text.match(/\b(1[5-9]\d\d|20\d\d)\b/);
    if (m) {
      const old = parseInt(m[1], 10);
      return { text: text.replace(m[1], String(old + 3)), note: `the year ${old} was shifted` };
    }

    m = text.match(/\b(\d+(?:\.\d+)?)\b/);
    if (m) {
      const old = parseFloat(m[1]);
      return { text: text.replace(m[1], String(old + 5)), note: 'the numerical value was altered' };
    }

    const numberWords = {
      one: 'two', two: 'three', three: 'four', four: 'five', five: 'six',
      six: 'seven', seven: 'eight', eight: 'nine', nine: 'ten', ten: 'eleven'
    };
    const nw = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
    if (nw) {
      const old = nw[1];
      return {
        text: text.replace(old, numberWords[old.toLowerCase()]),
        note: 'the stated number was altered'
      };
    }

    // Remove an existing negation from a true negative claim.
    const rm = text.match(/\b(should|must|can|could|would|do|does|did|is|are|was|were|has|have)\s+not\b(?!\s+only)/i);
    if (rm) {
      return {
        text: text.slice(0, rm.index) + rm[1] + text.slice(rm.index + rm[0].length),
        note: 'the negation was removed'
      };
    }
    const cnm = text.match(/\bcannot\b/i);
    if (cnm) {
      return {
        text: text.slice(0, cnm.index) + 'can' + text.slice(cnm.index + cnm[0].length),
        note: 'the negation was removed'
      };
    }

    const nm = text.match(/\b(is|are|was|were|has|have|can|shall|may|includes|include|covers|cover|comprises|comprise)\b/i);
    if (nm) {
      const word = nm[1];
      const low = word.toLowerCase();
      const scopeMap = {
        includes: 'excludes', include: 'exclude',
        covers: 'excludes', cover: 'exclude',
        comprises: 'excludes', comprise: 'exclude'
      };
      const replacement = scopeMap[low] || (word + ' not');
      const around = text.slice(Math.max(0, nm.index - 4), nm.index + word.length + 4).toLowerCase();
      if (!around.includes('not')) {
        return {
          text: text.slice(0, nm.index) + replacement + text.slice(nm.index + word.length),
          note: 'the assertion was negated'
        };
      }
    }

    const lead = text.replace(/^(The|A|An|This|These|Those|It)\b/, m => m.toLowerCase());
    return { text: 'It is not true that ' + lead, note: 'the claim is asserted as false' };
  }

  function buildKnowledgeInventory(sections) {
    const units = [];
    let kuCount = 0;

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];
      const title = sec.title || ('Section ' + (sIdx + 1));
      const text = sec.text || '';
      const sentences = splitSentences(text);

      for (let sNum = 0; sNum < sentences.length; sNum++) {
        kuCount++;
        const sent = sentences[sNum];
        const isCore = sNum === 0 || kuCount % 2 === 1;

        units.push({
          ku_id: 'KU-LITE-' + String(kuCount).padStart(3, '0'),
          tier: isCore ? 1 : 2,
          section_id: sec.id || ('sec_' + (sIdx + 1)),
          section_title: title,
          statement: sent,
          anchor: title,
          supporting_excerpt: sent.slice(0, 180),
          source_page: sec.page || 1
        });
      }
    }

    return units;
  }

  function generateQuestionBank(inventory, options = {}) {
    const targetCount = options.targetCount || Math.min(Math.max(inventory.length, 5), 25);
    const questions = [];
    const allStatements = inventory.map(u => u.statement);
    const stemSet = new Set();
    let keyCycle = 0;
    let multiCycle = 0;

    for (let i = 0; i < inventory.length && questions.length < targetCount; i++) {
      const ku = inventory[i];
      const qid = 'Q-LITE-' + String(questions.length + 1).padStart(3, '0');
      const isMultiStatement = (i % 3 === 0) && inventory.length >= 3;
      const isDistinction = (i % 3 === 1) && inventory.length >= 2;

      if (isMultiStatement) {
        // Multi-statement evaluation question (UPSC / Competitive Style).
        // Truth patterns rotate deterministically so all four answer keys are
        // reachable without any randomness or model call.
        const pattern = multiCycle % 4;
        multiCycle++;

        const original1 = ku.statement;
        const otherKu = inventory[(i + 1) % inventory.length];
        const fallback2 = 'The initiative operates under the nodal oversight of competent statutory authority.';
        const original2 = (otherKu && otherKu.statement && otherKu.statement !== original1)
          ? otherKu.statement
          : fallback2;

        const false1 = falsifyStatement(original1);
        const false2 = falsifyStatement(original2);

        let text1 = original1;
        let text2 = original2;
        let truth1 = true;
        let truth2 = true;
        if (pattern === 1) {
          text2 = false2.text;
          truth2 = false;
        } else if (pattern === 2) {
          text1 = false1.text;
          truth1 = false;
        } else if (pattern === 3) {
          text1 = false1.text;
          text2 = false2.text;
          truth1 = false;
          truth2 = false;
        }

        const correctText = truth1 && truth2
          ? 'Both 1 and 2'
          : truth1
            ? '1 only'
            : truth2
              ? '2 only'
              : 'Neither 1 nor 2';

        const statements = [
          { number: 1, text: text1, truth_value: truth1 },
          { number: 2, text: text2, truth_value: truth2 }
        ];

        const opts = [
          { key: 'A', text: '1 only', is_correct: correctText === '1 only' },
          { key: 'B', text: '2 only', is_correct: correctText === '2 only' },
          { key: 'C', text: 'Both 1 and 2', is_correct: correctText === 'Both 1 and 2' },
          { key: 'D', text: 'Neither 1 nor 2', is_correct: correctText === 'Neither 1 nor 2' }
        ];

        // Assign purposes
        for (const o of opts) {
          if (!o.is_correct) {
            o.distractor_origin = 'source';
            o.confusion_type = 'partial_truth';
            o.distractor_purpose = 'partial_truth';
          }
        }

        const answerKey = opts.find(o => o.is_correct).key;

        // Unique focus snippet from statement
        const focusWords = ku.statement.split(' ').filter(w => w.length > 2).slice(0, 4).join(' ').replace(/[:.,;—-]+$/, '');
        let stem = `With reference to ${ku.section_title} (focusing on "${focusWords}"), consider the following statements:`;
        if (stemSet.has(stem)) {
          stem = `With reference to ${ku.section_title} [Item ${questions.length + 1}], consider the following statements:`;
        }
        stemSet.add(stem);

        let explanation;
        if (truth1 && truth2) {
          explanation = `Both statements are verified directly from ${ku.section_title}: (1) ${original1} (2) ${original2}`;
        } else {
          explanation = `Statement 1 is ${truth1 ? 'correct' : 'incorrect'} and statement 2 is ${truth2 ? 'correct' : 'incorrect'}. Source: (1) ${original1} (2) ${original2}.`;
          if (!truth1) explanation += ` The altered statement 1 is false because ${false1.note}.`;
          if (!truth2) explanation += ` The altered statement 2 is false because ${false2.note}.`;
        }

        questions.push({
          id: qid,
          type: 'multi_statement',
          stem: stem,
          prompt_suffix: 'Which of the statements given above is/are correct?',
          statements: statements,
          purpose: 'statement_evaluation',
          options: opts,
          answer_key: answerKey,
          knowledge_units: [{ ku_id: ku.ku_id, role: 'primary' }],
          source_title: ku.section_title,
          source_page: ku.source_page,
          supporting_excerpt: original1.slice(0, 160),
          explanation: explanation,
          difficulty: 'medium',
          cognitive_level: 'understanding'
        });

      } else {
        // Factual or Distinction Question
        const purpose = isDistinction ? 'distinction' : 'factual_recall';
        const focusWords = ku.statement.split(' ').filter(w => w.length > 2).slice(0, 5).join(' ').replace(/[:.,;—-]+$/, '');
        let stem = '';
        if (purpose === 'distinction') {
          stem = `Distinguishing the specific provisions of "${focusWords}" under ${ku.section_title}, which statement is accurate?`;
        } else {
          stem = `Regarding the verified facts of "${focusWords}" in ${ku.section_title}, which one of the following is correct?`;
        }
        if (stemSet.has(stem)) {
          stem = `In the context of ${ku.section_title} [Item ${questions.length + 1}: "${focusWords}"], which of the following statements is correct?`;
        }
        stemSet.add(stem);

        const correctText = ku.statement.slice(0, 140);
        const distractors = [];

        // Pick distinct distractors from other knowledge units
        for (let j = 0; j < allStatements.length && distractors.length < 3; j++) {
          if (j !== i && allStatements[j] !== ku.statement) {
            distractors.push(allStatements[j].slice(0, 140));
          }
        }

        // Fillers if document is small
        const defaultFillers = [
          'The regulatory framework is strictly deferred pending administrative and judicial review.',
          'The jurisdiction applies exclusively to foreign commercial enterprises without domestic scope.',
          'The provisions are restricted to emergency measures without statutory operational status.'
        ];
        let fIdx = 0;
        while (distractors.length < 3) {
          distractors.push(defaultFillers[fIdx % defaultFillers.length]);
          fIdx++;
        }

        // Balance distractor lengths
        const balanced = distractors.slice(0, 3).map(d => balanceDistractorLength(correctText, d));

        // Rotate correct key (A, B, C, D)
        const correctKeyIdx = keyCycle % 4;
        keyCycle++;
        const correctKey = KEYS[correctKeyIdx];

        const rawList = [{ text: correctText, is_correct: true }];
        for (const bd of balanced) {
          rawList.push({ text: bd, is_correct: false });
        }
        // Swap correct answer into rotated position
        const temp = rawList[0];
        rawList[0] = rawList[correctKeyIdx];
        rawList[correctKeyIdx] = temp;

        const opts = rawList.map((item, idx) => {
          const opt = {
            key: KEYS[idx],
            text: item.text,
            is_correct: item.is_correct
          };
          if (!item.is_correct) {
            opt.distractor_origin = 'source';
            opt.confusion_type = VALID_CONFUSION_TYPES[idx % VALID_CONFUSION_TYPES.length];
            opt.distractor_purpose = VALID_DISTRACTOR_PURPOSES[idx % VALID_DISTRACTOR_PURPOSES.length];
          }
          return opt;
        });

        questions.push({
          id: qid,
          type: 'single_choice',
          stem: stem,
          purpose: purpose,
          options: opts,
          answer_key: correctKey,
          knowledge_units: [{ ku_id: ku.ku_id, role: 'primary' }],
          source_title: ku.section_title,
          source_page: ku.source_page,
          supporting_excerpt: ku.supporting_excerpt,
          explanation: `Verified from ${ku.section_title}: "${ku.supporting_excerpt}"`,
          difficulty: isDistinction ? 'medium' : 'easy',
          cognitive_level: isDistinction ? 'distinction' : 'recall'
        });
      }
    }

    return questions;
  }

  function validateQuestionBank(questions) {
    const issues = [];
    const stemSet = new Set();
    const keyDistribution = { A: 0, B: 0, C: 0, D: 0 };

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      // 1. Check stem uniqueness
      if (stemSet.has(q.stem)) {
        issues.push({ qid: q.id, rule: 'uniqueness', message: 'Stem duplicate detected' });
      }
      stemSet.add(q.stem);

      // 2. Check 4 options
      if (!q.options || q.options.length !== 4) {
        issues.push({ qid: q.id, rule: 'option_count', message: 'Question does not have exactly 4 options' });
      }

      // 3. Check correct key exists
      const correctOpt = (q.options || []).find(o => o.key === q.answer_key && o.is_correct);
      if (!correctOpt) {
        issues.push({ qid: q.id, rule: 'answer_key', message: 'Valid correct option matching answer_key missing' });
      } else {
        keyDistribution[q.answer_key] = (keyDistribution[q.answer_key] || 0) + 1;
      }

      // 4. Distractor length check
      if (correctOpt && q.type !== 'multi_statement') {
        const cLen = correctOpt.text.length;
        const otherLens = q.options.filter(o => !o.is_correct).map(o => o.text.length);
        const avgOther = otherLens.reduce((a, b) => a + b, 0) / (otherLens.length || 1);
        if (cLen > 1.45 * avgOther && (cLen - avgOther) > 25) {
          issues.push({ qid: q.id, rule: 'answer_length_leak', message: 'Correct option is disproportionately long' });
        }
      }
    }

    return {
      total: questions.length,
      valid: issues.length === 0,
      issues: issues,
      keyDistribution: keyDistribution
    };
  }

  // Parse Raw Document (Markdown, TXT, or structured text)
  function parseRawDocument(rawText, defaultTitle = 'Study Document') {
    const lines = rawText.split(/\r?\n/);
    const sections = [];
    let currentTitle = defaultTitle;
    let currentParagraphs = [];
    let pageNum = 1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Page boundary markers
      const pageMatch = trimmed.match(/^page\s+(\d+)/i) || trimmed.match(/^==Page\s+(\d+)/i);
      if (pageMatch) {
        pageNum = parseInt(pageMatch[1], 10);
        continue;
      }

      // Header markers (Markdown #, ##, or numbered "1. Supreme Court")
      const isHeader = /^#{1,4}\s+(.+)$/.test(trimmed) ||
                       /^(\d+\.|\([A-Za-z0-9]+\))\s+[A-Z]/.test(trimmed) ||
                       /^Topic\s+\d+:/i.test(trimmed);

      if (isHeader) {
        if (currentParagraphs.length > 0) {
          sections.push({
            id: 'sec_' + (sections.length + 1),
            title: currentTitle,
            text: currentParagraphs.join(' '),
            page: pageNum
          });
          currentParagraphs = [];
        }
        currentTitle = trimmed.replace(/^#{1,4}\s+/, '').replace(/^(\d+\.|\([A-Za-z0-9]+\))\s+/, '');
      } else {
        currentParagraphs.push(trimmed);
      }
    }

    if (currentParagraphs.length > 0) {
      sections.push({
        id: 'sec_' + (sections.length + 1),
        title: currentTitle,
        text: currentParagraphs.join(' '),
        page: pageNum
      });
    }

    // Fallback if no sections created
    if (sections.length === 0 && cleanText(rawText).length > 20) {
      sections.push({
        id: 'sec_1',
        title: defaultTitle,
        text: cleanText(rawText),
        page: 1
      });
    }

    return sections;
  }

  const StudySynthEngine = {
    cleanText,
    splitSentences,
    extractAnchors,
    balanceDistractorLength,
    buildKnowledgeInventory,
    generateQuestionBank,
    validateQuestionBank,
    parseRawDocument
  };

  // Export for Browser and Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StudySynthEngine;
  }
  if (typeof window !== 'undefined') {
    window.StudySynthEngine = StudySynthEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
