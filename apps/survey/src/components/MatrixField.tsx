import type { MatrixAnswer } from '../answers';
import type { MatrixQuestion } from '../survey';
import { QuestionFrame, type FieldProps } from './QuestionField';

/** A table on wide screens; CSS restacks each row as a card on narrow screens. */
export function MatrixField({ question, number, answers, error, onChange }: FieldProps<MatrixQuestion>) {
  const value = (answers[question.id] ?? {}) as MatrixAnswer;

  const select = (rowId: string, choice: string) => onChange(question.id, { ...value, [rowId]: choice });

  return (
    <QuestionFrame question={question} number={number} error={error}>
      <table className="matrix">
        <thead>
          <tr>
            <td />
            {question.scale.map((point) => (
              <th key={point} scope="col">
                {point}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {question.rows.map((row) => {
            const rowHeaderId = `${question.id}-${row.id}-label`;
            const missing = Boolean(error) && !value[row.id];
            return (
              <tr key={row.id} className={missing ? 'is-missing' : undefined}>
                <th scope="row" id={rowHeaderId}>
                  {row.label}
                </th>
                {question.scale.map((point) => (
                  <td key={point}>
                    <label className="matrix__option">
                      <input
                        type="radio"
                        name={`${question.id}-${row.id}`}
                        value={point}
                        checked={value[row.id] === point}
                        aria-describedby={rowHeaderId}
                        aria-invalid={missing || undefined}
                        onChange={() => select(row.id, point)}
                      />
                      <span className="matrix__option-text">{point}</span>
                    </label>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </QuestionFrame>
  );
}
