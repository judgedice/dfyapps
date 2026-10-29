import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  buildSubmission,
  validateQuestion,
  validateQuestions,
  type AnswerValue,
  type Answers,
  type Submission,
} from './answers';
import { QuestionField, fieldIds } from './components/QuestionField';
import { REWARD_DURATION, Reward } from './components/Reward';
import { clearProgress, loadProgress, readRespondentId, saveProgress } from './storage';
import { survey as defaultSurvey, type Section, type Survey } from './survey';
import wordmark from './assets/dfy-wordmark-gravelgreen.svg';
import wordmarkOnDark from './assets/dfy-wordmark-light.svg';

type Outcome =
  | { status: 'sent'; submission: Submission }
  | { status: 'local'; submission: Submission }
  | { status: 'failed'; submission: Submission; message: string };

interface AppProps {
  survey?: Survey;
  /** Overrides `VITE_SUBMIT_URL`; used by tests. */
  submitUrl?: string;
}

export default function App({ survey = defaultSurvey, submitUrl }: AppProps) {
  const respondentId = useMemo(() => readRespondentId(), []);
  const sections = survey.sections;
  const lastStep = sections.length - 1;

  const [initial] = useState(() => loadProgress(respondentId));
  const [answers, setAnswers] = useState<Answers>(initial?.answers ?? {});
  const [step, setStep] = useState(() => Math.min(Math.max(initial?.step ?? 0, 0), lastStep));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasNavigated = useRef(false);

  // Section rewards show once per section per visit; `key` restarts the animation.
  const [reward, setReward] = useState<(NonNullable<Section['reward']> & { key: number }) | null>(null);
  const rewarded = useRef(new Set<string>());

  useEffect(() => {
    if (!reward) return;
    const timer = window.setTimeout(() => setReward(null), REWARD_DURATION);
    return () => window.clearTimeout(timer);
  }, [reward]);

  const section = sections[step];
  let questionNumber = sections.slice(0, step).reduce((n, s) => n + s.questions.length, 0);

  useEffect(() => {
    if (!outcome) saveProgress(respondentId, { answers, step });
  }, [respondentId, answers, step, outcome]);

  // Move focus to the new section heading (or result heading) after navigation.
  useEffect(() => {
    if (hasNavigated.current) headingRef.current?.focus();
  }, [step, outcome]);

  // An allocation that doesn't total 100 blocks Next; the button points at the running total.
  const blockingAllocation = section.questions.find(
    (q) => q.type === 'allocation' && validateQuestion(q, answers) !== null,
  );
  const allocationBlocked = Boolean(blockingAllocation);

  const handleChange = (key: string, value: AnswerValue | undefined) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    // Re-check questions that are already showing an error so messages clear as soon as they're fixed.
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const updated: Record<string, string> = {};
      for (const q of section.questions) {
        if (!prev[q.id]) continue;
        const error = validateQuestion(q, next);
        if (error) updated[q.id] = error;
      }
      return updated;
    });
  };

  const focusFirstError = (errs: Record<string, string>) => {
    const first = section.questions.find((q) => errs[q.id]);
    if (!first) return;
    requestAnimationFrame(() => {
      const field = document.getElementById(fieldIds(first.id).field);
      const target =
        field?.querySelector<HTMLElement>('[aria-invalid="true"] input, input:not(:checked), textarea') ??
        field?.querySelector<HTMLElement>('input, textarea');
      target?.focus();
    });
  };

  const goTo = (nextStep: number) => {
    hasNavigated.current = true;
    setErrors({});
    setStep(nextStep);
    window.scrollTo?.(0, 0);
  };

  const validateCurrent = () => {
    const errs = validateQuestions(section.questions, answers);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      focusFirstError(errs);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrent()) return;
    if (section.reward && !rewarded.current.has(section.id)) {
      rewarded.current.add(section.id);
      setReward({ ...section.reward, key: Date.now() });
    }
    goTo(step + 1);
  };

  const handleBack = () => goTo(step - 1);

  const submit = async () => {
    if (!validateCurrent()) return;
    // Guard against an earlier section that became invalid (for example, edited saved data).
    const invalidStep = sections.findIndex(
      (s) => Object.keys(validateQuestions(s.questions, answers)).length > 0,
    );
    if (invalidStep !== -1) {
      goTo(invalidStep);
      setErrors(validateQuestions(sections[invalidStep].questions, answers));
      return;
    }

    const submission = buildSubmission(survey, respondentId, answers);
    const url = (submitUrl ?? import.meta.env.VITE_SUBMIT_URL ?? '').trim();
    hasNavigated.current = true;

    if (!url) {
      setOutcome({ status: 'local', submission });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });
      if (!res.ok) throw new Error(`The server responded with status ${res.status}.`);
      clearProgress(respondentId);
      setOutcome({ status: 'sent', submission });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The request failed.';
      setOutcome({ status: 'failed', submission, message });
    } finally {
      setSubmitting(false);
    }
  };

  if (outcome) {
    return (
      <Shell title={survey.title}>
        <ResultScreen outcome={outcome} headingRef={headingRef} onRetry={() => setOutcome(null)} />
      </Shell>
    );
  }

  return (
    <Shell title={survey.title} intro={survey.intro}>
      {reward && <Reward key={reward.key} icon={reward.icon} label={reward.label} />}
      <p className="sr-only" role="status">
        {reward?.label ?? ''}
      </p>
      <div className="progress">
        <p className="eyebrow" aria-hidden="true">
          Section {step + 1} of {sections.length}
        </p>
        <div
          className="progress__track"
          role="progressbar"
          aria-label="Survey progress"
          aria-valuemin={1}
          aria-valuemax={sections.length}
          aria-valuenow={step + 1}
          aria-valuetext={`Section ${step + 1} of ${sections.length}: ${section.title}`}
        >
          {sections.map((s, i) => (
            <span
              key={s.id}
              className={`progress__segment${i < step ? ' is-done' : i === step ? ' is-current' : ''}`}
            />
          ))}
        </div>
      </div>

      <form
        className="section"
        noValidate
        aria-labelledby="section-heading"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === lastStep) void submit();
          else handleNext();
        }}
      >
        <h2 id="section-heading" ref={headingRef} tabIndex={-1} className="section__title">
          {section.title}
        </h2>
        <span className="rule" aria-hidden="true" />
        {step === 0 && (
          <p className="section__note">All questions are required unless marked optional.</p>
        )}

        {section.questions.map((q) => {
          questionNumber += 1;
          return (
            <QuestionField
              key={q.id}
              question={q}
              number={questionNumber}
              answers={answers}
              error={errors[q.id]}
              onChange={handleChange}
            />
          );
        })}

        <div className="nav">
          {step > 0 ? (
            <button type="button" className="button button--secondary" onClick={handleBack}>
              <Chevron direction="left" />
              Back
            </button>
          ) : (
            <span />
          )}
          {step < lastStep ? (
            <button
              type="submit"
              className="button button--primary"
              aria-disabled={allocationBlocked || undefined}
              aria-describedby={blockingAllocation ? `${blockingAllocation.id}-total` : undefined}
            >
              Next
              <Chevron />
            </button>
          ) : (
            <button type="submit" className="button button--primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
              {!submitting && <Chevron />}
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

function Shell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="page">
      <header className="header">
        <picture>
          <source srcSet={wordmarkOnDark} media="(prefers-color-scheme: dark)" />
          <img className="header__logo" src={wordmark} alt="DFY" width={83} height={30} />
        </picture>
        <h1 className="header__title">{title}</h1>
        {intro && <p className="header__intro">{intro}</p>}
      </header>
      <main className="card">{children}</main>
    </div>
  );
}

