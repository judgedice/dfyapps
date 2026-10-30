import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { Answers } from '../answers';
import { licenseFor, survey } from '../surveys/how-you-work';
import { setRespondent } from './fixtures';

/** Every activity answered "Never", with overrides by row id. */
function answers(overrides: Record<string, string> = {}): Answers {
  const out: Answers = {};
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.type !== 'matrix') continue;
      out[q.id] = Object.fromEntries(q.rows.map((r) => [r.id, overrides[r.id] ?? 'Never']));
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
    [{ logHours: 'Less often' }, 'Light'],
    [{ approveTime: 'Every week' }, 'Light'],
    [{ markDone: 'Less often' }, 'Standard'],
    [{ createTasks: 'Every month' }, 'Standard'],
    [{ createProjects: 'Less often' }, 'Standard'],
    [{ handleRequests: 'Every week' }, 'Standard'],
    [{ handleRequests: 'Every week', logHours: 'Every week', sendRequests: 'Every week' }, 'Standard'],
  ])('%j → %s', (overrides, license) => {
    expect(licenseFor(answers(overrides))).toBe(license);
  });

  it('is blank until every activity is answered', () => {
    expect(licenseFor({})).toBe('');
  });
});

describe('how you work survey', () => {
  it('never names a tool or asks about dashboards', () => {
    const text = JSON.stringify(survey);
    expect(text).not.toMatch(/workfront|dashboard|license/i);
  });

  it('runs four sections with rewards and submits the derived license', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App survey={survey} submitUrl="/how-you-work/api/responses" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
    const rewards: string[] = [];
    for (let i = 0; i < survey.sections.length; i++) {
      for (const row of screen.getAllByRole('row').filter((r) => r.querySelector('input'))) {
        const choice = i === 0 && row.textContent?.includes('Log the hours') ? 'Every week' : 'Never';
        await user.click(row.querySelector<HTMLInputElement>(`input[value="${choice}"]`)!);
      }
      const last = i === survey.sections.length - 1;
      await user.click(screen.getByRole('button', { name: last ? 'Submit' : 'Next' }));
      if (!last) rewards.push(screen.getAllByRole('status').map((s) => s.textContent).join(''));
    }
    await screen.findByRole('heading', { name: 'Thank you' });

    expect(rewards).toEqual(['Great job', 'Nice work', 'One section left']);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.answers.yourWork).toEqual({ markDone: 'Never', logHours: 'Every week', followWork: 'Never' });
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
