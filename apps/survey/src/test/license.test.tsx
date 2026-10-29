import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { licenseFor, survey } from '../surveys/workfront-license';
import { setRespondent } from './fixtures';

const YES = 'Yes, at least one of these';
const NO = 'No, none of these';

beforeEach(() => setRespondent('lic1'));
afterEach(() => {
  vi.unstubAllGlobals();
  setRespondent(null);
});

describe('licenseFor', () => {
  it.each([
    [{ doesWork: YES }, 'Standard'],
    [{ doesWork: NO, tracksTime: YES }, 'Light'],
    [{ doesWork: NO, tracksTime: NO, followsWork: YES }, 'Contributor'],
    [{ doesWork: NO, tracksTime: NO, followsWork: NO }, 'External'],
    [{ doesWork: NO }, ''],
    [{}, ''],
  ])('%j → %s', (answers, license) => {
    expect(licenseFor(answers)).toBe(license);
  });
});

async function run(choices: string[]) {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
  vi.stubGlobal('fetch', fetchMock);
  render(<App survey={survey} submitUrl="/workfront-license/api/responses" />);

  for (const [i, choice] of choices.entries()) {
    await user.click(screen.getByRole('radio', { name: choice }));
    const last = i === choices.length - 1;
    await user.click(screen.getByRole('button', { name: last ? 'Submit' : 'Next' }));
  }
  await screen.findByRole('heading', { name: 'Thank you' });
  return JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
}

describe('workfront license survey', () => {
  it('stops after one question for Standard users', async () => {
    const body = await run([YES]);
    expect(body.answers).toEqual({ doesWork: YES });
    expect(body.derived).toEqual({ license: 'Standard' });
  });

  it('asks a second question for Light users', async () => {
    const body = await run([NO, YES]);
    expect(body.answers).toEqual({ doesWork: NO, tracksTime: YES });
    expect(body.derived).toEqual({ license: 'Light' });
  });

  it('asks three questions for Contributor and External users', async () => {
    expect((await run([NO, NO, YES])).derived).toEqual({ license: 'Contributor' });
  });

  it('classifies External when every answer is no', async () => {
    const body = await run([NO, NO, NO]);
    expect(body.answers).toEqual({ doesWork: NO, tracksTime: NO, followsWork: NO });
    expect(body.derived).toEqual({ license: 'External' });
  });

  it('drops answers to questions that are no longer shown', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App survey={survey} submitUrl="/x" />);

    await user.click(screen.getByRole('radio', { name: NO }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('radio', { name: NO }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('radio', { name: YES }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Thank you' });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.answers).toEqual({ doesWork: YES });
    expect(body.derived.license).toBe('Standard');
  });

  it('shows examples as a list tied to the question, with no progress bar', () => {
    render(<App survey={survey} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: /Do you do any of these/ });
    expect(group).toHaveAccessibleDescription(/Create projects, tasks, or templates/);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('requires an answer before moving on', async () => {
    const user = userEvent.setup();
    render(<App survey={survey} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Choose an answer.')).toBeInTheDocument();
  });
});
