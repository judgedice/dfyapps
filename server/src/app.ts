import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { buildSubmission, validateQuestions, visibleSections, type Answers } from '../../apps/survey/src/answers';
import type { Survey } from '../../apps/survey/src/survey';
import { surveys as allSurveys } from '../../apps/survey/src/surveys';
import { toCsv } from './csv';
import type { ResponseStore } from './store';

export interface AppOptions {
  store: ResponseStore;
  /** Folder holding each survey's built files, e.g. `<publicDir>/workflow-survey/index.html`. */
  publicDir: string;
  /** Password for the CSV export. Export is disabled when unset. */
  exportPassword?: string;
  /** Shown by /health so deploys can confirm the new build is live. */
  version?: string;
  /** Submissions allowed per client IP per minute, across all surveys. */
  rateLimitPerMinute?: number;
  /** Surveys to serve, each at `/<id>/`. Defaults to every survey in apps/survey/src/surveys. */
  surveys?: Survey[];
}

const MAX_ID_LENGTH = 128;

const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.set({
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; connect-src 'self'; " +
      "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    // Respondent links carry an ID in the query string; don't leak it to other sites.
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000',
  });
  next();
};

/** Small fixed-window limiter. Enough to blunt scripted spam on a single replica. */
function rateLimit(perMinute: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      if (hits.size > 10_000) hits.clear();
      hits.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (++entry.count > perMinute) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many submissions. Try again in a minute.' });
    }
    next();
  };
}

const sha256 = (s: string) => createHash('sha256').update(s).digest();

/** HTTP Basic auth; any user name, the configured password. */
function requirePassword(password: string) {
  const expected = sha256(password);
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.get('authorization') ?? '';
    const decoded = header.startsWith('Basic ')
      ? Buffer.from(header.slice(6), 'base64').toString('utf8')
      : '';
    const given = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : '';
    if (given && timingSafeEqual(sha256(given), expected)) return next();
    res.set('WWW-Authenticate', 'Basic realm="DFY apps export", charset="UTF-8"');
    res.status(401).send('Password required.');
  };
}

interface MountOptions {
  store: ResponseStore;
  publicDir: string;
  exportPassword?: string;
  limiter: ReturnType<typeof rateLimit>;
}

/** Serves one survey at `/<id>/`, with its submit and export endpoints. */
function mountSurvey(app: express.Express, survey: Survey, options: MountOptions) {
  const { store, publicDir, exportPassword, limiter } = options;
  const APP = survey.id;
  const BASE = `/${APP}`;

  // Relative asset paths need the trailing slash. Keep the query string so `?r=` survives.
  app.get(BASE, (req, res, next) => {
    // Express matches `/<id>/` here too; only redirect the bare path.
    if (!req.originalUrl.startsWith(`${BASE}?`) && req.originalUrl !== BASE) return next();
    res.redirect(301, `${BASE}/${req.originalUrl.slice(BASE.length)}`);
  });

  app.post(
    `${BASE}/api/responses`,
    limiter,
    express.json({ limit: '64kb' }),
    async (req, res, next) => {
      try {
        const body = req.body as Record<string, unknown> | undefined;
        const respondentId = body?.respondentId;
        const answers = body?.answers;
        if (
          typeof respondentId !== 'string' ||
          respondentId.length > MAX_ID_LENGTH ||
          !answers ||
          typeof answers !== 'object' ||
          Array.isArray(answers)
        ) {
          return res.status(400).json({ error: 'The submission is not in the expected format.' });
        }

        // Only the questions this respondent was shown are required.
        const errors = validateQuestions(
          visibleSections(survey, answers as Answers).flatMap((s) => s.questions),
          answers as Answers,
        );
        if (Object.keys(errors).length > 0) {
          return res.status(422).json({ error: 'Some required answers are missing.', fields: errors });
        }

        // Rebuild on the server: drops unknown keys, recomputes `derived`, and keeps timestamps honest.
        const receivedAt = new Date();
        const claimed = typeof body.submittedAt === 'string' ? new Date(body.submittedAt) : null;
        const submittedAt = claimed && !Number.isNaN(claimed.getTime()) ? claimed : receivedAt;
        const submission = buildSubmission(survey, respondentId, answers as Answers, submittedAt);

        await store.save(APP, { ...submission, receivedAt: receivedAt.toISOString() });
        res.status(201).json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  if (exportPassword) {
    app.get(`${BASE}/api/export.csv`, requirePassword(exportPassword), async (_req, res, next) => {
      try {
        const records = await store.list(APP);
        const stamp = new Date().toISOString().slice(0, 10);
        res.set({
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${APP}-${stamp}.csv"`,
          'Cache-Control': 'no-store',
        });
        res.send(toCsv(survey, records));
      } catch (err) {
        next(err);
      }
    });
  }

  app.use(
    BASE,
    express.static(path.join(publicDir, APP), {
      index: 'index.html',
      redirect: false,
      setHeaders(res, filePath) {
        // Hashed assets never change; the page itself must always be fresh.
        res.set(
          'Cache-Control',
          filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
        );
      },
    }),
  );
}

export function createApp(options: AppOptions) {
  const {
    store,
    publicDir,
    exportPassword,
    version = 'dev',
    rateLimitPerMinute = 10,
    surveys: surveyList = Object.values(allSurveys),
  } = options;
  const app = express();
  // Azure Container Apps puts one proxy in front of the app; trust it for the client IP.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', version });
  });

  const limiter = rateLimit(rateLimitPerMinute);
  for (const survey of surveyList) mountSurvey(app, survey, { store, publicDir, exportPassword, limiter });

  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found.');
  });

  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Submission is too large.' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong saving your response.' });
  });

  return app;
}
