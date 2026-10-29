import type { Answers } from '../answers';

/** A complete, valid set of answers. Shared with the server tests, so it must stay DOM-free. */
export function completeAnswers(): Answers {
  return {
    q1: { execute: 'Regularly', review: 'Occasionally', plan: 'Never' },
    q2: { busiestDay: '6–10', openAtOnce: '11–20' },
    q3: { doing: 60, preparing: 25, overhead: 15 },
    q4: ['Email', 'Chat', 'Other'],
    q4_other: 'Ticket queue',
    q5: 'Usually',
    q6: 'Same day',
    q7: '30 min–2 hrs',
    q8: '1–2 days',
    q9: 'A few others (1–3)',
    q10: '2',
    q11: '1',
    q12: 'Sometimes',
    q13: 'Some of the time',
    q14: '2–10 min',
    q15: 'Rarely',
    q16: 'Weekly status report',
    q17: '',
  };
}
