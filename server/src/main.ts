import path from 'node:path';
import { createApp } from './app';
import { BlobStore, FileStore, type ResponseStore } from './store';

const env = process.env;
const port = Number(env.PORT ?? 8080);

let store: ResponseStore;
if (env.AZURE_STORAGE_CONNECTION_STRING) {
  store = new BlobStore(env.AZURE_STORAGE_CONNECTION_STRING, env.RESPONSES_CONTAINER ?? 'responses');
  console.log(`Saving responses to blob container "${env.RESPONSES_CONTAINER ?? 'responses'}".`);
} else {
  const dir = path.resolve(env.RESPONSES_DIR ?? 'data/responses');
  store = new FileStore(dir);
  console.log(`AZURE_STORAGE_CONNECTION_STRING not set; saving responses to ${dir}.`);
}

if (!env.EXPORT_PASSWORD) console.log('EXPORT_PASSWORD not set; CSV export is disabled.');

const app = createApp({
  store,
  publicDir: path.resolve(env.PUBLIC_DIR ?? 'public'),
  exportPassword: env.EXPORT_PASSWORD,
  version: env.BUILD_SHA,
});

const server = app.listen(port, () => console.log(`Listening on :${port}`));

// Container Apps sends SIGTERM on scale-in and deploys; finish in-flight requests first.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
