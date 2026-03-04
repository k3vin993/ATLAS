import { api } from '../lib/api.js';
import { $ }   from '../lib/utils.js';

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Overview</div>
    <div class="page-title">Dashboard</div>
    <div class="page-sub">System health and indexed data overview</div>
  </div>
  <div class="status-card">
    <span class="status-badge running"><span class="dot"></span> Running</span>
    <span id="uptime-label" style="color:var(--muted);font-size:0.78rem;font-family:var(--mono);">loading&hellip;</span>
    <span class="status-uptime" id="last-refresh">&mdash;</span>
  </div>
  <div class="grid-4" id="counts-grid">
    <div class="glass"><div class="card-label">Shipments</div><div class="card-value" id="cnt-shipments">&mdash;</div></div>
    <div class="glass"><div class="card-label">Carriers</div><div class="card-value" id="cnt-carriers">&mdash;</div></div>
    <div class="glass"><div class="card-label">Documents</div><div class="card-value" id="cnt-documents">&mdash;</div></div>
    <div class="glass"><div class="card-label">Rates</div><div class="card-value" id="cnt-rates">&mdash;</div></div>
  </div>
  <div class="grid-2">
    <div class="glass"><div class="card-label">Routes</div><div class="card-value" id="cnt-routes">&mdash;</div><div class="card-sub">Indexed lanes</div></div>
    <div class="glass"><div class="card-label">Events</div><div class="card-value" id="cnt-events">&mdash;</div><div class="card-sub">Tracking events</div></div>
  </div>
</div>`;

let timer = null;

async function load() {
  try {
    const d = await api.get('/api/status');
    const c = d.counts || {};
    for (const k of ['shipments','carriers','documents','rates','routes','events']) {
      const el = $(`#cnt-${k}`);
      if (el) el.textContent = (c[k]?.count ?? 0).toLocaleString();
    }
    const u = d.uptime ?? 0;
    const h = Math.floor(u / 3600), m = Math.floor((u % 3600) / 60), s = u % 60;
    const up = $('#uptime-label');
    if (up) up.textContent = `Uptime: ${h}h ${m}m ${s}s`;
    const ref = $('#last-refresh');
    if (ref) ref.textContent = 'Refreshed ' + new Date().toLocaleTimeString();
  } catch {
    const up = $('#uptime-label');
    if (up) up.textContent = 'Connection error';
  }
}

function init() {
  load();
  timer = setInterval(load, 30_000);
}

function destroy() {
  clearInterval(timer);
  timer = null;
}

export default { html, init, destroy };
