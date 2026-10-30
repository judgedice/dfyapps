import type { AllocationQuestion, Question, Section, Survey } from './survey';

export type MatrixAnswer = Record<string, string>;
export type AllocationAnswer = Record<string, number>;
export type AnswerValue = string | string[] | MatrixAnswer | AllocationAnswer;
export type Answers = Record<string, AnswerValue | undefined>;

export interface Submission {
  respondentId: string;
  submittedAt: string;
  answers: Record<string, AnswerValue>;
  derived: Record<string, string | number>;
}

/** Sections the respondent sees, given their answers so far. */
export function visibleSections(s: Survey, answers: Answers): Section[] {
  return s.sections.filter((section) => !section.showIf || section.showIf(answers));
}

/** Key that holds the free text for a multi question's "Other" option. */
export const otherKey = (questionId: string) => `${questionId}_other`;

export function allocationTotal(q: AllocationQuestion, value: AnswerValue | undefined): number {
  const v = (value ?? {}) as AllocationAnswer;
  return q.items.reduce((sum, item) => sum + (Number.isFinite(v[item.id]) ? v[item.id] : 0), 0);
}

/** Returns an error message, or null when the answer is valid. */
export function validateQuestion(q: Question, answers: Answers): string | null {
  const value = answers[q.id];
  switch (q.type) {
    case 'single':
      return typeof value === 'string' && value ? null : 'Choose an answer.';
    case 'multi': {
      const selected = Array.isArray(value) ? value : [];
      if (selected.length === 0) return 'Select at least one option.';
      if (q.otherOption && selected.includes(q.otherOption)) {
        const text = answers[otherKey(q.id)];
        if (typeof text !== 'string' || !text.trim()) return `Describe “${q.otherOption}.”`;
      }
      return null;
    }
    case 'matrix': {
      const v = (value ?? {}) as MatrixAnswer;
      const missing = q.rows.filter((row) => !v[row.id]).length;
      return missing === 0 ? null : 'Choose an answer for every row.';
    }
    case 'allocation': {
      const v = (value ?? {}) as AllocationAnswer;
      const invalid = q.items.some((item) => {
        const n = v[item.id];
        return n !== undefined && (!Number.isInteger(n) || n < 0 || n > q.total);
      });
      if (invalid) return `Use whole numbers from 0 to ${q.total}.`;
      const total = allocationTotal(q, value);
      return total === q.total ? null : `Your total is ${total}%. It must equal ${q.total}%.`;
    }
    case 'text':
      return null;
  }
}

export function validateQuestions(questions: Question[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of questions) {
    const error = validateQuestion(q, answers);
    if (error) errors[q.id] = error;
  }
  return errors;
}

/** Builds the submission payload, keeping only answers to questions the respondent was shown. */
export function buildSubmission(
  s: Survey,
  respondentId: string,
  answers: Answers,
  now: Date = new Date(),
): Submission {
  const out: Record<string, AnswerValue> = {};
  for (const q of visibleSections(s, answers).flatMap((section) => section.questions)) {
    const value = answers[q.id];
    switch (q.type) {
      case 'single':
        if (typeof value === 'string' && value) out[q.id] = value;
        break;
      case 'multi': {
        const selected = Array.isArray(value) ? q.options.filter((o) => value.includes(o)) : [];
        out[q.id] = selected;
        const text = answers[otherKey(q.id)];
        if (q.otherOption && selected.includes(q.otherOption) && typeof text === 'string' && text.trim()) {
          out[otherKey(q.id)] = text.trim();
        }
        break;
      }
      case 'matrix': {
        const v = (value ?? {}) as MatrixAnswer;
        const rows: MatrixAnswer = {};
        for (const row of q.rows) if (v[row.id]) rows[row.id] = v[row.id];
        out[q.id] = rows;
        break;
      }
      case 'allocation': {
        const v = (value ?? {}) as AllocationAnswer;
        const items: AllocationAnswer = {};
        for (const item of q.items) items[item.id] = Number.isFinite(v[item.id]) ? v[item.id] : 0;
        out[q.id] = items;
        break;
      }
      case 'text':
        if (typeof value === 'string' && value.trim()) out[q.id] = value.trim().slice(0, q.maxLength);
        break;
    }
  }

  return {
    respondentId,
    submittedAt: now.toISOString(),
    answers: out,
    derived: s.derive?.(out) ?? {},
  };
}
