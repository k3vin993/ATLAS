import { api } from '../lib/api.js';
import { $, $$, esc } from '../lib/utils.js';

const html = `
<div class="page active">
  <div class="page-header">
    <div class="page-label">Knowledge Base</div>
    <div class="page-title">Knowledge</div>
    <div class="page-sub">Persistent memory files the AI can read and write.</div>
  </div>
  <div class="kb-container">
    <div class="kb-sidebar">
      <div class="kb-sidebar-header">
        <button class="btn btn-sm btn-secondary" id="kb-new-file">+ File</button>
        <button class="btn btn-sm btn-secondary" id="kb-new-folder">+ Folder</button>
      </div>
      <div class="kb-tree" id="kbTree"></div>
    </div>
    <div class="kb-editor" id="kbEditor">
      <div class="kb-empty">Select a file or create a new one</div>
    </div>
  </div>
</div>`;

let tree = [];
let currentFile = null;
let editMode = true;
let cachedContent = '';

// ── Toolbar format actions ────────────────────────────────────────────────────

const TOOLBAR = [
  { key: 'h1',     label: 'H1',   title: 'Heading 1',     prefix: '# ',      suffix: '',     block: true },
  { key: 'h2',     label: 'H2',   title: 'Heading 2',     prefix: '## ',     suffix: '',     block: true },
  { key: 'h3',     label: 'H3',   title: 'Heading 3',     prefix: '### ',    suffix: '',     block: true },
  { key: 'sep1' },
  { key: 'bold',   label: 'B',    title: 'Bold (Ctrl+B)',          prefix: '**',      suffix: '**',   style: 'font-weight:700' },
  { key: 'italic', label: 'I',    title: 'Italic (Ctrl+I)',        prefix: '_',       suffix: '_',    style: 'font-style:italic' },
  { key: 'code',   label: '<>',  title: 'Inline code',    prefix: '`',       suffix: '`',    style: 'font-family:var(--mono);font-size:0.8em' },
  { key: 'sep2' },
  { key: 'ul',     label: '&#8226; List', title: 'Bullet list',  prefix: '- ',      suffix: '',     block: true },
  { key: 'ol',     label: '1. List', title: 'Numbered list', prefix: '1. ',     suffix: '',     block: true },
  { key: 'quote',  label: '&#10077;',  title: 'Blockquote',    prefix: '> ',      suffix: '',     block: true },
  { key: 'sep3' },
  { key: 'link',   label: '&#128279;',  title: 'Link',           prefix: '[',       suffix: '](url)' },
  { key: 'hr',     label: '&#8213;',   title: 'Horizontal rule', prefix: '\n---\n', suffix: '',     block: true },
];

function buildToolbarHtml() {
  return TOOLBAR.map(t => {
    if (t.key.startsWith('sep')) return '<span class="kb-toolbar-sep"></span>';
    return `<button class="kb-toolbar-btn" data-fmt="${t.key}" title="${t.title}"${t.style ? ` style="${t.style}"` : ''}>${t.label}</button>`;
  }).join('');
}

function applyFormat(ta, fmt) {
  if (!ta) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(end);

  if (fmt.block && !selected) {
    // For block items with no selection, insert at line start
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineBefore = ta.value.substring(0, lineStart);
    const lineAfter = ta.value.substring(lineStart);
    ta.value = lineBefore + fmt.prefix + lineAfter;
    ta.selectionStart = ta.selectionEnd = lineStart + fmt.prefix.length;
  } else {
    const replacement = fmt.prefix + (selected || 'text') + fmt.suffix;
    ta.value = before + replacement + after;
    // Select the inner text
    const innerStart = start + fmt.prefix.length;
    const innerEnd = innerStart + (selected || 'text').length;
    ta.selectionStart = innerStart;
    ta.selectionEnd = innerEnd;
  }
  ta.focus();
}

function renderTree(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'dir') {
      out += `<div class="kb-tree-item" data-dir="${esc(n.path)}">
        <span class="kb-tree-toggle open">&#9654;</span>
        <span class="icon">&#128193;</span>
        <span class="name">${esc(n.name)}</span>
      </div>
      <div class="kb-tree-children" data-dir-children="${esc(n.path)}">
        ${n.children ? renderTree(n.children) : ''}
      </div>`;
    } else {
      out += `<div class="kb-tree-item${currentFile === n.path ? ' active' : ''}" data-file="${esc(n.path)}">
        <span style="width:1rem"></span>
        <span class="icon">&#128196;</span>
        <span class="name">${esc(n.name)}</span>
      </div>`;
    }
  }
  return out;
}

// ── Markdown rendering (marked + highlight.js) ───────────────────────────────

function initMarked() {
  if (typeof marked === 'undefined') return false;
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight(code, lang) {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      if (typeof hljs !== 'undefined') {
        return hljs.highlightAuto(code).value;
      }
      return code;
    },
  });
  return true;
}