/** Forward/back glyph that echoes the chevron in the DFY mark. */
function Chevron({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return (
    <svg
      className={`chevron chevron--${direction}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={direction === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
    </svg>
  );
}

function ResultScreen({
  outcome,
  headingRef,
  onRetry,
}: {
  outcome: Outcome;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onRetry: () => void;
}) {
  const { submission } = outcome;
  // The respondent ID is attached to the data but never displayed.
  const { respondentId: _hidden, ...displayed } = submission;

  const download = () => {
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'survey-response.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="result" aria-labelledby="result-heading">
      <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="section__title">
        Thank you
      </h2>
      <span className="rule" aria-hidden="true" />
      {outcome.status === 'sent' && (
        <p>Your response has been submitted. We appreciate the time. You can close this page.</p>
      )}
      {outcome.status === 'local' && (
        <p>
          Your answers are complete. Download the file below and send it to the person who shared
          this survey with you.
        </p>
      )}
      {outcome.status === 'failed' && (
        <div className="notice" role="alert">
          <p>
            <strong>Your response couldn’t be sent.</strong> {outcome.message} Your answers are still
            saved in this browser. Try again, or download the file and send it to the person who
            shared this survey with you.
          </p>
        </div>
      )}

      {outcome.status !== 'sent' && (
        <>
          <div className="result__actions">
            <button type="button" className="button button--primary" onClick={download}>
              Download JSON
            </button>
            {outcome.status === 'failed' && (
              <button type="button" className="button button--secondary" onClick={onRetry}>
                Back to survey
              </button>
            )}
          </div>
          <h3 className="result__json-title">Your response</h3>
          <pre className="result__json" tabIndex={0} aria-label="Your response as JSON">
            {JSON.stringify(displayed, null, 2)}
          </pre>
        </>
      )}
    </section>
  );
}
