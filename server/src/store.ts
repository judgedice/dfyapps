import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ContainerClient } from '@azure/storage-blob';

/** Where responses are kept: one JSON file per submission, grouped by app. */
export interface ResponseStore {
  /** Saves a record and returns its file name. */
  save(app: string, record: unknown): Promise<string>;
  /** Returns every record saved for an app, oldest first. */
  list(app: string): Promise<unknown[]>;
}

/** `2026-10-29T18-30-00-000Z_<uuid>.json`: sorts by time and never collides. */
function fileName(now: Date): string {
  return `${now.toISOString().replace(/[:.]/g, '-')}_${randomUUID()}.json`;
}

/** Writes to a local folder. Used for development and tests. */
export class FileStore implements ResponseStore {
  constructor(private readonly root: string) {}

  async save(app: string, record: unknown): Promise<string> {
    const dir = path.join(this.root, app);
    await mkdir(dir, { recursive: true });
    const name = fileName(new Date());
    await writeFile(path.join(dir, name), JSON.stringify(record, null, 2), { flag: 'wx' });
    return name;
  }

  async list(app: string): Promise<unknown[]> {
    const dir = path.join(this.root, app);
    let names: string[];
    try {
      names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
    } catch {
      return [];
    }
    return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(dir, n), 'utf8'))));
  }
}

/** Writes to an Azure Blob Storage container, under `<app>/`. */
export class BlobStore implements ResponseStore {
  private readonly container: ContainerClient;

  constructor(connectionString: string, containerName: string) {
    this.container = new ContainerClient(connectionString, containerName);
  }

  async save(app: string, record: unknown): Promise<string> {
    const name = fileName(new Date());
    const body = JSON.stringify(record, null, 2);
    await this.container.getBlockBlobClient(`${app}/${name}`).upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      conditions: { ifNoneMatch: '*' },
    });
    return name;
  }

  async list(app: string): Promise<unknown[]> {
    const names: string[] = [];
    for await (const blob of this.container.listBlobsFlat({ prefix: `${app}/` })) {
      if (blob.name.endsWith('.json')) names.push(blob.name);
    }
    names.sort();
    return Promise.all(
      names.map(async (n) => {
        const buffer = await this.container.getBlobClient(n).downloadToBuffer();
        return JSON.parse(buffer.toString('utf8'));
      }),
    );
  }
}
