import { Router }  from './lib/router.js';
import { $, on }   from './lib/utils.js';

import dashboard   from './pages/dashboard.js';
import connectors  from './pages/connectors.js';
import explorer    from './pages/explorer.js';
import playground  from './pages/playground.js';
import chat        from './pages/chat.js';
import importPage  from './pages/import.js';

const router = new Router($('#page-content'));

router
  .add('dashboard',   dashboard)
  .add('connectors',  connectors)
  .add('explorer',    explorer)
  .add('playground',  playground)
  .add('chat',        chat)
  .add('import',      importPage);

// Nav clicks — event delegation, no inline handlers
on($('.nav'), 'click', '[data-page]', (_e, item) => {
  router.navigate(item.dataset.page);
});

// When import/seed loads data, the next visit to dashboard picks it up automatically
// (dashboard.init() always fetches fresh). No cross-page coupling needed.

router.start('dashboard');