function renderMarkdownPreview(text) {
  if (typeof marked !== 'undefined') {
    return marked.parse(text);
  }
  // Fallback if CDN didn't load
  return esc(text)
    .replace(/```[\s\S]*?```/g, m => '<pre><code>' + m.slice(3, -3).replace(/^[^\n]*\n/, '') + '</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function refreshTree() {
  const el = $('#kbTree');
  if (!el) return;
  el.innerHTML = tree.length
    ? renderTree(tree)
    : '<div class="kb-empty" style="padding:2rem">No files yet</div>';
  bindTreeEvents();
}

function refreshEditor() {
  const el = $('#kbEditor');
  if (!el) return;
  if (!currentFile) {
    el.innerHTML = '<div class="kb-empty">Select a file or create a new one</div>';
    return;
  }
  el.innerHTML = `
    <div class="kb-editor-header">
      <span class="kb-editor-path">${esc(currentFile)}</span>
      <button class="btn btn-sm btn-secondary" id="kb-toggle">${editMode ? 'Preview' : 'Edit'}</button>
      <button class="btn btn-sm btn-primary" id="kb-save">Save</button>
      <button class="btn btn-sm btn-secondary" id="kb-delete" style="color:var(--red)">Delete</button>
    </div>
    ${editMode
      ? `<div class="kb-toolbar">${buildToolbarHtml()}</div>
         <textarea class="kb-textarea" spellcheck="false"></textarea>`
      : '<div class="kb-preview"></div>'}`;

  if (editMode) {
    const ta = $('.kb-textarea');
    if (ta) {
      ta.value = cachedContent;
      ta.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
          e.preventDefault();
          applyFormat(ta, TOOLBAR.find(t => t.key === 'bold'));
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
          e.preventDefault();
          applyFormat(ta, TOOLBAR.find(t => t.key === 'italic'));
        }
      });
    }
    // Toolbar button clicks
    for (const btn of $$('.kb-toolbar-btn')) {
      btn.addEventListener('click', () => {
        const fmt = TOOLBAR.find(t => t.key === btn.dataset.fmt);
        if (fmt) applyFormat($('.kb-textarea'), fmt);
      });
    }
  } else {
    const preview = $('.kb-preview');
    if (preview) {
      preview.innerHTML = renderMarkdownPreview(cachedContent);
      // Apply highlight.js to any code blocks marked didn't auto-highlight
      if (typeof hljs !== 'undefined') {
        preview.querySelectorAll('pre code:not(.hljs)').forEach(el => hljs.highlightElement(el));
      }
    }
  }

  $('#kb-toggle')?.addEventListener('click', () => {
    const ta = $('.kb-textarea');
    if (ta) cachedContent = ta.value;
    editMode = !editMode;
    refreshEditor();
  });
  $('#kb-save')?.addEventListener('click', saveFile);
  $('#kb-delete')?.addEventListener('click', deleteFile);
}

function bindTreeEvents() {
  for (const el of $$('[data-file]', $('#kbTree') ?? document)) {
    el.addEventListener('click', () => openFile(el.dataset.file));
  }
  for (const el of $$('[data-dir]', $('#kbTree') ?? document)) {
    el.addEventListener('click', () => {
      const children = $(`[data-dir-children="${el.dataset.dir}"]`);
      const toggle = el.querySelector('.kb-tree-toggle');
      if (children) children.style.display = children.style.display === 'none' ? '' : 'none';
      if (toggle) toggle.classList.toggle('open');
    });
  }
}

async function loadTree() {
  try {
    const data = await api.get('/api/kb/tree');
    tree = data.tree;
  } catch {
    tree = [];
  }
  refreshTree();
}

async function openFile(path) {
  try {
    const data = await api.get(`/api/kb/file?path=${encodeURIComponent(path)}`);
    currentFile = path;
    cachedContent = data.content;
    editMode = true;
    refreshTree();
    refreshEditor();
  } catch (e) {
    alert('Error loading file: ' + e.message);
  }
}

async function saveFile() {
  if (!currentFile) return;
  const ta = $('.kb-textarea');
  if (ta) cachedContent = ta.value;
  try {
    await api.post('/api/kb/file', { path: currentFile, content: cachedContent });
  } catch (e) {
    alert('Error saving: ' + e.message);
  }
}

async function deleteFile() {
  if (!currentFile) return;
  if (!confirm(`Delete ${currentFile}?`)) return;
  try {
    await api.del(`/api/kb/file?path=${encodeURIComponent(currentFile)}`);
    currentFile = null;
    cachedContent = '';
    refreshEditor();
    await loadTree();
  } catch (e) {
    alert('Error deleting: ' + e.message);
  }
}

async function createFile() {
  const name = prompt('File name (e.g. notes/meeting):');
  if (!name) return;
  try {
    await api.post('/api/kb/file', { path: name, content: `# ${name.split('/').pop()}\n\n` });
    await loadTree();
    const p = name.endsWith('.md') ? name : name + '.md';
    openFile(p);
  } catch (e) {
    alert('Error creating file: ' + e.message);
  }
}

async function createFolder() {
  const name = prompt('Folder path (e.g. logistics/carriers):');
  if (!name) return;
  try {
    await api.post('/api/kb/folder', { path: name });
    await loadTree();
  } catch (e) {
    alert('Error creating folder: ' + e.message);
  }
}

export default {
  html,
  init() {
    currentFile = null;
    cachedContent = '';
    editMode = true;
    initMarked();
    $('#kb-new-file')?.addEventListener('click', createFile);
    $('#kb-new-folder')?.addEventListener('click', createFolder);
    loadTree();
  },
  destroy() {
    currentFile = null;
    tree = [];
    cachedContent = '';
  },
};
