import { describe, expect, it } from 'vitest';
import { buildSubmission, validateQuestion, type Answers } from '../answers';
import { survey, type AllocationQuestion } from '../survey';
import { completeAnswers } from './fixtures';

const q3 = survey.sections.flatMap((s) => s.questions).find((q) => q.id === 'q3') as AllocationQuestion;

describe('allocation validation', () => {
  it.each([
    [{ doing: 50, preparing: 30, overhead: 10 }, false],
    [{ doing: 50, preparing: 30, overhead: 30 }, false],
    [{ doing: 100 }, true],
    [{ doing: 60, preparing: 25, overhead: 15 }, true],
    [{ doing: 60.5, preparing: 24.5, overhead: 15 }, false],
    [{ doing: 120, preparing: -20, overhead: 0 }, false],
    [{}, false],
  ])('%j is valid: %s', (value, valid) => {
    expect(validateQuestion(q3, { q3: value }) === null).toBe(valid);
  });

  it('reports the running total in the error', () => {
    expect(validateQuestion(q3, { q3: { doing: 40, preparing: 20 } })).toMatch('60%');
  });
});

describe('buildSubmission', () => {
  it('matches the output format and computes q4_placeCount', () => {
    const now = new Date('2026-10-29T12:00:00.000Z');
    const result = buildSubmission(survey, 'abc123', completeAnswers(), now);

    expect(Object.keys(result)).toEqual(['respondentId', 'submittedAt', 'answers', 'derived']);
    expect(result.respondentId).toBe('abc123');
    expect(result.submittedAt).toBe('2026-10-29T12:00:00.000Z');
    expect(result.answers.q1).toEqual({ execute: 'Regularly', review: 'Occasionally', plan: 'Never' });
    expect(result.answers.q3).toEqual({ finding: 10, doing: 50, preparing: 25, overhead: 15 });
    expect(result.answers.q4).toEqual(['Email', 'Chat', 'Other']);
    expect(result.answers.q4_other).toBe('Ticket queue');
    expect(result.answers.q16).toBe('Weekly status report');
    expect(result.derived).toEqual({ q4_placeCount: 3 });
  });

  it('drops unknown keys, empty text, and Other text when Other is unchecked', () => {
    const answers: Answers = { ...completeAnswers(), q4: ['Email'], q16: '   ', junk: 'x' };
    const result = buildSubmission(survey, 'abc123', answers);
    expect(result.answers).not.toHaveProperty('junk');
    expect(result.answers).not.toHaveProperty('q16');
    expect(result.answers).not.toHaveProperty('q4_other');
    expect(result.derived.q4_placeCount).toBe(1);
  });
});
