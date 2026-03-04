import { api }       from '../lib/api.js';
import { $, $$, on } from '../lib/utils.js';

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Data</div>
    <div class="page-title">Explorer</div>
    <div class="page-sub">Browse indexed logistics data</div>
  </div>
  <div class="tabs" id="explorer-tabs">
    <div class="tab" data-table="shipments">Shipments</div>
    <div class="tab" data-table="carriers">Carriers</div>
    <div class="tab" data-table="rates">Rates</div>
    <div class="tab" data-table="documents">Documents</div>
    <div class="tab" data-table="routes">Routes</div>
    <div class="tab" data-table="events">Events</div>
  </div>
  <div class="search-bar">
    <input class="search-input" id="explorer-search" placeholder="Search&hellip;" />
    <button class="btn btn-primary btn-sm" id="explorer-refresh">Refresh</button>
  </div>
  <div class="glass" style="padding:0;overflow:hidden;">
    <div id="explorer-table-wrap"><div class="empty-state">Loading&hellip;</div></div>
  </div>
</div>`;

// --- state (survives navigation because ES modules are singletons) ---
let activeTable = 'shipments';
let debounceTimer = null;
const cleanups = [];

const TABLE_COLS = {
  shipments: ['id','reference','mode','status','origin','destination','carrier'],
  carriers:  ['id','name','type','country','rating'],
  rates:     ['id','carrier_id','origin_country','destination_country','mode','rate_type','base_rate','currency'],
  documents: ['id','type','shipment_id','number'],
  routes:    ['id','mode','origin','destination'],
  events:    ['id','shipment_id','type','timestamp'],
};

function cellValue(row, col) {
  const v = row[col];
  if (v == null) return '\u2014';
  if (typeof v === 'object') {
    if (v.city && v.country) return `${v.city}, ${v.country}`;
    return v.name ?? v.id ?? JSON.stringify(v).slice(0, 40) + '\u2026';
  }
  return String(v);
}

async function load() {
  const wrap = $('#explorer-table-wrap');
  if (!wrap) return;
  const search = $('#explorer-search')?.value ?? '';
  wrap.innerHTML = '<div class="empty-state">Loading\u2026</div>';
  try {
    const q = search ? `&search=${encodeURIComponent(search)}` : '';
    const d = await api.get(`/api/data/${activeTable}?limit=100${q}`);
    if (!d.rows?.length) { wrap.innerHTML = '<div class="empty-state">No records found</div>'; return; }
    const cols = TABLE_COLS[activeTable] || Object.keys(d.rows[0]).slice(0, 6);
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${d.rows.map(row => `
          <tr>${cols.map((c, i) => `
            <td class="${i === 0 ? 'id-cell' : ''}">
              ${c === 'mode' && row[c] ? `<span class="mode-badge">${row[c]}</span>` : cellValue(row, c)}
            </td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="padding:0.7rem 1rem;border-top:1px solid var(--border);color:var(--muted);font-size:0.75rem;font-family:var(--mono);">
        ${d.total} record${d.total !== 1 ? 's' : ''}
      </div>`;
  } catch (e) {
    wrap.innerHTML = `<div class="empty-state" style="color:var(--red)">Error: ${e.message}</div>`;
  }
}

function syncTabs() {
  $$('#explorer-tabs .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.table === activeTable),
  );
}

function init() {
  syncTabs();

  // Tab clicks (event delegation)
  cleanups.push(on($('#explorer-tabs'), 'click', '[data-table]', (_e, tab) => {
    activeTable = tab.dataset.table;
    syncTabs();
    load();
  }));

  // Search debounce
  const searchEl = $('#explorer-search');
  const onInput = () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(load, 300); };
  searchEl.addEventListener('input', onInput);
  cleanups.push(() => searchEl.removeEventListener('input', onInput));

  // Refresh button
  const btn = $('#explorer-refresh');
  btn.addEventListener('click', load);
  cleanups.push(() => btn.removeEventListener('click', load));

  load();
}

function destroy() {
  clearTimeout(debounceTimer);
  cleanups.splice(0).forEach(fn => fn());
}

export default { html, init, destroy };
