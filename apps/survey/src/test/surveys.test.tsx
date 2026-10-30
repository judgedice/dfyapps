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
    expect(ids.slice(0, 4)).toEqual(['yourWork', 'logsHours', 'planning', 'decisions']);
    expect(ids).toContain('requests');
    expect(workSurvey.sections).toHaveLength(9);
  });

  it('derives both the place count and the license', () => {
    const { q1: _dropped, ...rest } = completeAnswers();
    expect(workSurvey.derive?.({ ...rest, ...grids })).toEqual({ q4_placeCount: 3, license: 'Light' });
  });

  it('asks about logging hours with a checkbox instead of a grid row', () => {
    const [grid, checkbox] = workSurvey.sections[0].questions;
    expect(grid.type === 'matrix' && grid.rows.map((r) => r.id)).toEqual(['markDone', 'followWork']);
    expect(checkbox).toMatchObject({ id: 'logsHours', type: 'checkbox', prompt: 'I log hours' });
  });

  it('highlights exactly the questions that feed the license', () => {
    const highlighted = workSurvey.sections.flatMap((s) => s.questions.filter((q) => q.highlight).map((q) => q.id));
    expect(highlighted).toEqual(['yourWork', 'logsHours', 'planning', 'decisions', 'usesProof', 'requests']);
  });

  it('asks "I use Workfront Proof" as a checkbox under the decisions grid', () => {
    const ids = workSurvey.sections[1].questions.map((q) => q.id);
    expect(ids).toEqual(['planning', 'decisions', 'usesProof']);
    expect(workSurvey.sections[1].questions[2]).toMatchObject({ type: 'checkbox', prompt: 'I use Workfront Proof' });
  });

  it.each([
    [{}, 'External'],
    [{ usesProof: true }, 'Light'],
    [{ usesProof: false }, 'External'],
    [{ usesProof: true, planning: { createTasks: 'Every week', createProjects: 'Never' } }, 'Standard'],
  ])('counts "I use Workfront Proof" toward Light: %j → %s', (extra, license) => {
    const { yourWork: _grid, ...rest } = grids;
    const answers = { ...rest, yourWork: { markDone: 'Never', followWork: 'Never' }, logsHours: false, ...extra };
    expect(workSurvey.derive?.(answers).license).toBe(license);
  });

  it.each([
    [true, 'Light'],
    [false, 'External'],
  ])('counts a checked "I log hours" (%s) toward the license', (logsHours, license) => {
    const { yourWork: _grid, ...rest } = grids;
    const answers = { ...rest, yourWork: { markDone: 'Never', followWork: 'Never' }, logsHours };
    expect(workSurvey.derive?.(answers).license).toBe(license);
  });

  it('puts the checkbox above Next, unnumbered, and submits it as true or false', async () => {
    const user = userEvent.setup();
    render(<App survey={workSurvey} />);
    const checkbox = screen.getByRole('checkbox', { name: 'I log hours' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(checkbox.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(checkbox.closest('.question--highlight')).not.toBeNull();

    await user.click(checkbox);
    for (const row of screen.getAllByRole('row').filter((r) => r.querySelector('input'))) {
      await user.click(row.querySelector<HTMLInputElement>('input[value="Never"]')!);
    }
    await user.click(next);
    // The checkbox doesn't take a question number: page 2 starts at question 2.
    expect(screen.getAllByText('2.')[0]).toBeInTheDocument();
    expect(screen.queryByText('3.', { selector: '.question__number' })).toBeInTheDocument();
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
