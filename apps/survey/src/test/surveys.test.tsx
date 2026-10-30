import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { surveys } from '../surveys';
import { survey as workSurvey } from '../surveys/work-survey';
import { completeAnswers } from './answers.fixture';
import { setRespondent } from './fixtures';

beforeEach(() => setRespondent('all1'));
afterEach(() => {
  vi.unstubAllGlobals();
  setRespondent(null);
});

describe.each(Object.values(surveys))('$id', (survey) => {
  it('celebrates between every page', () => {
    const sections = survey.sections;
    for (const section of sections.slice(0, -1)) expect(section.reward, section.id).toBeDefined();
  });

  it('has unique question ids', () => {
    const ids = survey.sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a unique storage key', () => {
    const keys = Object.values(surveys).map((s) => s.storageKey ?? s.id);
    expect(keys.filter((k) => k === (survey.storageKey ?? survey.id))).toHaveLength(1);
  });
});

describe('work survey (combined)', () => {
  const grids = {
    yourWork: { markDone: 'Never', logHours: 'Every week', followWork: 'Never' },
    planning: { createTasks: 'Never', createProjects: 'Never' },
    requests: { sendRequests: 'Never', handleRequests: 'Never' },
    decisions: { approveWork: 'Never', approveFiles: 'Never', approveTime: 'Never' },
  };

  it('replaces the old first section with the activity grids', () => {
    const ids = workSurvey.sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(ids).not.toContain('q1');
    expect(ids.slice(0, 3)).toEqual(['yourWork', 'planning', 'decisions']);
    expect(ids).toContain('requests');
    expect(workSurvey.sections).toHaveLength(9);
  });

  it('derives both the place count and the license', () => {
    const { q1: _dropped, ...rest } = completeAnswers();
    expect(workSurvey.derive?.({ ...rest, ...grids })).toEqual({ q4_placeCount: 3, license: 'Light' });
  });

  it('shows a reward after the first page', async () => {
    const user = userEvent.setup();
    render(<App survey={workSurvey} />);
    for (const row of screen.getAllByRole('row').filter((r) => r.querySelector('input'))) {
      await user.click(row.querySelector<HTMLInputElement>('input[value="Never"]')!);
    }
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Planning and decisions');
    expect(screen.getByText('Great job', { selector: '[role="status"]' })).toBeInTheDocument();
  });
});
