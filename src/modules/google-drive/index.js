/**
 * ATLAS Google Drive Module v1.1
 *
 * Syncs files from Google Drive folders for AI analysis.
 * Uses native https — no googleapis npm dependency.
 *
 * Features:
 *  - Service account JWT auth with auto-refresh
 *  - Pagination (handles folders with 100+ files)
 *  - Google Workspace export (Docs→PDF, Sheets→CSV, Slides→PDF)
 *  - Optional subfolder recursion
 *  - File size limit
 *  - Content-based dedup (file id + modifiedTime)
 *  - Retry with backoff on transient errors
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { createSign } from 'crypto';
import https from 'https';
import { tmpdir } from 'os';

// ─── State ───────────────────────────────────────────────────────────────────

/** @type {{ atlas: any, config: any, logger: any, state: any }} */
let ctx = null;
let status = 'stopped';
let lastRun = null;
let filesProcessed = 0;
let filesSkipped = 0;
let lastError = null;
let accessToken = null;
let tokenExpiry = 0;

// Google Workspace MIME types → export format
const WORKSPACE_EXPORT = {
  'application/vnd.google-apps.document':     { ext: 'pdf', mime: 'application/pdf' },
  'application/vnd.google-apps.spreadsheet':  { ext: 'csv', mime: 'text/csv' },
  'application/vnd.google-apps.presentation': { ext: 'pdf', mime: 'application/pdf' },
  'application/vnd.google-apps.drawing':      { ext: 'pdf', mime: 'application/pdf' },
};

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
    };

    const req = https.request(opts, (res) => {
      // Follow redirects (302, 307)
      if ((res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        httpsRequest(res.headers.location, options).then(resolve).catch(reject);
        res.resume();
        return;
      }

      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, data: JSON.parse(body), raw: body }); }
        catch { resolve({ status: res.statusCode, data: body, raw: body }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(30_000, () => { req.destroy(new Error('Request timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function httpsDownload(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
    };

    const req = https.request(opts, (res) => {
      // Follow redirects
      if ((res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        httpsDownload(res.headers.location, headers).then(resolve).catch(reject);
        res.resume();
        return;
      }

      if (res.statusCode !== 200) {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          reject(new Error(`Download failed (${res.statusCode}): ${body.slice(0, 200)}`));
        });
        return;
      }

      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.setTimeout(120_000, () => { req.destroy(new Error('Download timeout')); });
    req.end();
  });
}

/**
 * Retry a function up to `retries` times with exponential backoff.
 */
async function withRetry(fn, retries = 2, baseDelay = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === retries) throw e;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getAccessToken(credentials) {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const now = Math.floor(Date.now() / 1000);

  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
  })).toString('base64url');

  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${header}.${payload}.${signature}`;

  const res = await httpsRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (res.status !== 200 || !res.data?.access_token) {
    throw new Error(`OAuth failed (${res.status}): ${typeof res.data === 'string' ? res.data.slice(0, 200) : JSON.stringify(res.data).slice(0, 200)}`);
  }

  accessToken = res.data.access_token;
  // Refresh 60s before expiry
  tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;

  return accessToken;
}

// ─── Drive API helpers ───────────────────────────────────────────────────────

/**
 * List all files in a folder, handling pagination via nextPageToken.
 */
async function listFolder(folderId, token) {
  const allFiles = [];
  let pageToken = null;

  const fields = encodeURIComponent(
    'nextPageToken,files(id,name,mimeType,modifiedTime,size)'
  );

  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const res = await withRetry(() =>
      httpsRequest(url, { headers: { Authorization: `Bearer ${token}` } })
    );

    if (res.status !== 200) {
      throw new Error(`Drive list error (${res.status}): ${JSON.stringify(res.data).slice(0, 200)}`);
    }

    allFiles.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? null;
  } while (pageToken);

  return allFiles;
}

/**
 * Recursively list files across subfolders.
 */
async function listFolderRecursive(folderId, token, depth = 0) {
  if (depth > 10) return []; // safety limit

  const entries = await listFolder(folderId, token);
  const files = [];

  for (const entry of entries) {
    if (entry.mimeType === 'application/vnd.google-apps.folder') {
      const subFiles = await listFolderRecursive(entry.id, token, depth + 1);
      files.push(...subFiles);
    } else {
      files.push(entry);
    }
  }

  return files;
}

/**
 * Download a file (binary) or export a Workspace file to a local format.
 */
async function downloadFile(file, token, exportGoogle) {
  const workspaceType = WORKSPACE_EXPORT[file.mimeType];

  if (workspaceType) {
    if (!exportGoogle) return null; // skip Workspace files if export disabled

    const exportMime = encodeURIComponent(workspaceType.mime);
    const url = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${exportMime}`;
    const buf = await withRetry(() =>
      httpsDownload(url, { Authorization: `Bearer ${token}` })
    );
    const exportName = file.name.replace(/\.[^.]*$/, '') + '.' + workspaceType.ext;
    return { buffer: buf, filename: exportName };
  }

  // Regular file — binary download
  const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
  const buf = await withRetry(() =>
    httpsDownload(url, { Authorization: `Bearer ${token}` })
  );
  return { buffer: buf, filename: file.name };
}

// ─── Module interface ────────────────────────────────────────────────────────

