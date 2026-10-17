import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Bank } from './types';
import { decodeReview, prepareReview, reviewInstructions, type ReviewInput } from './examiner';
import { reviewFixture, testEssay } from '../test-fixtures/examiner';
import { strategyFor, strategiesFor } from './coaching';
const bank = JSON.parse(readFileSync(new URL('../public/content/bank.json', import.meta.url), 'utf8')) as Bank;
const writing: ReviewInput = { skill: 'writing', testId: bank.writing[0].id, model: 'test-model', language: 'id', answers: Object.fromEntries(bank.writing[0].tasks.map(t => [t.id, testEssay])) };
const question = bank.reading[0].parts[0].groups[0].questions[0];
const reading: ReviewInput = { skill: 'reading', testId: bank.reading[0].id, model: 'test-model', language: 'id', answers: { [question.id]: 'Wrong answer' }, questionIds: [question.id] };
it('uses canonical question keys and source material, and refuses unknown or oversized batches', () => {
  const prepared = prepareReview(bank, reading);
  expect(prepared.questionData[0]).toMatchObject({ keyAnswer: question.answer, answer: 'Wrong answer', correct: false });
  expect(prepared.sourceParts).toHaveLength(1);
  expect(() => prepareReview(bank, { ...reading, questionIds: ['not-a-question'] })).toThrow('does not belong');
  expect(() => prepareReview(bank, { ...reading, questionIds: Array(9).fill(question.id) })).toThrow('up to eight');
});
it('keeps Task 2 weighted twice, validates all four criteria and withholds incomplete overall scores', () => {
  const prepared = prepareReview(bank, writing); const fixture = reviewFixture(prepared);
  const report = decodeReview(JSON.stringify(fixture), prepared);
  expect(report.skill).toBe('writing'); if (report.skill !== 'writing') throw new Error('Expected Writing');
  expect(report.estimatedBand).toBe(7.5);
  expect(report.tasks[0].wordCount).toBe(testEssay.split(/\s+/).length);
  expect(report.tasks[0].revisions).toHaveLength(1);
  const empty = prepareReview(bank, { ...writing, answers: { [bank.writing[0].tasks[0].id]: '', [bank.writing[0].tasks[1].id]: 'A submitted response.' } });
  const partial = decodeReview(JSON.stringify(reviewFixture(empty)), empty);
  expect(partial.skill === 'writing' && partial.estimatedBand).toBeNull();
  if ('tasks' in fixture) { fixture.tasks[0].criteria[0].band = 9.5; expect(() => decodeReview(JSON.stringify(fixture), prepared)).toThrow('invalid criterion'); }
});
it('restricts very short Writing responses rather than accepting inflated model bands', () => {
  const prepared = prepareReview(bank, { ...writing, answers: Object.fromEntries(bank.writing[0].tasks.map(t => [t.id, 'The argument needs a specific example.'])) });
  const report = decodeReview(JSON.stringify(reviewFixture(prepared)), prepared);
  expect(report.skill === 'writing' && report.estimatedBand).toBe(1);
  expect(report.limitations.join(' ')).toContain('20 words or fewer');
});
it('removes invented candidate quotes instead of presenting them as revisions', () => {
  const prepared = prepareReview(bank, writing); const fixture = reviewFixture(prepared);
  if (!('tasks' in fixture)) throw new Error('Expected Writing'); fixture.tasks[0].revisions[0].original = 'A sentence that was never submitted.';
  const report = decodeReview(JSON.stringify(fixture), prepared);
  expect(report.skill === 'writing' && report.tasks[0].revisions.length).toBe(0);
  expect(report.limitations.join(' ')).toContain('omitted');
});
it('verifies exact source quotes and marks invented evidence provisional without changing marks', () => {
  const prepared = prepareReview(bank, reading); const fixture = reviewFixture(prepared);
  if (!('questions' in fixture)) throw new Error('Expected Reading');
  const valid = decodeReview(JSON.stringify(fixture), prepared);
  expect(valid.skill !== 'writing' && valid.questions[0].evidenceVerified).toBe(true);
  fixture.questions[0].evidence[0].quote = 'This invented passage sentence does not exist.';
  const invalid = decodeReview(JSON.stringify(fixture), prepared);
  if (invalid.skill === 'writing') throw new Error('Expected Reading');
  expect(invalid.questions[0].evidence).toHaveLength(0);
  expect(invalid.questions[0].keyStatus).toBe('insufficient-evidence');
  expect(invalid.questions[0].correct).toBe(false);
});
it('requires actionable teaching and explicitly avoids guaranteed Band 9 templates', () => {
  expect(reviewInstructions('writing', 'id')).toContain('not a guarantee of Band 9');
  expect(reviewInstructions('reading', 'id')).toContain('NOT GIVEN');
  expect(reviewInstructions('listening', 'id')).toContain('without inventing timestamps');
  expect(reviewInstructions('writing', 'id')).toContain('Bahasa Indonesia');
});
it('provides a strategy for every Reading and Listening question type in the actual bank', () => {
  for (const skill of ['reading', 'listening'] as const) {
    const types = [...new Set(bank[skill].flatMap(p => p.parts.flatMap(p => p.groups.map(g => g.type))))];
    for (const type of types) {
      const strategy = strategyFor(skill, type);
      expect(strategy, skill + ': ' + type).toBeDefined();
      expect(strategy!.steps.length).toBeGreaterThanOrEqual(3);
      expect(strategy!.drill.length).toBeGreaterThan(20);
    }
  }
  expect(strategiesFor('writing').map(s => s.id)).toEqual(['task1', 'task2']);
});
it('requires a Band 9 gap, practical upgrade and self-check for every Writing criterion', () => {
  const prepared = prepareReview(bank, writing); const fixture = reviewFixture(prepared);
  if (!('tasks' in fixture)) throw new Error('Expected Writing');
  const report = decodeReview(JSON.stringify(fixture), prepared);
  expect(report.skill === 'writing' && report.tasks.every(t => t.criteria.every(c => c.band9Gap && c.upgrade && c.selfCheck))).toBe(true);
  fixture.tasks[0].criteria[0].upgrade = '';
  expect(() => decodeReview(JSON.stringify(fixture), prepared)).toThrow('incomplete explanation');
});
it('checks focus phrases inside verified evidence and teaches Listening without fabricating acoustic observations', () => {
  const q = bank.listening[0].parts[0].groups[0].questions[0];
  const prepared = prepareReview(bank, { ...reading, skill: 'listening', testId: bank.listening[0].id, questionIds: [q.id], answers: { [q.id]: 'Wrong' } });
  const fixture = reviewFixture(prepared); if (!('questions' in fixture)) throw new Error('Expected Listening');
  fixture.questions[0].decisiveWords.push('This invented phrase is not in any source');
  const report = decodeReview(JSON.stringify(fixture), prepared); if (report.skill === 'writing') throw new Error('Expected Listening');
  expect(report.questions[0].decisiveWords).toHaveLength(1);
  expect(report.questions[0].framework.name).toBeTruthy();
  expect(report.questions[0].successCheck).toBeTruthy();
  expect(report.limitations.join(' ')).toContain('unverified focus phrase');
  expect((prepared.context.teachingReference as { note: string }).note).toContain('NEVER source evidence');
});
