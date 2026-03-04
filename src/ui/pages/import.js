import { api }       from '../lib/api.js';
import { $, $$, on } from '../lib/utils.js';

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Ingest</div>
    <div class="page-title">Import Data</div>
    <div class="page-sub">Drop any file and AI extracts structured logistics entities automatically</div>
  </div>

  <div class="tabs" style="max-width:600px" id="import-tabs">
    <div class="tab active" data-tab="upload">AI Extract</div>
    <div class="tab" data-tab="seed">Seed Examples</div>
    <div class="tab" data-tab="folder">Folder Path</div>
  </div>

  <!-- AI Upload tab -->
  <div id="import-panel-upload">
    <div class="drop-zone" id="dropZone">
      <div class="drop-zone-icon">&#x2728;</div>
      <div class="drop-zone-text">Drop any file &mdash; AI will extract logistics data</div>
      <div class="drop-zone-hint">PDF &middot; Excel &middot; CSV &middot; JSON &middot; Email &middot; Plain text &middot; Markdown &middot; Any document</div>
      <input type="file" id="fileInput" style="display:none" multiple />
    </div>
    <div id="uploadPreview" style="display:none" class="import-preview">
      <div class="import-preview-header">
        <span class="import-preview-title" id="previewTitle">File preview</span>
        <span class="import-preview-meta" id="previewMeta"></span>
      </div>
      <div class="import-preview-body" id="previewBody"></div>
    </div>
    <button class="btn btn-primary" id="importBtn" disabled style="margin-top:1.25rem">
      &#x2728; Extract with AI
    </button>
    <div id="importLog" class="import-log" style="display:none"></div>
  </div>

  <!-- Seed Examples tab -->
  <div id="import-panel-seed" style="display:none">
    <p style="color:var(--body);font-size:0.9rem;margin-bottom:1.25rem;line-height:1.5">
      Load realistic logistics demo data into ATLAS. Useful for testing and demos.
    </p>
    <div class="seed-examples" id="seed-grid">
      <div class="seed-card" data-seed="shipments">
        <div class="seed-card-icon">&#x1F4E6;</div>
        <div class="seed-card-name">Shipments</div>
        <div class="seed-card-desc">3 shipments: in_transit, delivered, exception</div>
      </div>
      <div class="seed-card" data-seed="carriers">
        <div class="seed-card-icon">&#x1F69A;</div>
        <div class="seed-card-name">Carriers</div>
        <div class="seed-card-desc">3 carriers: road FTL, reefer, ocean FCL</div>
      </div>
      <div class="seed-card" data-seed="rates">
        <div class="seed-card-icon">&#x1F4B0;</div>
        <div class="seed-card-name">Rates</div>
        <div class="seed-card-desc">7 rate entries across lanes</div>
      </div>
      <div class="seed-card" data-seed="lanes">
        <div class="seed-card-icon">&#x1F5FA;&#xFE0F;</div>
        <div class="seed-card-name">Lanes</div>
        <div class="seed-card-desc">PL-DE, UA-PL, DE-NL with transit times</div>
      </div>
      <div class="seed-card" data-seed="parties">
        <div class="seed-card-icon">&#x1F3E2;</div>
        <div class="seed-card-name">Parties</div>
        <div class="seed-card-desc">Shipper &times; 2, 3PL/broker</div>
      </div>
      <div class="seed-card" data-seed="tracking_events">
        <div class="seed-card-icon">&#x1F4CD;</div>
        <div class="seed-card-name">Tracking Events</div>
        <div class="seed-card-desc">GPS events + 1 exception</div>
      </div>
      <div class="seed-card" data-seed="service_levels">
        <div class="seed-card-icon">&#x23F1;&#xFE0F;</div>
        <div class="seed-card-name">Service Levels</div>
        <div class="seed-card-desc">2 SLA profiles (standard + GDP)</div>
      </div>
      <div class="seed-card" data-seed="documents">
        <div class="seed-card-icon">&#x1F4C4;</div>
        <div class="seed-card-name">Documents</div>
        <div class="seed-card-desc">CMR, POD, invoice examples</div>
      </div>
      <div class="seed-card" data-seed="all">
        <div class="seed-card-icon" style="color:var(--accent)">&#x2B21;</div>
        <div class="seed-card-name" style="color:var(--accent)">Load All</div>
        <div class="seed-card-desc">34 records across all entities</div>
      </div>
    </div>
    <div id="seedLog" class="import-log" style="display:none;margin-top:1rem"></div>
  </div>

  <!-- Folder Path tab -->
  <div id="import-panel-folder" style="display:none">
    <p style="color:var(--body);font-size:0.9rem;margin-bottom:1.25rem;line-height:1.5">
      Load all files from a folder on the server filesystem.
    </p>
    <div style="display:flex;gap:0.75rem;align-items:center">
      <input id="folderPath" type="text" value="./seed"
             class="search-input" style="font-family:var(--mono);font-size:0.85rem"
             placeholder="./seed or /absolute/path">
      <button class="btn btn-primary" id="folderImportBtn">Run Import</button>
    </div>
    <p style="color:var(--muted);font-size:0.78rem;margin-top:0.5rem">
      Supports JSON, CSV, XLSX, and Markdown (.md) files. Subfolders are walked recursively.
    </p>
    <div id="folderLog" class="import-log" style="display:none;margin-top:1rem"></div>
  </div>
