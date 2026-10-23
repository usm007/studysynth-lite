/**
 * StudySynth Lite — Shared deterministic analysis pipeline.
 * Used by both the page (starter module) and the background worker so the
 * orchestration around the engine never has to be duplicated.
 */

(function (global) {
  'use strict';

  function engine() {
    if (typeof module !== 'undefined' && module.exports) return require('./generator.js');
    return global.StudySynthEngine;
  }

  function analyzeSource(rawText, title, sourceMeta, targetCount, hooks) {
    const E = engine();
    const onStage = hooks && typeof hooks.onStage === 'function' ? hooks.onStage : function () {};

    onStage('preparing', { message: 'Preparing document content' });
    const sections = E.parseRawDocument(rawText, title);

    onStage('inventory', { sections: sections.length, message: 'Finding important facts' });
    const extracted = E.extractSourceFacts(sections, { sourceMeta: sourceMeta });
    const conflictResult = E.detectFactConflicts(extracted);
    const inventory = E.buildKnowledgeInventory(sections, {
      facts: conflictResult.facts,
      conflicts: conflictResult.conflicts,
      sourceMeta: sourceMeta
    });

    const context = {
      sections: sections,
      facts: conflictResult.facts,
      conflicts: conflictResult.conflicts
    };

    onStage('generating', {
      sections: sections.length,
      facts: conflictResult.facts.length,
      message: 'Creating practice questions'
    });
    let questions = [];
    let generationError = null;
    try {
      questions = E.generateQuestionBank(inventory, Object.assign({
        targetCount: targetCount || 15,
        sourceMeta: sourceMeta
      }, context));
    } catch (err) {
      generationError = err;
      questions = [];
    }
    const generation = questions.generation || (generationError && generationError.metrics) || null;

    onStage('validating', {
      questions: questions.length,
      message: 'Checking questions and answers'
    });
    const validation = E.validateQuestionBank(questions, Object.assign({
      candidateCount: generation ? generation.totalCandidates : 0,
      rejectionCounts: generation ? generation.rejectionCounts : {}
    }, context));

    return {
      sections: sections,
      facts: conflictResult.facts,
      conflicts: conflictResult.conflicts,
      inventory: inventory,
      questions: questions,
      generation: generation,
      generationError: generationError,
      validation: validation
    };
  }

  const StudySynthAnalysis = { analyzeSource: analyzeSource };

  if (typeof module !== 'undefined' && module.exports) module.exports = StudySynthAnalysis;
  if (typeof window !== 'undefined') window.StudySynthAnalysis = StudySynthAnalysis;
  if (typeof self !== 'undefined' && typeof window === 'undefined') self.StudySynthAnalysis = StudySynthAnalysis;
})(typeof globalThis !== 'undefined' ? globalThis : this);
