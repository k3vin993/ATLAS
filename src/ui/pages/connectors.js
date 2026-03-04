import { api }  from '../lib/api.js';
import { $ }    from '../lib/utils.js';

const ICONS = {
  email: '\u{1F4E7}', filesystem: '\u{1F4C1}', api: '\u{1F50C}',
  sap: '\u{1F3ED}', oracle: '\u{1F5C4}', transporeon: '\u{1F69B}',
};

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Data Sources</div>
    <div class="page-title">Connectors</div>
    <div class="page-sub">Data sources connected to this ATLAS instance</div>
  </div>
  <div id="connectors-list">
    <div style="color:var(--muted);padding:2rem 0;">Loading connectors&hellip;</div>
  </div>
</div>`;

async function load() {
  const list = $('#connectors-list');
  try {
    const d = await api.get('/api/connectors');
    if (!d.connectors?.length) {
      list.innerHTML = '<div style="color:var(--muted);padding:1rem 0">No connectors configured. Edit config.yml to add connectors.</div>';
      return;
    }
    list.innerHTML = d.connectors.map(c => `
      <div class="connector-row">
        <div class="connector-icon">${ICONS[c.name] || '\u2699\uFE0F'}</div>
        <div>
          <div class="connector-name">${c.name}</div>
          <div class="connector-type">${c.type}</div>
        </div>
        <div class="connector-meta">
          <span class="tag ${c.enabled ? 'tag-green' : 'tag-gray'}">${c.enabled ? 'Active' : 'Disabled'}</span>
          <label class="toggle">
            <input type="checkbox" ${c.enabled ? 'checked' : ''} disabled>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<div style="color:var(--red)">Failed to load connectors: ${e.message}</div>`;
  }
}

export default { html, init: load };
