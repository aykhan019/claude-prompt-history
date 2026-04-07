(function () {
  'use strict';
  if (document.getElementById('cph-root')) return;

  let turns = [];
  let sidebarOpen = false;
  let nextId = 0;
  let _navWasOpen = true;
  let _suppressNextDocClick = false;

  /* ══════════════════════════════════════
     CLAUDE'S NAV SIDEBAR HELPERS
     ══════════════════════════════════════ */
  function getSidebarToggleBtn() {
    return document.querySelector('[data-testid="pin-sidebar-toggle"]');
  }
  function isSidebarOpen() {
    return getSidebarToggleBtn()?.getAttribute('aria-label') === 'Close sidebar';
  }

  /* ══════════════════════════════════════
     INJECT ICON BUTTON
     Placed in the toolbar next to Share,
     using Claude's own ghost-button classes.
     ══════════════════════════════════════ */
  function injectIconButton() {
    if (document.getElementById('cph-icon-btn')) return;

    const shareBtn = document.querySelector('[data-testid="wiggle-controls-actions-share"]');
    if (!shareBtn) return;
    const toolbar = shareBtn.parentElement;
    if (!toolbar) return;

    /* Clone classes from Claude's icon-only toggle button (ghost style) */
    const claudeIconBtn = document.querySelector('[data-testid="wiggle-controls-actions-toggle"]');

    const btn = document.createElement('button');
    btn.id = 'cph-icon-btn';
    btn.type = 'button';
    btn.title = 'Prompt history';
    btn.setAttribute('aria-label', 'Prompt history');

    /* Use Claude's ghost button classes if available, else Share button classes */
    if (claudeIconBtn) {
      btn.className = claudeIconBtn.className;
    } else {
      btn.className = shareBtn.className;
    }

    btn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect x="2.5" y="2.5" width="15" height="15" rx="3.5" stroke="currentColor" stroke-width="1.5"/>' +
        '<line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
        '<line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>';

    btn.addEventListener('click', () => {
      closeClaudePanel();
      toggleSidebar();
    });

    /* Insert right before the Share button in the toolbar */
    toolbar.insertBefore(btn, shareBtn);
  }

  /* ══════════════════════════════════════
     MUTUAL EXCLUSION WITH CLAUDE'S PANEL
     ══════════════════════════════════════ */
  function getClaudeToggleBtn() {
    return document.querySelector('[data-testid="wiggle-controls-actions-toggle"]');
  }

  function isClaudePanelOpen() {
    const panel = document.querySelector('[aria-hidden][class*="overflow-x-hidden"][class*="overflow-y-auto"]');
    if (panel) return panel.getAttribute('aria-hidden') === 'false';
    const btn = getClaudeToggleBtn();
    if (!btn) return false;
    return btn.getAttribute('aria-expanded') === 'true' || btn.getAttribute('data-state') === 'open';
  }

  function closeClaudePanel() {
    if (!isClaudePanelOpen()) return;
    const btn = getClaudeToggleBtn();
    if (btn) btn.click();
  }

  const claudePanelObserver = new MutationObserver(() => {
    if (sidebarOpen && isClaudePanelOpen()) {
      toggleSidebar(false);
    }
  });
  claudePanelObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });

  /* ══════════════════════════════════════
     BUILD DOM
     Sidebar + backdrop on body (fixed).
     Chat constraint via CSS class toggle.
     ══════════════════════════════════════ */

  /* --- Backdrop --- */
  const backdropEl = document.createElement('div');
  backdropEl.id = 'cph-backdrop';
  document.body.appendChild(backdropEl);

  /* --- Sidebar (fixed position on body) --- */
  const sidebarEl = document.createElement('div');
  sidebarEl.id = 'cph-sidebar';
  sidebarEl.setAttribute('aria-hidden', 'true');
  sidebarEl.innerHTML = `
    <div id="cph-inner">
      <div id="cph-section">
        <div id="cph-section-header">
          <h3 id="cph-title">My prompts</h3>
        </div>
        <div id="cph-list"></div>
      </div>
    </div>`;
  document.body.appendChild(sidebarEl);

  /* Marker root on body so we can check if extension already loaded */
  const root = document.createElement('div');
  root.id = 'cph-root';
  document.body.appendChild(root);

  const listEl = document.getElementById('cph-list');

  /* ══════════════════════════════════════
     SCROLLABLE CHAT AREA
     This is the element BELOW the sticky
     header. Constraining only THIS element
     keeps the header buttons in place.
     ══════════════════════════════════════ */
  function getScrollableChat() {
    return document.querySelector('.overflow-y-auto.pt-6.flex-1');
  }

  /* ══════════════════════════════════════
     CLICK-OUTSIDE DETECTION
     ══════════════════════════════════════ */
  document.addEventListener('click', (e) => {
    if (_suppressNextDocClick) { _suppressNextDocClick = false; return; }
    if (sidebarOpen && !sidebarEl.contains(e.target) && !document.getElementById('cph-icon-btn')?.contains(e.target)) {
      toggleSidebar(false);
    }
  });

  /* ══════════════════════════════════════
     TOGGLE
     ══════════════════════════════════════ */
  function toggleSidebar(force) {
    sidebarOpen = typeof force === 'boolean' ? force : !sidebarOpen;

    sidebarEl.classList.toggle('open', sidebarOpen);
    sidebarEl.setAttribute('aria-hidden', String(!sidebarOpen));
    backdropEl.classList.toggle('visible', sidebarOpen);

    const btn = document.getElementById('cph-icon-btn');
    if (btn) btn.classList.toggle('active', sidebarOpen);

    /* Collapse/restore Claude's left nav */
    const toggle = getSidebarToggleBtn();
    if (toggle) {
      if (sidebarOpen) {
        _navWasOpen = isSidebarOpen();
        if (_navWasOpen) { _suppressNextDocClick = true; toggle.click(); }
      } else {
        if (_navWasOpen && !isSidebarOpen()) { _suppressNextDocClick = true; toggle.click(); }
      }
    }

    /* Constrain ONLY the scrollable chat area — header buttons stay in place */
    const scroller = getScrollableChat();
    if (scroller) scroller.classList.toggle('cph-constrained', sidebarOpen);

    if (sidebarOpen) render();
  }

  /* ══════════════════════════════════════
     RENDER
     ══════════════════════════════════════ */
  function render() {
    if (!listEl) return;
    if (!turns.length) {
      listEl.innerHTML = '<p class="cph-empty">No history yet —<br>send a message to start.</p>';
      return;
    }
    listEl.innerHTML = turns.map((t, i) =>
      '<button class="cph-item" data-id="' + t.id + '">' +
        '<span class="cph-num">' + (i + 1) + '</span>' +
        '<span class="cph-text">' + esc(truncate(t.prompt, 72)) + '</span>' +
      '</button>').join('');
    listEl.querySelectorAll('.cph-item').forEach(btn => {
      btn.addEventListener('click', () => scrollToTurn(+btn.dataset.id));
    });
  }

  /* ══════════════════════════════════════
     SCROLL + HIGHLIGHT
     Use existing page/header layout; avoid inline styles.
     ══════════════════════════════════════ */
  function scrollToTurn(id) {
    const turn = turns.find(t => t.id === id);
    if (!turn) return;
    const el = (turn.promptEl && document.contains(turn.promptEl)) ? turn.promptEl : findByText(turn.prompt);
    if (!el) return;

    function findScrollContainer(node) {
      let p = node;
      while (p && p !== document.body && p !== document.documentElement) {
        const style = getComputedStyle(p);
        const overflowY = style.overflowY;
        if (p.scrollHeight > p.clientHeight && (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')) return p;
        p = p.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }

    const container = findScrollContainer(el);
    const header = document.querySelector('header, [role="banner"], .app-header, .topbar, .toolbar-container');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const gap = 8;

    try {
      const elRect = el.getBoundingClientRect();
      if (container === document.scrollingElement || container === document.documentElement) {
        const target = window.pageYOffset + elRect.top - headerHeight - gap;
        window.scrollTo({ top: Math.max(0, Math.round(target)), behavior: 'smooth' });
      } else {
        const contRect = container.getBoundingClientRect();
        const target = container.scrollTop + (elRect.top - contRect.top) - headerHeight - gap;
        container.scrollTo({ top: Math.max(0, Math.round(target)), behavior: 'smooth' });
      }
    } catch (e) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    flash(el);
    if (window.innerWidth < 1000) toggleSidebar(false);
  }

  function findByText(prompt) {
    const needle = prompt.slice(0, 36).toLowerCase();
    for (const el of document.querySelectorAll(
      '[data-testid="user-message"], .font-user-message'
    )) { if (el.innerText?.toLowerCase().includes(needle)) return el; }
    return null;
  }

  function flash(el) {
    el.classList.add('cph-flash');
    setTimeout(() => { el.classList.remove('cph-flash'); }, 1800);
  }

  /* ══════════════════════════════════════
     OBSERVE CHAT
     ══════════════════════════════════════ */
  let lastCount = 0;
  const chatObserver = new MutationObserver(debounce(scanTurns, 600));
  chatObserver.observe(document.body, { childList: true, subtree: true });

  function scanTurns() {
    const userEls = document.querySelectorAll(
      '[data-testid="user-message"], .font-user-message'
    );
    const count = userEls.length;
    if (count === lastCount) return;
    if (count < turns.length) { turns = []; lastCount = 0; if (sidebarOpen) render(); return; }
    lastCount = count;
    for (let i = turns.length; i < count; i++) {
      const promptEl = userEls[i];
      const text = promptEl?.innerText?.trim() || '';
      if (text.length < 2) continue;
      turns.push({ id: nextId++, prompt: text, promptEl });
      if (sidebarOpen) render();
    }
  }

  /* ══════════════════════════════════════
     UTILS
     ══════════════════════════════════════ */
  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '\u2026' : (s || ''); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ══════════════════════════════════════
     INIT
     ══════════════════════════════════════ */
  injectIconButton();
  setInterval(injectIconButton, 2500);
  setTimeout(scanTurns, 1000);
})();
