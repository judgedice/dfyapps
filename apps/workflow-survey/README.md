# Task and workflow survey

A single-page survey built with Vite, React, and TypeScript. Respondents see one section per screen with a progress bar, **Back**, **Next**, and a final **Submit**.

## Run it

Run these from the `apps/workflow-survey/` folder. To run it with the real server, see the README at the repo root.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run build` type-checks the code and writes a static site to `dist/`. Asset paths are relative, so you can host `dist/` from any web server, bucket, or subfolder.

## Send submissions to an endpoint

Set `VITE_SUBMIT_URL` when you build or run the dev server. The survey POSTs the submission as JSON (`Content-Type: application/json`) to that URL.

```bash
VITE_SUBMIT_URL=https://example.com/survey-responses npm run build
```

You can also put it in a `.env` file (see `.env.example`). Vite bakes the value into the build, so rebuild after you change it.

If the endpoint is on another origin, it must allow CORS for your survey's origin, including the preflight `OPTIONS` request that a JSON POST triggers.

What respondents see:

- If the POST succeeds (any 2xx status), the saved answers are cleared and a thank-you screen appears.
- If `VITE_SUBMIT_URL` isn't set, the thank-you screen shows the response JSON and a **Download JSON** button.
- If the POST fails, the screen shows the error, the response JSON, a **Download JSON** button, and **Back to survey** so the respondent can try again. Saved answers are kept.

The on-screen JSON leaves out `respondentId`, so the ID never appears on screen. The downloaded file and the POST body contain the real ID.

## Respondent links

Add the respondent ID to the URL as `r`:

```
https://surveys.example.com/?r=abc123
```

The ID is attached to the submission as `respondentId` and never displayed. URL-encode IDs that contain characters other than letters, digits, `-`, and `_`. Without `?r=`, `respondentId` is an empty string.

In-progress answers and the current section are saved in `localStorage` under `task-workflow-survey:<id>`, so a reload or a return visit picks up where the respondent left off. Each ID gets its own saved copy on a shared device. If storage is blocked, the survey still works, but answers aren't saved between visits.

## Submission format

```json
{
  "respondentId": "abc123",
  "submittedAt": "2026-10-29T17:00:00.000Z",
  "answers": {
    "q1": { "execute": "Regularly", "review": "Occasionally", "plan": "Never" },
    "q2": { "busiestDay": "6–10", "openAtOnce": "11–20" },
    "q3": { "doing": 60, "preparing": 25, "overhead": 15 },
    "q4": ["Email", "Chat", "Other"],
    "q4_other": "Ticket queue",
    "q5": "Usually",
    "q16": "Weekly status report"
  },
  "derived": { "q4_placeCount": 3 }
}
```

Answer shapes by question type:

| Type | Shape |
| --- | --- |
| `single` | The chosen option as a string |
| `multi` | Array of chosen options, in config order. If the `otherOption` is chosen, its text is in `<id>_other`. |
| `matrix` | Object of row ID to the chosen scale point |
| `allocation` | Object of item ID to a whole number; the values total 100 |
| `text` | Trimmed string, omitted when left blank |

`derived.q4_placeCount` is the number of places selected in Q4, computed at submit time.

## Edit the questions

All content lives in `src/survey.ts`. Components render whatever that file defines, so you don't need to touch component code to change wording, options, rows, or sections.

- **Change wording or options:** edit `prompt`, `options`, `scale`, `rows`, or `items`. Options are submitted as their text, so changing an option's text changes the value in the data.
- **Add a question:** add an object to a section's `questions` array with a unique `id` and one of the types `single`, `multi`, `matrix`, `allocation`, or `text`. TypeScript flags missing fields.
- **Add a section:** add an object to `sections`. The progress bar and question numbering update automatically.
- **Add help text:** set `hint` on any question.
- **Rename a matrix row or allocation item:** change its `label`. Keep its `id` stable so the data stays comparable.

Every question except `text` is required. A `text` question's character limit is set by `maxLength`.

If you remove Q4 or change its ID, update the `derived` calculation in `buildSubmission` in `src/answers.ts`.

## Project layout

```
src/survey.ts        Survey content and question types
src/answers.ts       Validation and submission building
src/storage.ts       localStorage helpers and respondent ID parsing
src/App.tsx          Navigation, submit, and result screens
src/components/      One renderer per question type
src/styles.css       Styles; theme colors are CSS variables on :root
src/test/            Vitest and Testing Library tests
```
