/**
 * StudySynth Lite PWA Engine Test Suite
 * Tests deterministic question synthesis, distractor length balancing, key rotation, and validation.
 */

const assert = require('assert');
const path = require('path');

const Engine = require('../engine/generator.js');
const DocParser = require('../engine/pdfParser.js');
const SampleData = require('../sample_data.js');

console.log('--- Running StudySynth Lite PWA Engine Tests ---');

// Test 1: Text cleaning and sentence splitting
console.log('[Test 1] Testing sentence splitting...');
const sampleText = 'The Supreme Court has held that the right to access the Internet is a fundamental right. This right is protected under Article 19(1)(a). Children enjoy the same rights.';
const sentences = Engine.splitSentences(sampleText);
assert(sentences.length >= 2, 'Should extract at least 2 sentences');
console.log('  ✓ Extracted sentences:', sentences.length);

// Test 2: Anchor extraction
console.log('[Test 2] Testing anchor extraction...');
const anchors = Engine.extractAnchors(sampleText);
assert(anchors.some(a => a.includes('Article 19') || a.includes('Supreme Court')), 'Should identify Article 19 or Supreme Court');
console.log('  ✓ Extracted anchors:', anchors);

// Test 3: Distractor length balancing
console.log('[Test 3] Testing distractor length balancing...');
const target = 'A coaching class cannot guarantee success in competitive examinations.';
const shortDistractor = 'Short statement.';
const balanced = Engine.balanceDistractorLength(target, shortDistractor);
assert(balanced.length >= target.length * 0.70, 'Short distractor should be padded');
console.log('  ✓ Target length:', target.length, 'Balanced distractor length:', balanced.length);

// Test 4: End-to-end SPM IAS Academy generation
console.log('[Test 4] Testing generation with SPM IAS Academy 19 Oct 2026 sample...');
const spmText = global.StudySamples.newspaper_2026;
const sections = Engine.parseRawDocument(spmText, 'SPM IAS Academy — 19 Oct 2026');
assert(sections.length >= 4, `Should parse at least 4 sections, got ${sections.length}`);
console.log('  ✓ Parsed sections:', sections.map(s => s.title));

const inventory = Engine.buildKnowledgeInventory(sections);
assert(inventory.length >= 10, `Should build knowledge units, got ${inventory.length}`);
console.log('  ✓ Inventory units:', inventory.length);

const bank = Engine.generateQuestionBank(inventory, { targetCount: 15 });
assert(bank.length >= 10, `Should generate at least 10 questions, got ${bank.length}`);
console.log('  ✓ Generated questions:', bank.length);

// Test 5: Validation of question bank
console.log('[Test 5] Validating question bank quality...');
const val = Engine.validateQuestionBank(bank);
assert(val.valid === true, `Validation failed: ${JSON.stringify(val.issues)}`);
console.log('  ✓ Question bank 100% valid. Key distribution:', val.keyDistribution);

// Test 6: Verify question types present
const types = new Set(bank.map(q => q.type));
assert(types.has('single_choice'), 'Should include single_choice questions');
assert(types.has('multi_statement'), 'Should include multi_statement questions');
console.log('  ✓ Question types present:', Array.from(types));

console.log('\n========================================');
console.log('ALL PWA ENGINE TESTS PASSED SUCCESSFULLY');
console.log('========================================\n');
