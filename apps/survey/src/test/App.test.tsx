import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppComponent from '../App';
import { survey } from '../surveys/workflow-survey';
import type { ComponentProps } from 'react';
import { completeAnswers, seedProgress, setRespondent, STORAGE_PREFIX } from './fixtures';

const App = (props: Partial<ComponentProps<typeof AppComponent>>) => <AppComponent survey={survey} {...props} />;

const sectionHeading = () => screen.getByRole('heading', { level: 2 });
const nextButton = () => screen.getByRole('button', { name: 'Next' });
const allocationStatus = () => document.querySelector<HTMLElement>('.allocation__total-status')!;
const matrixRows = () => screen.getAllByRole('row').filter((r) => r.querySelector('input'));

beforeEach(() => setRespondent('abc123'));
afterEach(() => {
  vi.unstubAllGlobals();
  setRespondent(null);
});

describe('required questions', () => {
  it('block Next and show inline errors until answered', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Nature of the work');
    expect(screen.getByText('Choose an answer for every row.')).toBeInTheDocument();

    const rows = matrixRows();
    for (const row of rows) {
      await user.click(row.querySelector<HTMLInputElement>('input[value="Regularly"]')!);
    }
    expect(screen.queryByText('Choose an answer for every row.')).not.toBeInTheDocument();

    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Volume');
  });

  it('blocks Next on a single-choice section until each question is answered', async () => {
    const user = userEvent.setup();
    seedProgress('abc123', { ...completeAnswers(), q8: undefined }, 4);
    render(<App />);
    expect(sectionHeading()).toHaveTextContent('Duration and dependencies');

    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Duration and dependencies');
    const q8 = screen.getByRole('radiogroup', { name: /calendar time/ });
    expect(q8).toHaveAttribute('aria-invalid', 'true');
    expect(q8).toHaveAccessibleDescription(/Choose an answer/);

    await user.click(screen.getByRole('radio', { name: '3–5 days' }));
    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Rework');
  });

  it('requires text for the Other option', async () => {
    const user = userEvent.setup();
    seedProgress('abc123', { ...completeAnswers(), q4: ['Other'], q4_other: '' }, 3);
    render(<App />);

    await user.click(nextButton());
    expect(screen.getByText(/Describe “Other.”/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Describe/ }), 'Jira');
    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Duration and dependencies');
  });
});

describe('section rewards', () => {
  it('shows the reward once when a section is first completed', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('');

    for (const row of matrixRows()) {
      await user.click(row.querySelector<HTMLInputElement>('input[value="Never"]')!);
    }
    await user.click(nextButton());
    expect(screen.getByRole('status')).toHaveTextContent('Great job');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''), { timeout: 2500 });

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Volume');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });
});

describe('allocation', () => {
  it('shows a running total and blocks Next until the total is exactly 100', async () => {
    const user = userEvent.setup();
    const { q1, q2 } = completeAnswers();
    seedProgress('abc123', { q1, q2 }, 2);
    render(<App />);
    expect(sectionHeading()).toHaveTextContent('Time allocation');

    await user.type(screen.getByRole('spinbutton', { name: 'Doing the work' }), '50');
    await user.type(screen.getByRole('spinbutton', { name: 'Preparing' }), '30');
    const overhead = screen.getByRole('spinbutton', { name: 'Overhead' });
    await user.type(overhead, '10');

    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(allocationStatus()).toHaveTextContent('10% left to allocate.');
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Time allocation');
    expect(screen.getByText('Your total is 90%. It must equal 100%.')).toBeInTheDocument();

    await user.clear(overhead);
    await user.type(overhead, '30');
    expect(allocationStatus()).toHaveTextContent('10% over');
    expect(nextButton()).toHaveAttribute('aria-disabled', 'true');

    await user.clear(overhead);
    await user.type(overhead, '20');
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(nextButton()).not.toHaveAttribute('aria-disabled');
    await user.click(nextButton());
    expect(sectionHeading()).toHaveTextContent('Notification and intake');
  });
});

describe('persistence', () => {
  it('restores answers and the current section after a reload', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    const rows = matrixRows();
    for (const row of rows) {
      await user.click(row.querySelector<HTMLInputElement>('input[value="Occasionally"]')!);
    }
    await user.click(nextButton());
    await user.click(matrixRows()[0].querySelector<HTMLInputElement>('input[value="21+"]')!);
    first.unmount();

    render(<App />);
    expect(sectionHeading()).toHaveTextContent('Volume');
    expect(
      matrixRows()[0].querySelector<HTMLInputElement>('input[value="21+"]'),
    ).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    for (const row of matrixRows()) {
      expect(row.querySelector<HTMLInputElement>('input[value="Occasionally"]')).toBeChecked();
    }
  });

  it('keeps answers separate per respondent ID', () => {
    seedProgress('someone-else', completeAnswers(), 5);
    render(<App />);
    expect(sectionHeading()).toHaveTextContent('Nature of the work');
  });

  it('still works when localStorage throws', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<App />);
    await user.click(matrixRows()[0].querySelector<HTMLInputElement>('input')!);
    expect(sectionHeading()).toHaveTextContent('Nature of the work');
    vi.restoreAllMocks();
  });
});

describe('submission', () => {
  it('POSTs JSON in the documented format, clears saved answers, and thanks the respondent', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    seedProgress('abc123', completeAnswers(), 7);
    render(<App submitUrl="https://example.test/collect" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('heading', { name: 'Thank you' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.test/collect');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body as string);
    expect(Object.keys(body)).toEqual(['respondentId', 'submittedAt', 'answers', 'derived']);
    expect(body.respondentId).toBe('abc123');
    expect(new Date(body.submittedAt).toISOString()).toBe(body.submittedAt);
    expect(body.answers.q1).toEqual({ execute: 'Regularly', review: 'Occasionally', plan: 'Never' });
    expect(body.answers.q4).toEqual(['Email', 'Chat', 'Other']);
    expect(body.derived).toEqual({ q4_placeCount: 3 });
    expect(Object.keys(body.answers)).toEqual([
      'q1', 'q2', 'q3', 'q4', 'q4_other', 'q5', 'q6', 'q7', 'q8', 'q9',
      'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16',
    ]);

    expect(window.localStorage.getItem(STORAGE_PREFIX + 'abc123')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Download JSON' })).not.toBeInTheDocument();
  });

  it('shows the JSON and a download button when no submit URL is set, without showing the ID', async () => {
    const user = userEvent.setup();
    seedProgress('abc123', completeAnswers(), 7);
    render(<App submitUrl="" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('heading', { name: 'Thank you' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument();
    const json = screen.getByLabelText('Your response as JSON');
    expect(json).toHaveTextContent('"q4_placeCount": 3');
    expect(document.body).not.toHaveTextContent('abc123');
  });

  it('shows the JSON, a download button, and keeps saved answers when the POST fails', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    seedProgress('abc123', completeAnswers(), 7);
    render(<App submitUrl="https://example.test/collect" />);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('status 500');
    expect(screen.getByRole('button', { name: 'Download JSON' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your response as JSON')).toHaveTextContent('"answers"');
    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_PREFIX + 'abc123')).not.toBeNull(),
    );
  });
});
