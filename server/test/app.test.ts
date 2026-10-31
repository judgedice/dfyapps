import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { completeAnswers } from '../../apps/survey/src/test/answers.fixture';
import { createApp } from '../src/app';
import { FileStore } from '../src/store';

let root: string;
let app: ReturnType<typeof createApp>;

const submission = (overrides: Record<string, unknown> = {}) => ({
  respondentId: 'abc123',
  submittedAt: '2026-10-29T12:00:00.000Z',
  answers: completeAnswers(),
  derived: { q4_placeCount: 3 },
  ...overrides,
});

/** Minimal RFC 4180 parser, enough to check the export. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n') row.push(cell), rows.push(row), (row = []), (cell = '');
    else if (c !== '\r') cell += c;
  }
  return rows;
}

const savedFiles = async () => {
  const dir = path.join(root, 'responses', 'workflow-survey');
  try {
    const names = await readdir(dir);
    return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(dir, n), 'utf8'))));
  } catch {
    return [];
  }
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'dfyapps-'));
  await mkdir(path.join(root, 'public', 'work-survey', 'assets'), { recursive: true });
  await writeFile(path.join(root, 'public', 'work-survey', 'index.html'), '<!doctype html><title>Survey</title>');
  await writeFile(path.join(root, 'public', 'work-survey', 'assets', 'index-abc.js'), 'console.log(1)');
  app = createApp({
    store: new FileStore(path.join(root, 'responses')),
    publicDir: path.join(root, 'public'),
    exportPassword: 'secret',
    version: 'test-sha',
    rateLimitPerMinute: 5,
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('static app', () => {
  it('redirects to the trailing-slash URL and keeps the respondent ID', async () => {
    const res = await request(app).get('/work-survey?r=abc123');
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/work-survey/?r=abc123');
  });

  it('sends the retired workflow survey page to the combined survey, keeping the respondent ID', async () => {
    for (const url of ['/workflow-survey?r=abc123', '/workflow-survey/?r=abc123']) {
      const res = await request(app).get(url);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/work-survey/?r=abc123');
    }
    expect((await request(app).get('/workflow-survey/')).headers.location).toBe('/work-survey/');
  });

  it('serves the page uncached and assets as immutable, with security headers', async () => {
    const page = await request(app).get('/work-survey/?r=abc123');
    expect(page.status).toBe(200);
    expect(page.text).toContain('<title>Survey</title>');
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.headers['referrer-policy']).toBe('no-referrer');
    expect(page.headers['content-security-policy']).toContain("default-src 'self'");

    const asset = await request(app).get('/work-survey/assets/index-abc.js');
    expect(asset.headers['cache-control']).toContain('immutable');
  });

  it('reports health and version', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', version: 'test-sha' });
  });

  it('returns 404 elsewhere', async () => {
    expect((await request(app).get('/')).status).toBe(404);
  });
});

describe('POST /workflow-survey/api/responses', () => {
  it('saves one JSON file per submission in the documented format', async () => {
    const res = await request(app).post('/workflow-survey/api/responses').send(submission());
    expect(res.status).toBe(201);

    const [saved] = await savedFiles();
    expect(Object.keys(saved)).toEqual(['respondentId', 'submittedAt', 'answers', 'derived', 'receivedAt']);
    expect(saved.respondentId).toBe('abc123');
    expect(saved.submittedAt).toBe('2026-10-29T12:00:00.000Z');
    expect(saved.answers.q4).toEqual(['Email', 'Chat', 'Other']);
    expect(saved.derived).toEqual({ q4_placeCount: 3 });
  });

  it('drops unknown keys and recomputes derived values', async () => {
    await request(app)
      .post('/workflow-survey/api/responses')
      .send(submission({ answers: { ...completeAnswers(), junk: 'x' }, derived: { q4_placeCount: 99 } }))
      .expect(201);
    const [saved] = await savedFiles();
    expect(saved.answers).not.toHaveProperty('junk');
    expect(saved.derived.q4_placeCount).toBe(3);
  });

  it('rejects incomplete answers', async () => {
    const res = await request(app)
      .post('/workflow-survey/api/responses')
      .send(submission({ answers: { ...completeAnswers(), q3: { doing: 50 } } }));
    expect(res.status).toBe(422);
    expect(res.body.fields).toHaveProperty('q3');
    expect(await savedFiles()).toHaveLength(0);
  });

  it.each([
    ['a missing respondent ID', { respondentId: undefined }],
    ['an over-long respondent ID', { respondentId: 'x'.repeat(200) }],
    ['answers that are not an object', { answers: ['a'] }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await request(app).post('/workflow-survey/api/responses').send(submission(overrides));
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/workflow-survey/api/responses')
      .set('Content-Type', 'application/json')
      .send('{nope');
    expect(res.status).toBe(400);
  });

  it('rate-limits repeated submissions', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/workflow-survey/api/responses').send(submission()).expect(201);
    }
    const res = await request(app).post('/workflow-survey/api/responses').send(submission());
    expect(res.status).toBe(429);
  });
});

describe('GET /workflow-survey/api/export.csv', () => {
  it('requires the password', async () => {
    expect((await request(app).get('/workflow-survey/api/export.csv')).status).toBe(401);
    expect((await request(app).get('/workflow-survey/api/export.csv').auth('dfy', 'wrong')).status).toBe(401);
  });

  it('returns one row per response with a column per answer', async () => {
    await request(app).post('/workflow-survey/api/responses').send(submission()).expect(201);
    await request(app)
      .post('/workflow-survey/api/responses')
      .send(submission({ respondentId: 'xyz', answers: { ...completeAnswers(), q16: '=HYPERLINK("x")' } }))
      .expect(201);

    const res = await request(app).get('/workflow-survey/api/export.csv').auth('dfy', 'secret');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="workflow-survey-/);

    expect(res.text.charCodeAt(0)).toBe(0xfeff);
    const [cols, first, second] = parseCsv(res.text.slice(1));
    expect(cols.slice(0, 6)).toEqual(['respondentId', 'submittedAt', 'receivedAt', 'q1.execute', 'q1.review', 'q1.plan']);
    expect(cols).toContain('q3.overhead');
    expect(cols).toContain('q4 [Email]');
    expect(cols).toContain('q4 [Verbal, drive-by, or carrier pigeon]');
    expect(cols.at(-1)).toBe('q4_placeCount');

    const row = Object.fromEntries(cols.map((c, i) => [c, first[i]]));
    expect(row['respondentId']).toBe('abc123');
    expect(row['q1.execute']).toBe('Regularly');
    expect(row['q3.finding']).toBe('10');
    expect(row['q3.doing']).toBe('50');
    expect(row['q4']).toBe('Email; Chat; Other');
    expect(row['q4 [Email]']).toBe('1');
    expect(row['q4 [Meeting]']).toBe('0');
    expect(row['q4_placeCount']).toBe('3');

    // Respondent text that looks like a formula is neutralized.
    expect(second[cols.indexOf('q16')]).toBe(`'=HYPERLINK("x")`);
    expect(res.text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('is not served when no password is configured', async () => {
    const open = createApp({ store: new FileStore(root), publicDir: root });
    expect((await request(open).get('/workflow-survey/api/export.csv')).status).toBe(404);
  });
});

describe('how you work survey', () => {
  const never = {
    yourWork: { markDone: 'Never', logHours: 'Never', followWork: 'Never' },
    planning: { createTasks: 'Never', createProjects: 'Never' },
    requests: { sendRequests: 'Never', handleRequests: 'Never' },
    decisions: { approveWork: 'Never', approveFiles: 'Never', approveTime: 'Never' },
  };
  const post = (answers: Record<string, unknown>) =>
    request(app).post('/how-you-work/api/responses').send({ respondentId: 'hyw1', answers });

  it('saves the response with the license tier derived on the server', async () => {
    await post({ ...never, requests: { sendRequests: 'Every week', handleRequests: 'Never' } }).expect(201);
    const dir = path.join(root, 'responses', 'how-you-work');
    const [name] = await readdir(dir);
    const saved = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
    expect(saved.answers.requests).toEqual({ sendRequests: 'Every week', handleRequests: 'Never' });
    expect(saved.derived).toEqual({ license: 'Contributor' });
  });

  it('requires every activity', async () => {
    const res = await post({ ...never, decisions: { approveWork: 'Never' } });
    expect(res.status).toBe(422);
    expect(res.body.fields).toHaveProperty('decisions');
  });

  it('exports its own CSV with a column per activity and the license last', async () => {
    await post(never).expect(201);
    await request(app).post('/workflow-survey/api/responses').send(submission()).expect(201);

    const res = await request(app).get('/how-you-work/api/export.csv').auth('dfy', 'secret');
    const [cols, row, extra] = parseCsv(res.text.slice(1));
    expect(cols).toEqual([
      'respondentId', 'submittedAt', 'receivedAt',
      'yourWork.markDone', 'yourWork.followWork', 'logsHours',
      'planning.createTasks', 'planning.createProjects',
      'decisions.approveWork', 'decisions.approveFiles', 'decisions.approveTime', 'usesProof',
      'requests.sendRequests', 'requests.handleRequests',
      'license',
    ]);
    expect(row[cols.indexOf('license')]).toBe('External');
    expect(extra).toBeUndefined();
  });

  it('redirects the bare path and keeps the respondent ID', async () => {
    const res = await request(app).get('/how-you-work?r=hyw1');
    expect(res.headers.location).toBe('/how-you-work/?r=hyw1');
  });
});

describe('work survey (combined)', () => {
  it('saves both derived values and exports the activity grids alongside the workflow answers', async () => {
    const { q1: _dropped, ...rest } = completeAnswers();
    const answers = {
      ...rest,
      yourWork: { markDone: 'Every week', followWork: 'Never' },
      logsHours: true,
      q6: 'Other',
      q6_other: 'About a week',
      planning: { createTasks: 'Never', createProjects: 'Never' },
      requests: { sendRequests: 'Never', handleRequests: 'Never' },
      decisions: { approveWork: 'Never', approveFiles: 'Never', approveTime: 'Never' },
    };
    await request(app).post('/work-survey/api/responses').send({ respondentId: 'w1', answers }).expect(201);

    const res = await request(app).get('/work-survey/api/export.csv').auth('dfy', 'secret');
    const [cols, row] = parseCsv(res.text.slice(1));
    expect(cols).toContain('yourWork.markDone');
    expect(cols).toContain('requests.handleRequests');
    expect(cols).toContain('q3.finding');
    expect(cols).not.toContain('q1.execute');
    expect(cols).not.toContain('yourWork.logHours');
    expect(row[cols.indexOf('logsHours')]).toBe('Yes');
    expect(row[cols.indexOf('q6')]).toBe('Other');
    expect(row[cols.indexOf('q6_other')]).toBe('About a week');
    expect(cols.slice(-2)).toEqual(['q4_placeCount', 'license']);
    expect(row.slice(-2)).toEqual(['3', 'Standard']);
  });
});
