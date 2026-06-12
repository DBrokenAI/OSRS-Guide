/* ==========================================================
   App boot — wires everything together
   ========================================================== */
(function () {

  // Register service worker (PWA / offline)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Warn if running from file:// — features will break
  if (location.protocol === 'file:') {
    const warn = document.createElement('div');
    warn.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ffd700;color:#5a3a00;padding:10px 16px;text-align:center;z-index:1000;font-weight:700;font-size:13px;border-bottom:2px solid #b08400;';
    warn.innerHTML = '⚠️ You\'re opening this as a local file (CORS-restricted). ' +
                     '<a href="https://dbrokenai.github.io/OSRS-Guide/" style="color:#5a3a00;text-decoration:underline;">Click here to open the live site</a> — AI + manifest will work properly there. ' +
                     '<span style="float:right;cursor:pointer;" onclick="this.parentElement.remove()">×</span>';
    document.body.appendChild(warn);
  }

  // Bond price ticker (OSRS Wiki realtime API has CORS enabled)
  async function fetchBondPrice() {
    try {
      const r = await fetch('https://prices.runescape.wiki/api/v1/osrs/latest?id=13190', {
        headers: { 'User-Agent': 'osrs-guide-personal' }
      });
      if (!r.ok) return;
      const data = await r.json();
      const price = data?.data?.['13190']?.high;
      if (price) {
        document.getElementById('bond-pill').textContent = `💍 Bond ${(price/1e6).toFixed(1)}M`;
        document.getElementById('bond-pill').classList.remove('subtle');
      }
    } catch (_) {}
  }
  fetchBondPrice();
  setInterval(fetchBondPrice, 30 * 60 * 1000); // refresh every 30 min

  // Tab switching
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    UI.showSection(btn.dataset.tab);
  });

  // Pre-create sections so UI.showSection works
  ['next','tasks','stats','quests','combat','skills','bosses','money','gear','diaries','plugins','rules','keys','journal','notes',
   'dailies','goals','pets','music','slayer','loadouts','diariestab','minigames','path','ai']
    .forEach(name => {
      const sec = document.createElement('section');
      sec.className = 'section' + (name === 'next' ? ' active' : '');
      sec.dataset.section = name;
      sec.innerHTML = '<h2 style="color:var(--text-soft);">Loading… ✨</h2>';
      document.getElementById('main').appendChild(sec);
    });

  // Buttons — null-safe so a stale/old index.html (missing a newer button)
  // can never throw and abort the whole boot.
  const on = (id, evt, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  };

  on('refresh-btn', 'click', () => {
    const u = document.getElementById('username-input').value.trim();
    if (u) startForUser(u);
  });
  on('username-input', 'keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('refresh-btn')?.click();
  });
  on('manual-btn', 'click', () => UI.showManualEntry());
  on('quests-btn', 'click', () => UI.showBulkQuestEditor());
  on('ai-settings-btn', 'click', () => UI.showAISettings());
  on('account-mode-btn', 'click', () => UI.toggleAccountMode());
  on('panic-btn', 'click', () => UI.showPanic());
  on('bored-btn', 'click', () => UI.showBored());
  on('global-search', 'input', () => UI.handleSearch());
  on('chat-fab', 'click', () => UI.toggleChatPanel());

  async function startForUser(username) {
    UI.toast(`✨ Fetching ${username}'s stats…`);
    let usedManual = false;

    // If user has manual stats saved, use them immediately while we try API in background
    if (Hiscores.hasManual()) {
      const manual = Hiscores.loadManual();
      if (manual) {
        UI.setStats(manual, null);
        usedManual = true;
      }
    }

    try {
      Hiscores.stopPolling();
      let everSucceeded = false;
      Hiscores.startPolling(username, (stats, diff) => {
        everSucceeded = true;
        // If user has manual stats explicitly saved, don't overwrite with live unless they clear it
        if (Hiscores.hasManual()) return;
        UI.setStats(stats, diff);
        if (diff) {
          Journal.recordDiff(diff);
          const lvlUps = Object.entries(diff).filter(([_, d]) => d.lvlDiff > 0);
          if (lvlUps.length) {
            const summary = lvlUps.map(([sid, d]) => {
              const m = SKILL_META.find(mm => mm.id === sid);
              return `${m.icon} ${m.name} → ${d.toLvl}!`;
            }).join('<br>');
            UI.toast(`🎉 Level up!<br>${summary}`);
            Confetti.fire({ count: 120 });
          } else {
            const totalXp = Object.values(diff).reduce((s, d) => s + (d.xpDiff || 0), 0);
            if (totalXp > 1000) UI.toast(`✨ +${totalXp.toLocaleString()} XP since last check 💕`);
          }
        }
        localStorage.setItem('bvels10_last_username', username);
      });

      // After ~5 seconds, if no live fetch succeeded and no manual stats, prompt manually
      setTimeout(() => {
        if (!everSucceeded && !Hiscores.hasManual()) {
          UI.toast(`💔 Couldn't reach Hiscores. Click ✏️ to enter stats manually.`);
          UI.showManualEntry();
        }
      }, 5000);
    } catch (e) {
      console.error(e);
      if (!usedManual) UI.toast(`💔 Couldn't fetch stats. Click ✏️ to enter manually.`);
    }
  }

  window.AppBoot = { refetch: () => {
    const u = document.getElementById('username-input').value.trim() || 'bvels10';
    startForUser(u);
  }};

  // Boot
  const startName = localStorage.getItem('bvels10_last_username') || 'bvels10';
  document.getElementById('username-input').value = startName;
  startForUser(startName);

})();
