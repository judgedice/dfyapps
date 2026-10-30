import { allocationTotal, type AllocationAnswer } from '../answers';
import type { AllocationQuestion } from '../survey';
import { QuestionFrame, type FieldProps } from './QuestionField';

export function AllocationField({ question, number, answers, error, onChange }: FieldProps<AllocationQuestion>) {
  const value = (answers[question.id] ?? {}) as AllocationAnswer;
  const total = allocationTotal(question, value);
  const remaining = question.total - total;
  const totalId = `${question.id}-total`;

  const update = (itemId: string, raw: string) => {
    const next = { ...value };
    if (raw.trim() === '') delete next[itemId];
    else next[itemId] = Number(raw);
    onChange(question.id, next);
  };

  const status =
    remaining === 0
      ? 'Total is 100%.'
      : remaining > 0
        ? `${remaining}% left to allocate.`
        : `${-remaining}% over. Reduce a value.`;

  return (
    <QuestionFrame
      question={question}
      number={number}
      error={error}
      footer={
        <div id={totalId} className={`allocation__total${remaining === 0 ? ' is-complete' : remaining < 0 ? ' is-over' : ''}`}>
          <span className="allocation__total-label">Total</span>
          <span className="allocation__total-value">{total}%</span>
          <span className="allocation__total-status" role="status" aria-live="polite">
            {status}
          </span>
          <span className="allocation__meter" aria-hidden="true">
            <span
              className={`allocation__meter-fill${remaining < 0 ? ' is-over' : ''}`}
              style={{ width: `${Math.min(Math.max(total, 0), question.total) / question.total * 100}%` }}
            />
          </span>
        </div>
      }
    >
      <div className="allocation">
        {question.items.map((item) => {
          const inputId = `${question.id}-${item.id}`;
          const descId = `${inputId}-desc`;
          return (
            <div key={item.id} className="allocation__item">
              <div className="allocation__text">
                <label htmlFor={inputId} className="allocation__label">
                  {item.label}
                </label>
                {item.description && (
                  <p id={descId} className="allocation__desc">
                    {item.description}
                  </p>
                )}
              </div>
              <div className="allocation__input">
                <input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={question.total}
                  step={1}
                  value={Number.isFinite(value[item.id]) ? value[item.id] : ''}
                  aria-describedby={[item.description && descId, totalId].filter(Boolean).join(' ')}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => update(item.id, e.target.value)}
                />
                <span className="allocation__unit" aria-hidden="true">
                  %
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </QuestionFrame>
  );
}
