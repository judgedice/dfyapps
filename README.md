# DFY apps

Small DFY apps served from `dfy.work`. Each app is a static site under `apps/`, served at `dfy.work/<app>/` by one small Node server that also stores responses.

| App | URL | Folder |
| --- | --- | --- |
| Task and workflow survey | `https://dfy.work/workflow-survey/` | `apps/survey/src/surveys/workflow-survey.ts` |
| Which Workfront license do you need? | `https://dfy.work/workfront-license/` | `apps/survey/src/surveys/workfront-license.ts` |

## How it works

- `apps/survey/` builds every survey (Vite, React, and TypeScript). Each survey's questions live in `src/surveys/`; see that folder's README.
- `server/` is an Express server. For each survey it serves the built files at `/<id>/`, accepts submissions at `POST /<id>/api/responses`, checks them against the survey's own rules, and saves each one as a JSON file under `<id>/`.
- In Azure, files go to the `responses` blob container. Locally, they go to `data/responses/`.
- The whole thing ships as one container to Azure Container Apps, next to the hub. See [docs/azure-setup.md](docs/azure-setup.md).

## Run locally

```bash
npm run setup
```

```bash
npm test
```

```bash
npm run build
```

```bash
EXPORT_PASSWORD=dev npm start
```

Open `http://localhost:8080/workflow-survey/?r=test1`. Submissions are saved under `data/responses/workflow-survey/`.

To work on a survey with hot reload, run `npm run dev` in `apps/survey/` (add `VITE_SURVEY=workfront-license` for the license survey). Without the server, **Submit** shows the JSON and a **Download JSON** button.

## Send the survey

Give each person their own link with an ID in `r`:

```
https://dfy.work/workflow-survey/?r=a7k2p9
```

```
https://dfy.work/workfront-license/?r=a7k2p9
```

Use short, meaningless IDs and keep the ID-to-name list in your own spreadsheet. The ID is saved with each response but never shown on screen. In a spreadsheet, `="https://dfy.work/workflow-survey/?r="&A2` builds the links.

## Get the responses

**As a spreadsheet:** open `https://dfy.work/<id>/api/export.csv` (for example `workflow-survey` or `workfront-license`) and enter the export password (any user name). You get one row per response and one column per answer, ready for Excel or Google Sheets.

- Matrix and allocation questions get a column per row, such as `q1.execute` and `q3.doing`.
- Multi-select questions get a combined column (`q4`), a column for the **Other** text (`q4_other`), and a 1/0 column per option (`q4 [Email]`) for easy counting.
- Text that starts like a formula (`=`, `+`, `-`, `@`) is prefixed with `'` so spreadsheets show it as text.
- The license survey's CSV has a `license` column with Standard, Light, Contributor, or External. Questions someone wasn't asked are blank.
- If someone submits twice, both rows appear. Sort by `respondentId` and `receivedAt` to keep the latest.

You can also download the CSV from the command line:

```bash
curl -u dfy:"$EXPORT_PASSWORD" -o responses.csv https://dfy.work/workflow-survey/api/export.csv
```

**As raw files:** in the Azure portal, open the `dfyappsresponses` storage account, then **Containers → responses**, then the folder named for the survey. Each file is one response.

## Server settings

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Port to listen on |
| `AZURE_STORAGE_CONNECTION_STRING` | unset | Save to Blob Storage. If unset, saves to local files. |
| `RESPONSES_CONTAINER` | `responses` | Blob container name |
| `RESPONSES_DIR` | `data/responses` | Local folder when Blob Storage isn't configured |
| `EXPORT_PASSWORD` | unset | Password for the CSV export. If unset, the export is turned off. |
| `PUBLIC_DIR` | `public` | Folder with each app's built files |
| `BUILD_SHA` | `dev` | Commit shown at `/health`, used by the deploy to confirm a release |

The server limits each IP address to 10 submissions a minute and rejects bodies over 64 KB.

## Deploy

Pushing to `main` runs the tests, builds the image in the hub's registry (`dreemweaverhubacr`), updates the `dfyapps` Container App, and waits for `/health` to report the new commit. One-time setup is in [docs/azure-setup.md](docs/azure-setup.md).

## Add a survey

See "Add a survey" in `apps/survey/README.md`. A new survey gets its own URL, submit endpoint, CSV export, and storage folder with no server changes.
