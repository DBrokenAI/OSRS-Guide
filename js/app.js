/* ==========================================================
   App boot — wires everything together
   ========================================================== */
(function () {

  // Tab switching
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    UI.showSection(btn.dataset.tab);
  });

  // Pre-create sections so UI.showSection works
  ['next','tasks','stats','quests','combat','skills','bosses','money','gear','diaries','plugins','rules','keys','journal','notes']
    .forEach(name => {
      const sec = document.createElement('section');
      sec.className = 'section' + (name === 'next' ? ' active' : '');
      sec.dataset.section = name;
      sec.innerHTML = '<h2 style="color:var(--text-soft);">Loading… ✨</h2>';
      document.getElementById('main').appendChild(sec);
    });

  // Buttons
  document.getElementById('refresh-btn').addEventListener('click', () => {
    const u = document.getElementById('username-input').value.trim();
    if (u) startForUser(u);
  });

  document.getElementById('username-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('refresh-btn').click();
  });

  document.getElementById('manual-btn').addEventListener('click', () => UI.showManualEntry());
  document.getElementById('quests-btn').addEventListener('click', () => UI.showBulkQuestEditor());
  document.getElementById('panic-btn').addEventListener('click', () => UI.showPanic());

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
