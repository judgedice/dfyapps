# DFY surveys

Single-page surveys built with Vite, React, and TypeScript. Respondents see one section per screen with **Back**, **Next**, and a final **Submit**. One codebase builds every survey in `src/surveys/`:

| Survey | Id and URL path | File |
| --- | --- | --- |
| Task and workflow survey | `workflow-survey` | `src/surveys/workflow-survey.ts` |
| How you work | `how-you-work` | `src/surveys/how-you-work.ts` |
| Work and workflow survey | `work-survey` | `src/surveys/work-survey.ts` |

Set `VITE_SURVEY` to the id to choose which one `npm run dev` or `npm run build` uses. It defaults to `workflow-survey`.

## Run it

Run these from the `apps/survey/` folder. To run it with the real server, see the README at the repo root.

```bash
npm install
```

```bash
npm run dev
```

```bash
VITE_SURVEY=how-you-work npm run dev
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
    "q3": { "finding": 10, "doing": 50, "preparing": 25, "overhead": 15 },
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

`derived` holds values each survey computes at submit time with its `derive` function: `q4_placeCount` for the workflow survey, `license` for How you work.

## How you work survey

Four sections ask how often someone does everyday activities: their own tasks, planning, requests, and decisions. It never names a tool. Behind the scenes, `licenseFor` in `src/surveys/how-you-work.ts` maps the answers to a work management license tier, saved as `derived.license`. Respondents don't see it.

The tiers nest (External < Contributor < Light < Standard), and the highest tier any activity needs wins. Any answer other than **Never** counts, except approving files, which needs Light only at **Every week** or **Every month**.

| Activity | Tier |
| --- | --- |
| Mark tasks assigned to you as done | Standard |
| Create tasks for yourself or others | Standard |
| Set up new projects | Standard |
| Respond to requests that others send you | Standard |
| Log the hours you worked | Light |
| Approve the hours other people logged | Light |
| Approve or reject files, weekly or monthly | Light |
| Approve or reject files, less often | Contributor |
| Check progress or comment on work others are doing | Contributor |
| Send a request asking someone else to do work | Contributor |
| Approve or reject tasks or projects | Contributor |
| None of these | External |

## Work and workflow survey

Both surveys in one, nine sections. The How you work activity grids replace the workflow survey's first section (execute, review, plan), and the request activities join the intake section. It reuses the question definitions from both survey files, so edits there carry over. It saves both `q4_placeCount` and `license`.

Every survey shows a reward between pages; a test fails if a section other than the last one has no `reward`.

## Edit the questions

Each survey's content lives in its own file in `src/surveys/`. Components render whatever that file defines, so you don't need to touch component code to change wording, options, rows, or sections. Question types live in `src/survey.ts`.

- **Change wording or options:** edit `prompt`, `options`, `scale`, `rows`, or `items`. Options are submitted as their text, so changing an option's text changes the value in the data.
- **Add a question:** add an object to a section's `questions` array with a unique `id` and one of the types `single`, `multi`, `matrix`, `allocation`, or `text`. TypeScript flags missing fields.
- **Add a section:** add an object to `sections`. The progress bar and question numbering update automatically.
- **Add help text:** set `hint` on any question, or `examples` for a bulleted list under the prompt.
- **Show a section only sometimes:** set `showIf` to a function of the answers so far. Answers to hidden sections aren't submitted or required.
- **Hide the progress bar:** set `showProgress: false` on the survey.
- **Rename a matrix row or allocation item:** change its `label`. Keep its `id` stable so the data stays comparable.

Every question except `text` is required. A `text` question's character limit is set by `maxLength`.

If you remove Q4 from the workflow survey or change its ID, update its `derive` function.

## Add a survey

1. Create `src/surveys/<id>.ts` exporting a `survey` with a unique `id`. The id is its URL path, `dfy.work/<id>/`.
2. Add it to `src/surveys/index.ts`.
3. Add the id to `SURVEYS` in `scripts/build.sh` at the repo root.

The server picks up every survey in `src/surveys/index.ts`, with its own submit endpoint, CSV export, and storage folder.

## Project layout

```
src/surveys/         One file per survey, plus index.ts listing them
src/survey.ts        Question and survey types
src/answers.ts       Validation and submission building
src/storage.ts       localStorage helpers and respondent ID parsing
src/App.tsx          Navigation, submit, and result screens
src/components/      One renderer per question type
src/styles.css       Styles; theme colors are CSS variables on :root
src/test/            Vitest and Testing Library tests
```
