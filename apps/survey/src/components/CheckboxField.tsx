import type { CheckboxQuestion } from '../survey';
import type { FieldProps } from './QuestionField';

/** One optional checkbox with its label. No fieldset or number; it reads as part of the page. */
export function CheckboxField({ question, answers, onChange }: FieldProps<CheckboxQuestion>) {
  const inputId = `${question.id}-checkbox`;
  return (
    <div className={`question question--checkbox${question.highlight ? ' question--highlight' : ''}`}>
      <label htmlFor={inputId} className="choice choice--standalone">
        <input
          id={inputId}
          type="checkbox"
          checked={answers[question.id] === true}
          onChange={(e) => onChange(question.id, e.target.checked)}
        />
        <span>{question.prompt}</span>
      </label>
    </div>
  );
}
