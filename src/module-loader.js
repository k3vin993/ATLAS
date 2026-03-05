/**
 * ATLAS Module Loader — Odoo-style plugin architecture.
 * Discovers, validates, and manages module lifecycle.
 *
 * Modules are self-contained directories with manifest.json + index.js.
 * Built-in modules live in src/modules/, external in modules/ (gitignored).
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const BUILTIN_DIR = join(__dirname, 'modules');
const EXTERNAL_DIR = join(PROJECT_ROOT, 'modules');

const REQUIRED_MANIFEST = ['id', 'name', 'version'];

export class ModuleLoader {
  /**
   * @param {import('./atlas.js').Atlas} atlas
   * @param {object} config — full atlas config (config.yml parsed)
   * @param {import('./ai/model-registry.js').ModelRegistry} registry — AI model registry (optional)
   */
  constructor(atlas, config, registry = null) {
    this.atlas = atlas;
    this.config = config;
    this.registry = registry;
    this.modules = new Map(); // id → { manifest, instance, timer, status, error, last_run, records_processed }
  }

  /**
   * Scan built-in + external module directories for valid manifests.
   * Returns array of { manifest, dir, builtin }.
   */
  discover() {
    const found = [];

    for (const [base, builtin] of [[BUILTIN_DIR, true], [EXTERNAL_DIR, false]]) {
      if (!existsSync(base)) continue;
      let entries;
      try { entries = readdirSync(base, { withFileTypes: true }); } catch { continue; }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = join(base, entry.name);
        const manifestPath = join(dir, 'manifest.json');
        if (!existsSync(manifestPath)) continue;

        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
          const missing = REQUIRED_MANIFEST.filter(k => !manifest[k]);
          if (missing.length) {
            console.error(`[ATLAS:modules] Invalid manifest in ${dir}: missing ${missing.join(', ')}`);
            continue;
          }
          found.push({ manifest, dir, builtin });
        } catch (e) {
          console.error(`[ATLAS:modules] Failed to read manifest in ${dir}: ${e.message}`);
        }
      }
    }

    return found;
  }

  /**
   * Build a ModuleContext for a given module.
   */
  _buildContext(moduleId, moduleConfig) {
    const atlas = this.atlas;
    const stateKey = `module:${moduleId}`;
    return {
      atlas,
      config: moduleConfig ?? {},
      registry: this.registry,
      logger: {
        info: (...args) => console.error(`[ATLAS:${moduleId}]`, ...args),
        warn: (...args) => console.error(`[ATLAS:${moduleId}] WARN:`, ...args),
        error: (...args) => console.error(`[ATLAS:${moduleId}] ERROR:`, ...args),
      },
      state: {
        get(key) {
          const row = atlas.getConnectorState(`${stateKey}:${key}`);
          if (!row?.last_synced_at) return null;
          try { return JSON.parse(row.last_synced_at); } catch { return row.last_synced_at; }
        },
        set(key, value) {
          atlas.setConnectorState(`${stateKey}:${key}`, {
            last_synced_at: typeof value === 'string' ? value : JSON.stringify(value),
            last_count: 0,
          });
        },
      },
    };
  }

  /**
   * Discover all modules, import them, initialize, and start enabled ones.
   */
  async loadAll() {
    const discovered = this.discover();
    const modulesConfig = this.config?.modules ?? {};

    for (const { manifest, dir, builtin } of discovered) {
      const id = manifest.id;
      const modConfig = modulesConfig[id] ?? {};
      const indexPath = join(dir, 'index.js');

      if (!existsSync(indexPath)) {
        console.error(`[ATLAS:modules] Module "${id}" has no index.js, skipping`);
        continue;
      }

      try {
        const mod = await import(indexPath);
        const instance = mod.default ?? mod;

        const entry = {
          manifest,
          instance,
          dir,
          builtin,
          config: modConfig,
          timer: null,
          status: 'stopped',
          error: null,
          last_run: null,
          records_processed: 0,
        };

        this.modules.set(id, entry);

        // Initialize with context
        const ctx = this._buildContext(id, modConfig);
        if (typeof instance.initialize === 'function') {
          await instance.initialize(ctx);
        }

        // Start if enabled
        if (modConfig.enabled !== false && modConfig.enabled !== undefined) {
          await this.startModule(id);
        }

        console.error(`[ATLAS:modules] Loaded "${id}" v${manifest.version} (${entry.status})`);
      } catch (e) {
        console.error(`[ATLAS:modules] Failed to load "${id}": ${e.message}`);
        this.modules.set(id, {
          manifest,
          instance: null,
          dir,
          builtin,
          config: modConfig,
          timer: null,
          status: 'error',
          error: e.message,
          last_run: null,
          records_processed: 0,
        });
      }
    }

    console.error(`[ATLAS:modules] ${this.modules.size} module(s) discovered`);
  }

  /**
   * Start a specific module + set up polling timer.
   */
  async startModule(id) {
    const entry = this.modules.get(id);
    if (!entry) throw new Error(`Module not found: ${id}`);
    if (!entry.instance) throw new Error(`Module "${id}" has no loaded instance`);

    try {
      if (typeof entry.instance.start === 'function') {
        await entry.instance.start();
      }
      entry.status = 'running';
      entry.error = null;

      // Set up polling interval
      const interval = entry.config?.interval_minutes ?? entry.manifest.config_schema?.interval_minutes?.default;
      if (interval && interval > 0) {
        entry.timer = setInterval(async () => {
          try {
            await this.runModule(id);
          } catch (e) {
            entry.error = e.message;
            console.error(`[ATLAS:modules] Poll error for "${id}": ${e.message}`);
          }
        }, interval * 60_000);
      }
    } catch (e) {
      entry.status = 'error';
      entry.error = e.message;
      throw e;
    }
  }

  /**
   * Stop a module and clear its polling timer.
   */
  async stopModule(id) {
    const entry = this.modules.get(id);
    if (!entry) throw new Error(`Module not found: ${id}`);

    if (entry.timer) {
      clearInterval(entry.timer);
      entry.timer = null;
    }

    if (entry.instance && typeof entry.instance.stop === 'function') {
      try { await entry.instance.stop(); } catch (e) {
        console.error(`[ATLAS:modules] Stop error for "${id}": ${e.message}`);
      }
    }

    entry.status = 'stopped';
  }

  /**
   * Manually trigger a single sync cycle for a module.
   */
  async runModule(id) {
    const entry = this.modules.get(id);
    if (!entry) throw new Error(`Module not found: ${id}`);
    if (!entry.instance) throw new Error(`Module "${id}" has no loaded instance`);

    try {
      let result = null;
      if (typeof entry.instance.run === 'function') {
        result = await entry.instance.run();
      }
      entry.last_run = new Date().toISOString();
      if (result?.records_processed != null) {
        entry.records_processed += result.records_processed;
      }
      entry.error = null;
      return result;
    } catch (e) {
      entry.error = e.message;
      entry.last_run = new Date().toISOString();
      throw e;
    }
  }

  /**
   * Get info for all discovered modules.
   */
  getModules() {
    const list = [];
    for (const [id, entry] of this.modules) {
      list.push(this._formatModule(id, entry));
    }
    return list;
  }

  /**
   * Get info for a single module.
   */
  getModule(id) {
    const entry = this.modules.get(id);
    if (!entry) return null;
    return this._formatModule(id, entry);
  }

  _formatModule(id, entry) {
    let instanceStatus = null;
    if (entry.instance && typeof entry.instance.getStatus === 'function') {
      try { instanceStatus = entry.instance.getStatus(); } catch {}
    }

    return {
      id,
      ...entry.manifest,
      builtin: entry.builtin,
      enabled: entry.config?.enabled !== false && entry.config?.enabled !== undefined,
      status: entry.status,
      error: entry.error,
      last_run: instanceStatus?.last_run ?? entry.last_run,
      records_processed: instanceStatus?.files_processed ?? instanceStatus?.records_processed ?? entry.records_processed,
      config: entry.config,
      instance_status: instanceStatus,
    };
  }

  /**
   * Stop all running modules (graceful shutdown).
   */
  async shutdown() {
    for (const [id, entry] of this.modules) {
      if (entry.status === 'running') {
        try { await this.stopModule(id); } catch (e) {
          console.error(`[ATLAS:modules] Shutdown error for "${id}": ${e.message}`);
        }
      }
    }
  }
}