export default {
  async initialize(moduleCtx) {
    ctx = moduleCtx;

    const credPath = ctx.config.credentials_path;
    if (credPath && !existsSync(resolve(credPath))) {
      ctx.logger.warn(`Credentials file not found: ${credPath}`);
    }
  },

  async start() {
    status = 'running';
    lastError = null;
    ctx.logger.info('Started — Google Drive sync');

    try {
      await this.run();
    } catch (e) {
      ctx.logger.error(`Initial run failed: ${e.message}`);
      lastError = e.message;
    }
  },

  async run() {
    const {
      folder_id,
      credentials_path,
      file_types,
      include_subfolders = false,
      max_file_size_mb = 50,
      export_google_docs = true,
    } = ctx.config;

    // ── Validate config ──────────────────────────────────────────────────────

    if (!folder_id) {
      lastError = 'No folder_id configured';
      return { records_processed: 0, error: lastError };
    }

    const credPath = resolve(credentials_path ?? '');
    if (!credentials_path || !existsSync(credPath)) {
      lastError = `Credentials file not found: ${credentials_path}`;
      return { records_processed: 0, error: lastError };
    }

    let credentials;
    try {
      credentials = JSON.parse(readFileSync(credPath, 'utf8'));
    } catch (e) {
      lastError = `Invalid credentials JSON: ${e.message}`;
      return { records_processed: 0, error: lastError };
    }

    if (!credentials.client_email || !credentials.private_key) {
      lastError = 'Credentials JSON missing client_email or private_key';
      return { records_processed: 0, error: lastError };
    }

    // ── Authenticate ─────────────────────────────────────────────────────────

    let token;
    try {
      token = await getAccessToken(credentials);
    } catch (e) {
      lastError = `Auth failed: ${e.message}`;
      return { records_processed: 0, error: lastError };
    }

    // ── List files ───────────────────────────────────────────────────────────

    const allowedExts = new Set(
      (file_types ?? 'pdf,docx,xlsx,csv,json,txt').split(',').map(s => s.trim().toLowerCase())
    );
    const maxBytes = max_file_size_mb * 1024 * 1024;

    let allFiles;
    try {
      allFiles = include_subfolders
        ? await listFolderRecursive(folder_id, token)
        : await listFolder(folder_id, token);
    } catch (e) {
      lastError = `Drive API error: ${e.message}`;
      return { records_processed: 0, error: lastError };
    }

    // Filter by extension (regular files) or keep Workspace types if export enabled
    const files = allFiles.filter(f => {
      const isWorkspace = !!WORKSPACE_EXPORT[f.mimeType];
      if (isWorkspace) return export_google_docs;
      const ext = f.name.split('.').pop()?.toLowerCase();
      return allowedExts.has(ext);
    });

    ctx.logger.info(`Found ${files.length} matching files in folder (${allFiles.length} total)`);

    // ── Process files ────────────────────────────────────────────────────────

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    const tmpDir = join(tmpdir(), 'atlas-gdrive');
    mkdirSync(tmpDir, { recursive: true });

    for (const file of files) {
      const stateKey = `file:${file.id}`;

      try {
        // Dedup: skip if file hasn't changed since last processing
        const prevRaw = ctx.state.get(stateKey);
        if (prevRaw) {
          try {
            const prev = JSON.parse(prevRaw);
            if (prev.modifiedTime === file.modifiedTime) {
              skipped++;
              continue;
            }
          } catch {}
        }

        // Check file size (regular files only — Workspace files have no size)
        if (file.size && parseInt(file.size) > maxBytes) {
          ctx.logger.warn(`Skipped ${file.name}: ${Math.round(file.size / 1024 / 1024)}MB exceeds limit`);
          skipped++;
          continue;
        }

        // Download / export
        const downloaded = await downloadFile(file, token, export_google_docs);
        if (!downloaded) {
          skipped++;
          continue;
        }

        const tmpPath = join(tmpDir, downloaded.filename);
        writeFileSync(tmpPath, downloaded.buffer);

        // Process through AI extract pipeline
        const { processFile } = await import('../../ai/extract-pipeline.js');
        const { ConnectorRunner } = await import('../../connector-runner.js');
        const runner = new ConnectorRunner(ctx.atlas, ctx.atlas.config ?? {});

        const result = await processFile(tmpPath, {
          atlas: ctx.atlas,
          registry: null,
          upsert: (entity, record) => runner._upsert(entity, record),
        });

        // Cleanup temp file
        try { unlinkSync(tmpPath); } catch {}

        if (result.ok && !result.skipped) {
          ctx.state.set(stateKey, JSON.stringify({
            modifiedTime: file.modifiedTime,
            processed_at: new Date().toISOString(),
            records: result.records,
            filename: downloaded.filename,
          }));
          processed++;
          filesProcessed++;
          ctx.logger.info(`Processed: ${downloaded.filename} (${result.records} records)`);
        } else if (result.skipped) {
          // Already processed by extract-pipeline hash dedup
          ctx.state.set(stateKey, JSON.stringify({
            modifiedTime: file.modifiedTime,
            processed_at: new Date().toISOString(),
            records: 0,
            filename: downloaded.filename,
          }));
          skipped++;
        } else {
          errors++;
          ctx.logger.error(`Failed: ${downloaded.filename} — ${result.error}`);
        }
      } catch (e) {
        errors++;
        ctx.logger.error(`Error processing ${file.name}: ${e.message}`);
      }
    }

    filesSkipped += skipped;
    lastRun = new Date().toISOString();
    lastError = errors > 0 ? `${errors} file(s) failed` : null;

    ctx.logger.info(
      `Sync complete: ${processed} processed, ${skipped} skipped, ${errors} errors (${files.length} total)`
    );

    return {
      records_processed: processed,
      skipped,
      errors,
      total_files: files.length,
    };
  },

  async stop() {
    status = 'stopped';
    accessToken = null;
    tokenExpiry = 0;
    ctx.logger.info('Stopped');
  },

  getStatus() {
    return {
      status,
      last_run: lastRun,
      files_processed: filesProcessed,
      files_skipped: filesSkipped,
      folder_id: ctx?.config?.folder_id ?? null,
      error: lastError,
    };
  },
};
