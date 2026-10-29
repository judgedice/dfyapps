import type { ReactNode } from 'react';
import type { AnswerValue, Answers } from '../answers';
import type { Question } from '../survey';
import { AllocationField } from './AllocationField';
import { MatrixField } from './MatrixField';
import { MultiField } from './MultiField';
import { SingleField } from './SingleField';
import { TextField } from './TextField';

export interface FieldProps<Q extends Question> {
  question: Q;
  number: number;
  answers: Answers;
  error?: string;
  onChange: (key: string, value: AnswerValue | undefined) => void;
}

export function QuestionField(props: FieldProps<Question>) {
  const { question } = props;
  switch (question.type) {
    case 'single':
      return <SingleField {...props} question={question} />;
    case 'multi':
      return <MultiField {...props} question={question} />;
    case 'matrix':
      return <MatrixField {...props} question={question} />;
    case 'allocation':
      return <AllocationField {...props} question={question} />;
    case 'text':
      return <TextField {...props} question={question} />;
  }
}

/** Shared ids so inputs can point at a question's hint and error text. */
export function fieldIds(questionId: string) {
  return {
    field: `field-${questionId}`,
    legend: `legend-${questionId}`,
    hint: `hint-${questionId}`,
    error: `error-${questionId}`,
  };
}

export function describedBy(questionId: string, hasHint: boolean, hasError: boolean, extra?: string) {
  const ids = fieldIds(questionId);
  const parts = [hasHint && ids.hint, hasError && ids.error, extra].filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

interface QuestionFrameProps {
  question: Question;
  number: number;
  error?: string;
  optional?: boolean;
  role?: 'radiogroup';
  footer?: ReactNode;
  children: ReactNode;
}

/** Fieldset + legend wrapper shared by every question type. */
export function QuestionFrame({ question, number, error, optional, role, footer, children }: QuestionFrameProps) {
  const ids = fieldIds(question.id);
  return (
    <fieldset
      id={ids.field}
      className={`question question--${question.type}${error ? ' has-error' : ''}`}
      role={role}
      aria-required={role === 'radiogroup' ? true : undefined}
      aria-invalid={role === 'radiogroup' && error ? true : undefined}
      aria-describedby={describedBy(question.id, Boolean(question.hint), Boolean(error))}
    >
      <legend id={ids.legend} className="question__legend">
        <span className="question__number">{number}.</span>
        <span className="question__text">
          {question.prompt}
          {optional && <span className="question__optional"> (optional)</span>}
        </span>
      </legend>
      {question.hint && (
        <p id={ids.hint} className="question__hint">
          {question.hint}
        </p>
      )}
      {children}
      {footer}
      {error && (
        <p id={ids.error} className="question__error">
          <svg
            className="question__error-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5.5M12 16.5h.01" />
          </svg>
          {error}
        </p>
      )}
    </fieldset>
  );
}
