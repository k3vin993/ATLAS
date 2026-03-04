/** Shorthand DOM helpers. */
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/** Escape HTML entities — use before injecting user-supplied text into innerHTML. */
export function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** JSON syntax highlighting for <pre> output. Input must be a JSON string. */
export function syntaxHighlight(json) {
  return esc(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    m => {
      if (/^"/.test(m)) return /:$/.test(m)
        ? `<span class="json-key">${m}</span>`
        : `<span class="json-str">${m}</span>`;
      if (/true|false/.test(m)) return `<span class="json-bool">${m}</span>`;
      if (/null/.test(m))       return `<span class="json-null">${m}</span>`;
      return `<span class="json-num">${m}</span>`;
    },
  );
}

/** Minimal Markdown → HTML (code blocks, inline code, bold, lists, line breaks). */
export function renderMarkdown(text) {
  return esc(text)
    .replace(/```[\s\S]*?```/g, m => {
      const inner = m.slice(3, -3).replace(/^[^\n]*\n/, '');
      return '<pre><code>' + inner + '</code></pre>';
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => '<ul>' + m + '</ul>')
    .replace(/\n/g, '<br>');
}

/**
 * Delegate event: listen on `container` for `selector` matches.
 * Returns a cleanup function.
 */
export function on(container, event, selector, handler) {
  const listener = e => {
    const target = e.target.closest(selector);
    if (target && container.contains(target)) handler(e, target);
  };
  container.addEventListener(event, listener);
  return () => container.removeEventListener(event, listener);
}
