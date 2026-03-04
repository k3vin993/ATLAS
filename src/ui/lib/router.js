/**
 * Hash-based router with page lifecycle (init / destroy).
 *
 * Usage:
 *   const router = new Router(containerEl);
 *   router.add('dashboard', dashboardPage);
 *   router.start();                         // reads hash, activates page
 *   router.navigate('chat');                // programmatic nav
 */
export class Router {
  #pages   = new Map();
  #current = null;       // { name, page }
  #container;

  constructor(container) {
    this.#container = container;
    window.addEventListener('popstate', () => this.#sync());
  }

  /** Register a page object { html, init(), destroy?() }. */
  add(name, page) {
    this.#pages.set(name, page);
    return this;          // chainable
  }

  /** Navigate to a page. Pushes history entry for back-button support. */
  navigate(name) {
    if (this.#current?.name === name) return;
    history.pushState(null, '', '#' + name);
    this.#activate(name);
  }

  /** Read hash and activate. Called on popstate and on initial load. */
  #sync() {
    const name = location.hash.slice(1) || 'dashboard';
    if (this.#pages.has(name)) this.#activate(name);
  }

  /** Core: tear down old page, inject new HTML, init new page. */
  #activate(name) {
    const page = this.#pages.get(name);
    if (!page) return;

    // Lifecycle: destroy previous page
    if (this.#current?.page.destroy) this.#current.page.destroy();

    this.#current = { name, page };
    this.#container.innerHTML = page.html;
    page.init();

    // Update nav highlighting
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === name);
    });
  }

  /** Kick off: read current hash and render. */
  start(fallback = 'dashboard') {
    const name = location.hash.slice(1) || fallback;
    this.#activate(this.#pages.has(name) ? name : fallback);
  }

  /** Current page name (for conditional logic, e.g. auto-refresh). */
  get current() { return this.#current?.name ?? null; }
}
