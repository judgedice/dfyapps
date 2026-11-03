// A small password-protected page for uploading a survey's roster, so the CSV export can include
// each respondent's department and role.

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface RosterStatus {
  people: number;
  uploadedAt: string;
}

export function rosterPage(opts: {
  surveyTitle: string;
  surveyId: string;
  status?: RosterStatus;
  message?: { kind: 'ok' | 'error'; text: string };
}): string {
  const { surveyTitle, surveyId, status, message } = opts;
  const current = status
    ? `${status.people} ${status.people === 1 ? 'person' : 'people'} on the roster, uploaded ${escapeHtml(
        new Date(status.uploadedAt).toUTCString(),
      )}.`
    : 'No roster uploaded yet.';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Roster: ${escapeHtml(surveyTitle)}</title>
<style>
  body { margin: 0; background: #f5f5f5; color: #232424; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 640px; margin: 40px auto; padding: 28px; background: #fff; border: 1px solid #d5d5d5; border-radius: 8px; }
  h1 { margin: 0 0 4px; font-size: 1.5rem; color: #0a1412; }
  .muted { color: #5e5e5e; margin: 0 0 20px; }
  .note { padding: 12px 14px; border-radius: 4px; margin: 0 0 20px; }
  .ok { background: #ecf5f0; border-left: 3px solid #2e6b4f; }
  .error { background: #fbefeb; border-left: 3px solid #a8361a; }
  ol { padding-left: 20px; }
  form { margin: 20px 0; display: grid; gap: 12px; justify-items: start; }
  button { font: inherit; font-weight: 600; padding: 10px 20px; border-radius: 4px; border: 0; background: #303841; color: #fff; cursor: pointer; }
  a { color: #3d6b6e; }
</style>
</head>
<body>
<main>
  <h1>Roster</h1>
  <p class="muted">${escapeHtml(surveyTitle)}</p>
  ${message ? `<p class="note ${message.kind}" role="status">${escapeHtml(message.text)}</p>` : ''}
  <p><strong>Current roster:</strong> ${current}</p>
  <p>Upload the roster so the CSV export shows each respondent's <strong>Department</strong> and <strong>Role</strong>.</p>
  <ol>
    <li>In the planning spreadsheet, open the <strong>Roster</strong> tab.</li>
    <li>Choose <strong>File &gt; Save As</strong> (or <strong>Save a Copy</strong>) and pick <strong>CSV UTF-8</strong>. Excel saves just that tab.</li>
    <li>Upload that file here.</li>
  </ol>
  <p class="muted">Only Respondent ID, Department, and Role are kept. Names, emails, and every other column are ignored. Uploading again replaces the whole roster, and the export always uses the latest one, including for responses already received.</p>
  <form method="post" enctype="multipart/form-data">
    <label for="roster">Roster CSV</label>
    <input id="roster" name="roster" type="file" accept=".csv,text/csv" required>
    <button type="submit">Upload roster</button>
  </form>
  <p><a href="/${escapeHtml(surveyId)}/api/export.csv">Download the export</a></p>
</main>
</body>
</html>`;
}

/** Pulls the first uploaded file's text out of a multipart/form-data body. */
export function fileFromMultipart(body: Buffer, contentType: string): string | undefined {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) return undefined;
  const text = body.toString('utf8');
  for (const part of text.split(`--${boundary}`)) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd);
    if (!/filename=/i.test(headers)) continue;
    return part.slice(headerEnd + 4).replace(/\r\n$/, '');
  }
  return undefined;
}
