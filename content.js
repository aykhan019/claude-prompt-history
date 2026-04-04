(function () {
  'use strict';
  if (document.getElementById('cph-root')) return;

  let turns = [];
  let activeTab = 'prompts';
  let sidebarOpen = false;
  let nextId = 0;

  /* ══════════════════════════════════════
     INJECT ICON BUTTON
     ══════════════════════════════════════ */
  function injectIconButton() {
    if (document.getElementById('cph-icon-btn')) return;
    const shareBtn = [...document.querySelectorAll('button')].find(
      b => b.textContent.trim() === 'Share' || b.dataset.testid === 'wiggle-controls-actions-share'
    );
    if (!shareBtn) return;

    const btn = document.createElement('button');
    btn.id = 'cph-icon-btn';
    btn.title = 'Prompt history';
    btn.innerHTML = `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="flex-shrink:0;"><rect x="2.5" y="2.5" width="15" height="15" rx="3.5" stroke="currentColor" stroke-width="1.5"/><line x1="6" y1="7" x2="14" y2="7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="13" x2="11" y2="13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></div>`;
    btn.addEventListener('click', () => {
      closeClaudePanel();   // close Claude's own panel first
      toggleSidebar();
    });
    shareBtn.parentNode.insertBefore(btn, shareBtn);
  }

  /* ══════════════════════════════════════
     MUTUAL EXCLUSION WITH CLAUDE'S PANEL
     Claude's Content panel is controlled by the doc-icon button
     (data-testid="wiggle-controls-actions-toggle").
     Strategy:
       1. When we open ours → programmatically click Claude's toggle if its panel is open
       2. Watch Claude's panel open state → close ours if they open theirs
     ══════════════════════════════════════ */
  function getClaudeToggleBtn() {
    return document.querySelector('[data-testid="wiggle-controls-actions-toggle"]');
  }

  function isClaudePanelOpen() {
    /* Claude's panel sets aria-hidden="false" when open */
    const panel = document.querySelector('[aria-hidden][class*="overflow-x-hidden"][class*="overflow-y-auto"]');
    if (panel) return panel.getAttribute('aria-hidden') === 'false';
    /* Fallback: check if the toggle button looks active */
    const btn = getClaudeToggleBtn();
    if (!btn) return false;
    return btn.getAttribute('aria-expanded') === 'true' || btn.getAttribute('data-state') === 'open';
  }

  function closeClaudePanel() {
    if (!isClaudePanelOpen()) return;
    const btn = getClaudeToggleBtn();
    if (btn) btn.click();
  }

  /* Watch Claude's panel — if user opens it, close ours */
  const claudePanelObserver = new MutationObserver(() => {
    if (sidebarOpen && isClaudePanelOpen()) {
      toggleSidebar(false);
    }
  });
  claudePanelObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });

  /* ══════════════════════════════════════
     BUILD SIDEBAR DOM
     ══════════════════════════════════════ */
  const root = document.createElement('div');
  root.id = 'cph-root';
  root.innerHTML = `
    <div id="cph-backdrop"></div>
    <div id="cph-sidebar" aria-hidden="true">
      <div id="cph-inner">
        <div id="cph-section">
          <div id="cph-section-header">
            <h3 id="cph-title">History</h3>
          </div>
          <div id="cph-tabs">
            <button class="cph-tab active" data-tab="prompts">My prompts</button>
            <button class="cph-tab" data-tab="responses">AI responses</button>
          </div>
          <div id="cph-list"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const listEl     = document.getElementById('cph-list');
  const sidebarEl  = document.getElementById('cph-sidebar');
  const backdropEl = document.getElementById('cph-backdrop');

  document.addEventListener('click', (e) => {
    /* Close sidebar on clicks outside of it (excluding the icon button) */
    if (sidebarOpen && !sidebarEl.contains(e.target) && !document.getElementById('cph-icon-btn')?.contains(e.target)) {
      toggleSidebar(false);
    }
  });
  document.querySelectorAll('.cph-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.cph-tab').forEach(t => t.classList.toggle('active', t === tab));
      render();
    });
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
    if (sidebarOpen) render();
  }

  /* ══════════════════════════════════════
     RENDER
     ══════════════════════════════════════ */
  function render() {
    if (!turns.length) {
      listEl.innerHTML = '<p class="cph-empty">No history yet —<br>send a message to start.</p>';
      return;
    }
    const items = [...turns];
    if (activeTab === 'prompts') {
      listEl.innerHTML = items.map((t, i) => `
        <button class="cph-item" data-id="${t.id}">
          <span class="cph-num">${i + 1}</span>
          <span class="cph-text">${esc(truncate(t.prompt, 72))}</span>
        </button>`).join('');
    } else {
      listEl.innerHTML = items.map((t, i) => `
        <button class="cph-item" data-id="${t.id}">
          <span class="cph-num">${i + 1}</span>
          ${t.aiTitle
            ? `<span class="cph-ai-title">${esc(t.aiTitle)}</span>`
            : '<span class="cph-dots"><span></span><span></span><span></span></span>'
          }
        </button>`).join('');
    }
    listEl.querySelectorAll('.cph-item').forEach(btn => {
      btn.addEventListener('click', () => scrollToTurn(+btn.dataset.id));
    });
  }

  /* ══════════════════════════════════════
     SCROLL + HIGHLIGHT
     ══════════════════════════════════════ */
  function scrollToTurn(id) {
    const turn = turns.find(t => t.id === id);
    if (!turn) return;
    const el = (turn.promptEl && document.contains(turn.promptEl))
      ? turn.promptEl : findByText(turn.prompt);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); flash(el); }
    if (window.innerWidth < 1000) toggleSidebar(false);
  }

  function findByText(prompt) {
    const needle = prompt.slice(0, 36).toLowerCase();
    for (const el of document.querySelectorAll(
      '[data-testid="user-message"], .font-user-message, [class*="HumanTurn"], [class*="human-turn"]'
    )) { if (el.innerText?.toLowerCase().includes(needle)) return el; }
    return null;
  }

  function flash(el) {
    el.style.cssText += ';outline:2px solid var(--border-200,rgba(150,150,150,0.5));border-radius:6px;transition:none;';
    setTimeout(() => {
      el.style.transition = 'outline 0.8s ease';
      el.style.outline = '2px solid transparent';
      setTimeout(() => { el.style.outline = ''; el.style.borderRadius = ''; el.style.transition = ''; }, 900);
    }, 1000);
  }

  /* ══════════════════════════════════════
     AI TITLE — parallel per-turn generation
     Each turn generates its title independently,
     polling every 200ms, giving up after 20s.
     ══════════════════════════════════════ */
  function enqueue(turn) {
    generateTitle(turn);
  }

  async function generateTitle(turn) {
    const aiText = await waitForAiText(turn);
    turn.aiTitle = aiText
      ? (await callApi(turn.prompt, aiText) || smartTitle(turn.prompt))
      : smartTitle(turn.prompt);
    if (sidebarOpen && activeTab === 'responses') render();
  }

  async function waitForAiText(turn) {
    const idx = turns.indexOf(turn);
    /* Poll every 200ms, give up after 20s (100 attempts) */
    for (let i = 0; i < 100; i++) {
      const els = document.querySelectorAll(
        '[data-testid="assistant-message"], [class*="AssistantTurn"] > div, [class*="assistant-turn"] > div, .font-claude-message'
      );
      const el = els[idx];
      if (el) {
        turn.aiEl = el;
        const text = el.innerText?.trim() || '';
        if (text.length >= 20) return text;
      }
      await sleep(200);
    }
    return null;
  }

  async function callApi(prompt, aiText) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', /* fastest model */
          max_tokens: 16,
          system: 'Reply with ONLY a 3-5 word title. No quotes. No punctuation. Nothing else.',
          messages: [{
            role: 'user',
            content: `Prompt: "${prompt.slice(0,100)}"\nResponse: "${aiText.slice(0,250)}"\nTitle:`
          }]
        })
      });
      if (!r.ok) return null;
      const d = await r.json();
      const t = d?.content?.[0]?.text?.trim();
      return (t && t.length < 55) ? t : null;
    } catch { return null; }
  }

  function smartTitle(p) {
    return p.replace(/[^\w\s]/g, ' ').trim().split(/\s+/).slice(0, 5).join(' ');
  }

  /* ══════════════════════════════════════
     OBSERVE CHAT
     ══════════════════════════════════════ */
  let lastCount = 0;
  const chatObserver = new MutationObserver(debounce(scanTurns, 600));
  chatObserver.observe(document.body, { childList: true, subtree: true });

  function scanTurns() {
    const userEls = document.querySelectorAll(
      '[data-testid="user-message"], .font-user-message, [class*="HumanTurn"] > div, [class*="human-turn"] > div'
    );
    const count = userEls.length;
    if (count === lastCount) return;
    if (count < turns.length) { turns = []; lastCount = 0; if (sidebarOpen) render(); return; }
    lastCount = count;
    for (let i = turns.length; i < count; i++) {
      const promptEl = userEls[i];
      const text = promptEl?.innerText?.trim() || '';
      if (text.length < 2) continue;
      const turn = { id: nextId++, prompt: text, aiTitle: null, promptEl, aiEl: null };
      turns.push(turn);
      enqueue(turn);
      if (sidebarOpen) render();
    }
  }

  /* ══════════════════════════════════════
     UTILS
     ══════════════════════════════════════ */
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function truncate(s, n) { return s && s.length > n ? s.slice(0,n)+'…' : (s||''); }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ══════════════════════════════════════
     INIT
     ══════════════════════════════════════ */
  injectIconButton();
  setInterval(injectIconButton, 2500);
  setTimeout(scanTurns, 1000);
})();
