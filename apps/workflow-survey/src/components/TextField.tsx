import type { TextQuestion } from '../survey';
import { QuestionFrame, fieldIds, type FieldProps } from './QuestionField';

export function TextField({ question, number, answers, onChange }: FieldProps<TextQuestion>) {
  const raw = answers[question.id];
  const value = typeof raw === 'string' ? raw : '';
  const counterId = `${question.id}-counter`;

  return (
    <QuestionFrame question={question} number={number} optional>
      <textarea
        rows={5}
        maxLength={question.maxLength}
        value={value}
        aria-labelledby={fieldIds(question.id).legend}
        aria-describedby={counterId}
        onChange={(e) => onChange(question.id, e.target.value.slice(0, question.maxLength))}
      />
      <p id={counterId} className="text-counter">
        {value.length} / {question.maxLength} characters
      </p>
    </QuestionFrame>
  );
}
