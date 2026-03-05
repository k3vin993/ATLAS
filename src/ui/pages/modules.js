import { api } from '../lib/api.js';
import { $, $$, on, esc } from '../lib/utils.js';

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Extensions</div>
    <div class="page-title">Modules</div>
    <div class="page-sub">Manage data source modules — enable, configure, and trigger syncs.</div>
  </div>
  <div class="mod-grid" id="mod-grid"></div>
</div>`;

const cleanups = [];
let refreshTimer = null;

function statusDot(s) {
  if (s === 'running') return '<span class="mod-status-dot green"></span> Running';
  if (s === 'error')   return '<span class="mod-status-dot red"></span> Error';
  return '<span class="mod-status-dot grey"></span> Stopped';
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return Math.floor(diff / 86_400_000) + 'd ago';
}

function renderCard(mod) {
  const enabled = mod.enabled && mod.status !== 'stopped';
  const schema = mod.config_schema ?? {};

  let configFields = '';
  for (const [key, def] of Object.entries(schema)) {
    const val = mod.config?.[key] ?? def.default ?? '';
    const label = esc(def.label ?? key);
    if (def.type === 'boolean') {
      configFields += `
        <div class="mod-config-field">
          <label><input type="checkbox" data-key="${esc(key)}" ${val ? 'checked' : ''}> ${label}</label>
        </div>`;
    } else {
      configFields += `
        <div class="mod-config-field">
          <span>${label}</span>
          <input class="settings-input settings-input-sm" data-key="${esc(key)}" value="${esc(String(val))}" placeholder="${esc(String(def.default ?? ''))}">
        </div>`;
    }
  }

  return `
  <div class="mod-card glass" data-module="${esc(mod.id)}">
    <div class="mod-card-header">
      <div>
        <strong>${esc(mod.name)}</strong>
        <span class="mod-version">v${esc(mod.version)} — ${esc(mod.author ?? 'Unknown')}</span>
      </div>
      <div class="mod-status">${statusDot(mod.status)}</div>
    </div>
    <div class="mod-card-body">
      <div class="mod-desc">${esc(mod.description ?? '')}</div>
      ${mod.last_run ? `<div class="mod-meta">Last run: ${timeAgo(mod.last_run)}</div>` : ''}
      ${mod.records_processed ? `<div class="mod-meta">Files processed: ${mod.records_processed}</div>` : ''}
      ${mod.error ? `<div class="mod-error">${esc(mod.error)}</div>` : ''}
      <div class="mod-actions">
        ${enabled
          ? `<button class="btn btn-sm" data-action="sync" data-id="${esc(mod.id)}">Sync Now</button>
             <button class="btn btn-sm btn-secondary" data-action="disable" data-id="${esc(mod.id)}">Disable</button>`
          : `<button class="btn btn-sm btn-primary" data-action="enable" data-id="${esc(mod.id)}">Enable</button>`
        }
        <button class="btn btn-sm btn-secondary" data-action="toggle-config" data-id="${esc(mod.id)}">Configure</button>
      </div>
    </div>
    <div class="mod-config-panel" id="mod-config-${esc(mod.id)}" style="display:none">
      ${configFields}
      <div class="mod-actions" style="margin-top:0.75rem">
        <button class="btn btn-sm btn-primary" data-action="save-config" data-id="${esc(mod.id)}">Save Config</button>
      </div>
    </div>
  </div>`;
}

async function load() {
  const grid = $('#mod-grid');
  if (!grid) return;

  try {
    const { modules } = await api.get('/api/modules');
    if (!modules || !modules.length) {
      grid.innerHTML = '<div class="mod-empty">No modules discovered. Place modules in <code>src/modules/</code> or <code>modules/</code>.</div>';
      return;
    }
    grid.innerHTML = modules.map(renderCard).join('');
  } catch (e) {
    grid.innerHTML = `<div class="mod-error">Failed to load modules: ${esc(e.message)}</div>`;
  }
}

async function handleAction(action, id) {
  try {
    if (action === 'enable') {
      await api.post(`/api/modules/${id}/enable`);
    } else if (action === 'disable') {
      await api.post(`/api/modules/${id}/disable`);
    } else if (action === 'sync') {
      await api.post(`/api/modules/${id}/sync`);
    } else if (action === 'toggle-config') {
      const panel = $(`#mod-config-${id}`);
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      return; // Don't reload
    } else if (action === 'save-config') {
      await saveConfig(id);
    }
    await load();
  } catch (e) {
    console.error('Module action failed:', e);
    await load();
  }
}

async function saveConfig(id) {
  const card = $(`.mod-card[data-module="${id}"]`);
  if (!card) return;

  // Read current full config
  const { config } = await api.get('/api/config');
  if (!config.modules) config.modules = {};
  if (!config.modules[id]) config.modules[id] = {};

  // Gather field values from the config panel
  const inputs = card.querySelectorAll('.mod-config-panel [data-key]');
  for (const input of inputs) {
    const key = input.dataset.key;
    if (input.type === 'checkbox') {
      config.modules[id][key] = input.checked;
    } else {
      const val = input.value.trim();
      // Try to parse numbers
      if (val !== '' && !isNaN(val)) {
        config.modules[id][key] = Number(val);
      } else {
        config.modules[id][key] = val;
      }
    }
  }

  // Save via YAML config endpoint
  const { stringify } = await import('https://cdn.jsdelivr.net/npm/yaml@2/+esm').catch(() => ({ stringify: null }));
  // Fallback: just post the config object to the setup save endpoint
  await api.post('/api/config', { yaml: configToYaml(config) });
}

function configToYaml(obj, indent = 0) {
  // Minimal YAML serializer for config
  const pad = ' '.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out += `${pad}${k}:\n`;
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      out += `${pad}${k}:\n${configToYaml(v, indent + 2)}`;
    } else if (Array.isArray(v)) {
      out += `${pad}${k}:\n`;
      for (const item of v) {
        if (typeof item === 'object') {
          const lines = configToYaml(item, indent + 4).split('\n').filter(Boolean);
          out += `${pad}  - ${lines[0].trim()}\n`;
          for (const line of lines.slice(1)) out += `${pad}    ${line.trim()}\n`;
        } else {
          out += `${pad}  - ${JSON.stringify(item)}\n`;
        }
      }
    } else if (typeof v === 'string') {
      out += `${pad}${k}: ${v.includes(':') || v.includes('#') || v.includes('"') ? JSON.stringify(v) : v}\n`;
    } else {
      out += `${pad}${k}: ${v}\n`;
    }
  }
  return out;
}

function init() {
  load();
  refreshTimer = setInterval(load, 15_000);

  cleanups.push(on($('#mod-grid'), 'click', '[data-action]', (_e, el) => {
    const action = el.dataset.action;
    const id = el.dataset.id;
    if (action && id) handleAction(action, id);
  }));
}

function destroy() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  cleanups.splice(0).forEach(fn => fn());
}

export default { html, init, destroy };