</div>`;

// --- state ---
let files = [];
const cleanups = [];

function switchTab(tab) {
  for (const t of ['upload', 'seed', 'folder']) {
    $(`#import-panel-${t}`).style.display = t === tab ? '' : 'none';
  }
  $$('#import-tabs .tab').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab),
  );
}

function handleFiles(fileList) {
  files = Array.from(fileList);
  if (!files.length) return;
  const f = files[0];
  $('#previewTitle').textContent = f.name;
  $('#previewMeta').textContent = `${(f.size / 1024).toFixed(1)} KB \u00B7 ${files.length} file(s)`;
  $('#uploadPreview').style.display = '';
  $('#importBtn').disabled = false;
  const reader = new FileReader();
  reader.onload = e => {
    let text = e.target.result;
    if (text.length > 2000) text = text.slice(0, 2000) + '\u2026';
    $('#previewBody').textContent = text;
  };
  reader.readAsText(f);
}

async function doAiImport() {
  const log = $('#importLog');
  const btn = $('#importBtn');
  log.style.display = '';
  log.innerHTML = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Extracting\u2026';
  let totalRecords = 0;

  for (const file of files) {
    log.innerHTML += `<div style="color:var(--muted)">\u2728 Analyzing ${file.name}\u2026</div>`;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const data = await api.postForm('/api/import/ai', formData);
      if (data.skipped) {
        log.innerHTML += `<div style="color:var(--muted)">\u2014 ${file.name}: skipped (already processed)</div>`;
      } else if (data.ok) {
        const entities = (data.extracted || []).map(e => `${e.entity_type} \u00D7${e.count}`).join(', ');
        const tokens = data.usage ? ` \u00B7 ${data.usage.input_tokens + data.usage.output_tokens} tokens` : '';
        log.innerHTML += `<div class="ok">\u2713 ${file.name} \u2192 ${data.records} records (${entities})${tokens}</div>`;
        totalRecords += data.records;
      } else {
        log.innerHTML += `<div class="err">\u2717 ${file.name}: ${data.error}</div>`;
      }
    } catch (e) {
      log.innerHTML += `<div class="err">\u2717 ${file.name}: ${e.message}</div>`;
    }
  }
  btn.disabled = false;
  btn.innerHTML = '\u2728 Extract with AI';
  if (totalRecords > 0) {
    log.innerHTML += `<div class="ok" style="margin-top:0.5rem;font-weight:600">\u2713 Total: ${totalRecords} records extracted and stored</div>`;
    document.dispatchEvent(new CustomEvent('atlas:data-changed'));
  }
}

