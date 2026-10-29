import type { Survey } from '../../apps/survey/src/survey';

type Cell = string | number | undefined;
type StoredRecord = {
  respondentId?: string;
  submittedAt?: string;
  receivedAt?: string;
  answers?: Record<string, unknown>;
  derived?: Record<string, unknown>;
};

const at = (obj: unknown, key: string): unknown =>
  obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;

const asCell = (v: unknown): Cell =>
  typeof v === 'string' || typeof v === 'number' ? v : undefined;

/**
 * One column per answer, generated from the survey config, so the sheet follows survey edits.
 * Multi-select questions get a joined column plus a 1/0 column per option for easy counting.
 */
export function columnsFor(survey: Survey) {
  const cols: { header: string; get: (r: StoredRecord) => Cell }[] = [
    { header: 'respondentId', get: (r) => r.respondentId },
    { header: 'submittedAt', get: (r) => r.submittedAt },
    { header: 'receivedAt', get: (r) => r.receivedAt },
  ];

  for (const q of survey.sections.flatMap((s) => s.questions)) {
    const answer = (r: StoredRecord) => at(r.answers, q.id);
    switch (q.type) {
      case 'single':
      case 'text':
        cols.push({ header: q.id, get: (r) => asCell(answer(r)) });
        break;
      case 'matrix':
        for (const row of q.rows) {
          cols.push({ header: `${q.id}.${row.id}`, get: (r) => asCell(at(answer(r), row.id)) });
        }
        break;
      case 'allocation':
        for (const item of q.items) {
          cols.push({ header: `${q.id}.${item.id}`, get: (r) => asCell(at(answer(r), item.id)) });
        }
        break;
      case 'multi': {
        const selected = (r: StoredRecord) => {
          const v = answer(r);
          return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
        };
        cols.push({ header: q.id, get: (r) => selected(r).join('; ') });
        if (q.otherOption) {
          cols.push({ header: `${q.id}_other`, get: (r) => asCell(at(r.answers, `${q.id}_other`)) });
        }
        for (const option of q.options) {
          cols.push({ header: `${q.id} [${option}]`, get: (r) => (selected(r).includes(option) ? 1 : 0) });
        }
        break;
      }
    }
  }

  // Derived values (such as Q4's place count or the recommended license) go last.
  for (const key of Object.keys(survey.derive?.({}) ?? {})) {
    cols.push({ header: key, get: (r) => asCell(at(r.derived, key)) });
  }
  return cols;
}

/** Quotes a cell and defuses spreadsheet formulas in respondent-entered text. */
export function escapeCell(value: Cell): string {
  if (value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(survey: Survey, records: unknown[]): string {
  const cols = columnsFor(survey);
  const lines = [cols.map((c) => escapeCell(c.header)).join(',')];
  for (const record of records) {
    lines.push(cols.map((c) => escapeCell(c.get(record as StoredRecord))).join(','));
  }
  // The byte-order mark makes Excel read the file as UTF-8 (en dashes, curly quotes).
  return '﻿' + lines.join('\r\n') + '\r\n';
}
