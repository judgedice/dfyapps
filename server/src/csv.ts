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
/** Roster details joined onto each response by respondent ID. Only these columns are kept. */
export const ROSTER_COLUMNS = ['Department', 'Role'] as const;
export type Roster = Record<string, Partial<Record<(typeof ROSTER_COLUMNS)[number], string>>>;

export function columnsFor(survey: Survey, roster: Roster = {}) {
  const cols: { header: string; get: (r: StoredRecord) => Cell }[] = [
    { header: 'respondentId', get: (r) => r.respondentId },
    // From the uploaded roster; blank for anyone not on it.
    ...ROSTER_COLUMNS.map((name) => ({
      header: name,
      get: (r: StoredRecord) => (r.respondentId ? roster[r.respondentId]?.[name] : undefined),
    })),
    { header: 'submittedAt', get: (r) => r.submittedAt },
    { header: 'receivedAt', get: (r) => r.receivedAt },
  ];

  for (const q of survey.sections.flatMap((s) => s.questions)) {
    const answer = (r: StoredRecord) => at(r.answers, q.id);
    switch (q.type) {
      case 'single':
      case 'text':
        cols.push({ header: q.id, get: (r) => asCell(answer(r)) });
        if (q.type === 'single' && q.otherOption) {
          cols.push({ header: `${q.id}_other`, get: (r) => asCell(at(r.answers, `${q.id}_other`)) });
        }
        break;
      case 'checkbox':
        cols.push({ header: q.id, get: (r) => (answer(r) === true ? 'Yes' : answer(r) === false ? 'No' : undefined) });
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

export function toCsv(survey: Survey, records: unknown[], roster: Roster = {}): string {
  const cols = columnsFor(survey, roster);
  const lines = [cols.map((c) => escapeCell(c.header)).join(',')];
  for (const record of records) {
    lines.push(cols.map((c) => escapeCell(c.get(record as StoredRecord))).join(','));
  }
  // The byte-order mark makes Excel read the file as UTF-8 (en dashes, curly quotes).
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const normalize = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Reads a roster CSV (for example the planning sheet's Roster tab saved as CSV) and keeps only the
 * respondent ID and the ROSTER_COLUMNS. Names, emails, and anything else are dropped.
 */
export function rosterFromCsv(text: string): { roster: Roster; people: number } {
  const [header = [], ...rows] = parseCsv(text);
  const keys = header.map(normalize);
  const idCol = keys.findIndex((k) => k === 'respondentid' || k === 'id');
  if (idCol === -1) throw new Error('No "Respondent ID" column found in the first row.');
  const cols = ROSTER_COLUMNS.map((name) => [name, keys.indexOf(normalize(name))] as const);
  const roster: Roster = {};
  for (const row of rows) {
    const id = row[idCol]?.trim();
    if (!id) continue;
    const entry: Roster[string] = {};
    for (const [name, i] of cols) {
      const value = i >= 0 ? row[i]?.trim() : '';
      if (value) entry[name] = value;
    }
    if (Object.keys(entry).length > 0) roster[id] = entry;
  }
  return { roster, people: Object.keys(roster).length };
}
