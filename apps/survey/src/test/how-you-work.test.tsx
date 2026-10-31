import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { Answers } from '../answers';
import { licenseFor, survey } from '../surveys/how-you-work';
import { setRespondent } from './fixtures';

/** Every activity answered "Never" and both checkboxes unchecked, with overrides by row or checkbox id. */
function answers(overrides: Record<string, string | boolean> = {}): Answers {
  const out: Answers = {};
  for (const q of survey.sections.flatMap((s) => s.questions)) {
    if (q.type === 'matrix') {
      out[q.id] = Object.fromEntries(q.rows.map((r) => [r.id, (overrides[r.id] as string) ?? 'Never']));
    } else if (q.type === 'checkbox') {
      out[q.id] = overrides[q.id] === true;
    }
  }
  return out;
}

beforeEach(() => setRespondent('hyw1'));
afterEach(() => {
  vi.unstubAllGlobals();
  setRespondent(null);
});

describe('licenseFor', () => {
  it.each([
    [{}, 'External'],
    [{ followWork: 'Less often' }, 'Contributor'],
    [{ sendRequests: 'Every week' }, 'Contributor'],
    [{ approveWork: 'Every month' }, 'Contributor'],
    [{ approveFiles: 'Less often' }, 'Contributor'],
    [{ approveFiles: 'Every month' }, 'Light'],
    [{ logsHours: true }, 'Light'],
    [{ usesProof: true }, 'Light'],
    [{ approveTime: 'Every week' }, 'Light'],
    [{ markDone: 'Less often' }, 'Standard'],
    [{ createTasks: 'Every month' }, 'Standard'],
    [{ createProjects: 'Less often' }, 'Standard'],
    [{ handleRequests: 'Every week' }, 'Standard'],
    [{ handleRequests: 'Every week', logsHours: true, sendRequests: 'Every week' }, 'Standard'],
  ])('%j → %s', (overrides, license) => {
    expect(licenseFor(answers(overrides))).toBe(license);
  });

  it('is blank until every activity is answered', () => {
    expect(licenseFor({})).toBe('');
  });
});

describe('how you work survey', () => {
  it('asks the license questions on three pages, with checkboxes for hours and Proof', () => {
    expect(survey.sections.map((s) => s.questions.map((q) => q.id))).toEqual([
      ['yourWork', 'logsHours'],
      ['planning', 'decisions', 'usesProof'],
      ['requests'],
    ]);
  });

  it('names no tool except Workfront Proof, and never asks about dashboards or licenses', () => {
    const text = JSON.stringify(survey).replace(/Workfront Proof/g, '');
    expect(text).not.toMatch(/workfront|dashboard|license/i);
  });

  it('celebrates between pages based on the answers, and submits the derived license', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App survey={survey} submitUrl="/how-you-work/api/responses" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3');
    const neverEverywhere = async () => {
      for (const row of screen.getAllByRole('row').filter((r) => r.querySelector('input'))) {
        await user.click(row.querySelector<HTMLInputElement>('input[value="Never"]')!);
      }
    };
    const status = () => screen.getAllByRole('status').map((s) => s.textContent).join('');

    await neverEverywhere();
    await user.click(screen.getByRole('checkbox', { name: 'I log hours' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(status()).toBe('Timekeeper');

    await neverEverywhere();
    await user.click(screen.getByRole('checkbox', { name: 'I use Workfront Proof' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(status()).toBe('Proof master');

    await neverEverywhere();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Thank you' });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.answers.yourWork).toEqual({ markDone: 'Never', followWork: 'Never' });
    expect(body.answers).toMatchObject({ logsHours: true, usesProof: true });
    expect(body.derived).toEqual({ license: 'Light' });
  });

  it('requires every activity before moving on', async () => {
    const user = userEvent.setup();
    render(<App survey={survey} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Choose an answer for every row.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Your own work');
  });
});