async function loadSeed(entity) {
  const log = $('#seedLog');
  log.style.display = '';

  if (entity === 'all') {
    log.innerHTML = '<div style="color:var(--muted)">Loading all seed data\u2026</div>';
    try {
      const data = await api.post('/api/import/seed', { entity: 'all' });
      if (data.ok) log.innerHTML += `<div class="ok">\u2713 Loaded ${data.imported} records across ${data.entities} entities</div>`;
      else log.innerHTML += `<div class="err">\u2717 ${data.error}</div>`;
    } catch (e) { log.innerHTML += `<div class="err">\u2717 ${e.message}</div>`; }
  } else {
    log.innerHTML += `<div style="color:var(--muted)">Loading ${entity}\u2026</div>`;
    try {
      const data = await api.post('/api/import/seed', { entity });
      if (data.ok) log.innerHTML += `<div class="ok">\u2713 ${entity}: ${data.imported} records loaded</div>`;
      else log.innerHTML += `<div class="err">\u2717 ${entity}: ${data.error}</div>`;
    } catch (e) { log.innerHTML += `<div class="err">\u2717 ${entity}: ${e.message}</div>`; }
  }
  document.dispatchEvent(new CustomEvent('atlas:data-changed'));
}

async function doFolderImport() {
  const path = $('#folderPath').value.trim();
  const log = $('#folderLog');
  log.style.display = '';
  log.innerHTML = `<div style="color:var(--muted)">Scanning ${path}\u2026</div>`;
  try {
    const data = await api.post('/api/import/folder', { path });
    if (data.ok) {
      data.results.forEach(r => {
        log.innerHTML += r.ok
          ? `<div class="ok">\u2713 ${r.file} \u2192 ${r.entity}: ${r.imported} records</div>`
          : `<div class="err">\u2717 ${r.file}: ${r.error}</div>`;
      });
      log.innerHTML += `<div class="ok" style="margin-top:0.5rem;font-weight:600">\u2713 Total: ${data.total} records from ${data.results.length} files</div>`;
      document.dispatchEvent(new CustomEvent('atlas:data-changed'));
    } else {
      log.innerHTML += `<div class="err">\u2717 ${data.error}</div>`;
    }
  } catch (e) {
    log.innerHTML += `<div class="err">\u2717 ${e.message}</div>`;
  }
}

function init() {
  // Tab switching
  cleanups.push(on($('#import-tabs'), 'click', '[data-tab]', (_e, tab) => {
    switchTab(tab.dataset.tab);
  }));

  // Drop zone
  const zone = $('#dropZone');
  const onDragover  = e => { e.preventDefault(); zone.classList.add('dragover'); };
  const onDragleave = () => zone.classList.remove('dragover');
  const onDrop = e => { e.preventDefault(); zone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };
  const onClick = () => $('#fileInput').click();
  zone.addEventListener('dragover', onDragover);
  zone.addEventListener('dragleave', onDragleave);
  zone.addEventListener('drop', onDrop);
  zone.addEventListener('click', onClick);
  cleanups.push(
    () => zone.removeEventListener('dragover', onDragover),
    () => zone.removeEventListener('dragleave', onDragleave),
    () => zone.removeEventListener('drop', onDrop),
    () => zone.removeEventListener('click', onClick),
  );

  // File input change
  const fileInput = $('#fileInput');
  const onFileChange = () => handleFiles(fileInput.files);
  fileInput.addEventListener('change', onFileChange);
  cleanups.push(() => fileInput.removeEventListener('change', onFileChange));

  // Import button
  const importBtn = $('#importBtn');
  importBtn.addEventListener('click', doAiImport);
  cleanups.push(() => importBtn.removeEventListener('click', doAiImport));

  // Seed cards (event delegation)
  cleanups.push(on($('#seed-grid'), 'click', '[data-seed]', (_e, card) => {
    loadSeed(card.dataset.seed);
  }));

  // Folder import button
  const folderBtn = $('#folderImportBtn');
  folderBtn.addEventListener('click', doFolderImport);
  cleanups.push(() => folderBtn.removeEventListener('click', doFolderImport));
}

function destroy() {
  cleanups.splice(0).forEach(fn => fn());
}

export default { html, init, destroy };
