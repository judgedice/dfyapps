import type { CSSProperties } from 'react';
import { otherKey } from '../answers';
import type { SingleQuestion } from '../survey';
import { QuestionFrame, type FieldProps } from './QuestionField';

export function SingleField({ question, number, answers, error, onChange }: FieldProps<SingleQuestion>) {
  const value = answers[question.id];
  const otherText = answers[otherKey(question.id)];
  const otherInputId = `${question.id}-other-text`;
  const otherSelected = question.otherOption !== undefined && value === question.otherOption;
  return (
    <QuestionFrame question={question} number={number} error={error} role="radiogroup">
      <div
        className="choices"
        style={{ '--cols': question.options.length <= 4 ? question.options.length : 1 } as CSSProperties}
      >
        {question.options.map((option) => (
          <label key={option} className="choice">
            <input
              type="radio"
              name={question.id}
              value={option}
              checked={value === option}
              onChange={() => onChange(question.id, option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {otherSelected && (
        <div className="other-text">
          <label htmlFor={otherInputId}>{question.otherPrompt ?? `Describe “${question.otherOption}”`}</label>
          <input
            id={otherInputId}
            type="text"
            maxLength={200}
            value={typeof otherText === 'string' ? otherText : ''}
            onChange={(e) => onChange(otherKey(question.id), e.target.value)}
          />
        </div>
      )}
    </QuestionFrame>
  );
}
