import { otherKey } from '../answers';
import type { MultiQuestion } from '../survey';
import { QuestionFrame, type FieldProps } from './QuestionField';

export function MultiField({ question, number, answers, error, onChange }: FieldProps<MultiQuestion>) {
  const raw = answers[question.id];
  const selected = Array.isArray(raw) ? raw : [];
  const otherText = answers[otherKey(question.id)];
  const otherSelected = question.otherOption !== undefined && selected.includes(question.otherOption);
  const otherInputId = `${question.id}-other-text`;

  const toggle = (option: string, checked: boolean) => {
    const next = checked ? [...selected, option] : selected.filter((o) => o !== option);
    // Keep the configured option order.
    onChange(question.id, question.options.filter((o) => next.includes(o)));
  };

  return (
    <QuestionFrame question={question} number={number} error={error}>
      <div className="choices">
        {question.options.map((option) => (
          <label key={option} className="choice">
            <input
              type="checkbox"
              name={question.id}
              value={option}
              checked={selected.includes(option)}
              onChange={(e) => toggle(option, e.target.checked)}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
      {otherSelected && (
        <div className="other-text">
          <label htmlFor={otherInputId}>Describe “{question.otherOption}”</label>
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
