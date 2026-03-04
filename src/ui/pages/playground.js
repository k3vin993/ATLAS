import { api }              from '../lib/api.js';
import { $, syntaxHighlight } from '../lib/utils.js';

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Tools</div>
    <div class="page-title">Query Playground</div>
    <div class="page-sub">Test MCP tools directly</div>
  </div>
  <div class="playground">
    <div class="pane">
      <div class="pane-header">&#x1F6E0; Tool</div>
      <div class="pane-body">
        <div class="field">
          <label>Tool</label>
          <select id="tool-select">
            <option value="query">query</option>
            <option value="get_shipment">get_shipment</option>
            <option value="search_carriers">search_carriers</option>
            <option value="get_rate_history">get_rate_history</option>
            <option value="list_documents">list_documents</option>
          </select>
        </div>
        <div id="tool-fields"></div>
        <button class="btn btn-primary" id="run-btn">&#x25B7; Run</button>
      </div>
    </div>
    <div class="pane">
      <div class="pane-header">&#x1F4E4; Result</div>
      <div class="pane-body" id="result-pane">
        <div class="result-empty">Run a tool to see results</div>
      </div>
    </div>
  </div>
</div>`;

const TOOL_FIELDS = {
  query: [
    { name: 'question', label: 'Question', type: 'text', placeholder: 'best carrier for Warsaw \u2192 Hamburg' },
    { name: 'mode', label: 'Mode (optional)', type: 'select', options: ['','road','ocean','air','rail','multimodal'] },
    { name: 'limit', label: 'Limit', type: 'text', placeholder: '10' },
  ],
  get_shipment: [
    { name: 'id', label: 'Shipment ID', type: 'text', placeholder: 'shp-001' },
  ],
  search_carriers: [
    { name: 'country', label: 'Country (ISO)', type: 'text', placeholder: 'DE' },
    { name: 'type', label: 'Type', type: 'select', options: ['','trucking','shipping_line','airline','rail','broker'] },
    { name: 'min_rating', label: 'Min rating', type: 'text', placeholder: '4.0' },
  ],
  get_rate_history: [
    { name: 'origin', label: 'Origin (ISO)', type: 'text', placeholder: 'PL' },
    { name: 'destination', label: 'Destination (ISO)', type: 'text', placeholder: 'DE' },
    { name: 'mode', label: 'Mode', type: 'select', options: ['','road','ocean','air','rail','multimodal'] },
    { name: 'days', label: 'Days back', type: 'text', placeholder: '90' },
  ],
  list_documents: [
    { name: 'shipment_id', label: 'Shipment ID', type: 'text', placeholder: 'shp-001' },
    { name: 'type', label: 'Type', type: 'select', options: ['','bol','cmr','awb','invoice','customs_export','customs_import','pod','packing_list'] },
  ],
};

const cleanups = [];

function renderFields() {
  const tool = $('#tool-select').value;
  const fields = TOOL_FIELDS[tool] || [];
  $('#tool-fields').innerHTML = fields.map(f => `
    <div class="field">
      <label>${f.label}</label>
      ${f.type === 'select'
        ? `<select id="field-${f.name}">${f.options.map(o => `<option>${o}</option>`).join('')}</select>`
        : `<input type="text" id="field-${f.name}" placeholder="${f.placeholder || ''}" />`}
    </div>
  `).join('');
}

async function run() {
  const tool = $('#tool-select').value;
  const fields = TOOL_FIELDS[tool] || [];
  const params = {};
  for (const f of fields) {
    const el = $(`#field-${f.name}`);
    if (el?.value) params[f.name] = el.value;
  }
  if (params.limit)      params.limit = parseInt(params.limit);
  if (params.min_rating) params.min_rating = parseFloat(params.min_rating);
  if (params.days)       params.days = parseInt(params.days);

  const btn  = $('#run-btn');
  const pane = $('#result-pane');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running\u2026';
  pane.innerHTML = '<div class="result-empty">Running\u2026</div>';

  try {
    const d = await api.post('/api/query', { tool, params });
    pane.innerHTML = `<div class="json-output">${syntaxHighlight(JSON.stringify(d.result ?? d, null, 2))}</div>`;
  } catch (e) {
    pane.innerHTML = `<div style="color:var(--red)">Error: ${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '\u25B7 Run';
  }
}

function init() {
  renderFields();

  const sel = $('#tool-select');
  sel.addEventListener('change', renderFields);
  cleanups.push(() => sel.removeEventListener('change', renderFields));

  const btn = $('#run-btn');
  btn.addEventListener('click', run);
  cleanups.push(() => btn.removeEventListener('click', run));
}

function destroy() {
  cleanups.splice(0).forEach(fn => fn());
}

export default { html, init, destroy };
