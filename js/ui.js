/* ==========================================================
   UI — renders all tabs
   ========================================================== */
const UI = (() => {

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const NUM = (n) => n == null ? '—' : n.toLocaleString();
  const KFMT = (n) => n == null ? '—' : (n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n);

  let currentStats = null;
  let recentDiffs  = {}; // skillId → ts of last gain (for sparkle)

  function setStats(stats, diff) {
    // Overlay quest XP credits (from "Mark Done") onto live stats
    currentStats = PendingXp.apply(stats);
    if (diff) {
      const now = Date.now();
      for (const sid of Object.keys(diff)) recentDiffs[sid] = now;
    }
    renderAll();
  }

  // ---------- Header ----------
  function renderHeader() {
    if (!currentStats) return;
    syncAccountModeBtn();
    document.getElementById('player-name').textContent = currentStats.name || '—';
    const skillsByMeta = Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, currentStats.skills[m.id]?.level || 1]));
    const cb = combatLevel(skillsByMeta);
    document.getElementById('combat-level').textContent = `⚔️ Combat ${cb}`;
    document.getElementById('total-level').textContent = `🎀 Total ${currentStats.totalLevel || 0}`;
    const streak = DailyChecklist.getStreak();
    document.getElementById('streak-pill').textContent = `🔥 ${streak.count} day${streak.count === 1 ? '' : 's'} streak`;

    const lastUpd = document.getElementById('last-update');
    if (Hiscores.hasManual()) {
      // Authoritative manual mode — levels are exactly what you typed / told the AI.
      lastUpd.innerHTML = '📝 manual stats · <span style="text-decoration:underline;cursor:pointer;" ' +
        'onclick="UI.resumeLiveSync()" title="Switch back to live Hiscores sync">resume live sync</span>';
      lastUpd.classList.remove('subtle');
    } else {
      const minsAgo = currentStats.fetchedAt ? Math.round((Date.now() - currentStats.fetchedAt) / 60000) : null;
      lastUpd.textContent =
        minsAgo == null ? 'updating…' :
        minsAgo === 0 ? 'just updated 💕' :
        `updated ${minsAgo}m ago`;
    }
  }

  function syncAccountModeBtn() {
    const btn = document.getElementById('account-mode-btn');
    if (!btn) return;
    const f2p = AccountMode.isF2P();
    btn.textContent = f2p ? '🆓' : '🌍';
    btn.title = f2p ? 'F2P mode — showing F2P-only content. Click for all (members).' : 'Showing all (members) content. Click for F2P-only.';
    btn.style.background = f2p ? 'linear-gradient(135deg,#7ad48a,#bfe9c4)' : 'linear-gradient(135deg,#9be7a0,#ffd6c2)';
  }

  function toggleAccountMode() {
    const mode = AccountMode.toggle();
    syncAccountModeBtn();
    toast(mode === 'f2p' ? '🆓 F2P mode — members content hidden' : '🌍 Showing all content (members)');
    renderAll();
  }

  // (account-mode button kept in sync from renderHeader)

  function resumeLiveSync() {
    if (!confirm('Switch back to live Hiscores sync? Your typed/AI-set levels will be replaced by what the Hiscores report.')) return;
    Hiscores.clearManual();
    toast('🔄 Resuming live Hiscores sync 💕');
    if (window.AppBoot) window.AppBoot.refetch();
  }

  // ---------- Grouped navigation ----------
  // ~10 top-level tabs, each with one or more child sections shown via a sub-nav.
  const NAV_GROUPS = [
    { key: 'path',        icon: '🧭', label: 'The Path',     children: [['path', 'The Path']] },
    { key: 'plan',        icon: '💖', label: 'Plan',         children: [['next', 'Next Up'], ['dailies', 'Dailies'], ['goals', 'Goals'], ['tasks', 'My Tasks']] },
    { key: 'stats',       icon: '📊', label: 'Stats & Skills', children: [['stats', 'Stats'], ['skills', 'Skills'], ['combat', 'Combat'], ['unlocks', 'Unlocks']] },
    { key: 'quests',      icon: '📜', label: 'Quests',       children: [['quests', 'Quests']] },
    { key: 'pvm',         icon: '⚔️', label: 'PvM',          children: [['bosses', 'Bosses'], ['slayer', 'Slayer'], ['minigames', 'Minigames'], ['loadouts', 'Loadouts']] },
    { key: 'wealth',      icon: '💰', label: 'Wealth & Gear', children: [['money', 'Money'], ['gear', 'Gear']] },
    { key: 'collections', icon: '🏆', label: 'Collections',  children: [['diariestab', 'Diaries'], ['pets', 'Pets'], ['music', 'Music']] },
    { key: 'ai',          icon: '💬', label: 'Ask AI',       children: [['ai', 'Ask AI']] },
    { key: 'reference',   icon: '📚', label: 'Reference',    children: [['plugins', 'RuneLite'], ['rules', 'Golden Rules'], ['keys', 'Keybinds']] },
    { key: 'personal',    icon: '📓', label: 'Personal',     children: [['history', 'History'], ['journal', 'Journal'], ['notes', 'Notes']] },
  ];
  const lastChildOfGroup = {};

  function renderNav() {
    const tabsEl = document.getElementById('tabs');
    if (!tabsEl) return;
    tabsEl.innerHTML = `<div class="nav-group">` + NAV_GROUPS.map(g =>
      `<button class="tab" data-group="${g.key}"><span class="tab-icon">${g.icon}</span> ${g.label}</button>`
    ).join('') + `</div>`;
  }

  function groupForSection(name) {
    return NAV_GROUPS.find(g => g.children.some(c => c[0] === name));
  }

  function showGroup(key) {
    const g = NAV_GROUPS.find(x => x.key === key);
    if (!g) return;
    showSection(lastChildOfGroup[key] || g.children[0][0]);
  }

  function renderSubnav(g, activeName) {
    const el = document.getElementById('subnav');
    if (!el) return;
    if (!g || g.children.length <= 1) { el.innerHTML = ''; el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = g.children.map(([sec, label]) =>
      `<button class="subnav-pill${sec === activeName ? ' active' : ''}" data-section="${sec}"
        style="padding:6px 14px;border-radius:999px;border:1px solid var(--card-border);cursor:pointer;font-family:var(--font-body);font-weight:600;font-size:13px;
        background:${sec === activeName ? 'linear-gradient(135deg,var(--pink-500),var(--pink-400))' : 'var(--card-bg-strong)'};
        color:${sec === activeName ? '#fff' : 'var(--text)'};">${label}</button>`
    ).join('');
  }

  // ---------- Sections ----------
  function showSection(name) {
    const g = groupForSection(name);
    if (g) lastChildOfGroup[g.key] = name;
    document.querySelectorAll('#tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.group === (g ? g.key : '')));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.dataset.section === name));
    renderSubnav(g, name);
  }

  function renderAll() {
    if (!currentStats) return;
    renderHeader();
    renderNext();
    renderTasks();
    renderStats();
    renderQuests();
    renderCombat();
    renderSkills();
    renderBosses();
    renderMoney();
    renderGear();
    renderDiaries();
    renderPlugins();
    renderRules();
    renderKeys();
    renderJournal();
    renderNotes();
    // NEW
    renderDailies();
    renderGoals();
    renderPets();
    renderMusic();
    renderSlayer();
    renderLoadouts();
    renderDiariesTab();
    renderMinigames();
    renderPath();
    renderHistory();
    renderUnlocks();
    renderAI();
  }

  // ---------- helpers ----------
  const COMPLETED_QUESTS_KEY = 'bvels10_completed_quests_v1';
  const COMPLETED_RECS_KEY   = 'bvels10_completed_recs_v1';

  function loadCompletedQuests() {
    try { return new Set(JSON.parse(localStorage.getItem(COMPLETED_QUESTS_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function saveCompletedQuests(set) {
    localStorage.setItem(COMPLETED_QUESTS_KEY, JSON.stringify([...set]));
  }
  function loadCompletedRecs() {
    try { return new Set(JSON.parse(localStorage.getItem(COMPLETED_RECS_KEY) || '[]')); }
    catch { return new Set(); }
  }
  function saveCompletedRecs(set) {
    localStorage.setItem(COMPLETED_RECS_KEY, JSON.stringify([...set]));
  }
  function recKey(r) { return `${r.type || 'rec'}:${r.id || r.title}`; }

  function completedSet() {
    return loadCompletedQuests();
  }

  // One-time cleanup of legacy auto-recs that accumulated in TaskList
  (function cleanupLegacyAutoTasks() {
    if (localStorage.getItem('bvels10_cleaned_v2')) return;
    const all = TaskList.all();
    for (const t of all) {
      if (t.source === 'auto' || (t.id || '').startsWith('auto_')) {
        TaskList.remove(t.id);
      }
    }
    localStorage.setItem('bvels10_cleaned_v2', '1');
  })();

  function sectionEl(name) {
    let el = document.querySelector(`.section[data-section="${name}"]`);
    if (!el) {
      el = document.createElement('section');
      el.className = 'section';
      el.dataset.section = name;
      document.getElementById('main').appendChild(el);
    }
    return el;
  }

  // ============ NEXT UP ============
  function renderNext() {
    const el = sectionEl('next');
    const completed = completedSet();
    const completedRecs = loadCompletedRecs();
    const allRecs = Recommender.topRecommendations(currentStats, completed);
    const recs = allRecs.filter(r => !completedRecs.has(recKey(r)));
    const upcoming = Recommender.comingUpRecommendations(currentStats, completed)
                                 .filter(r => !completedRecs.has(recKey(r)));
    const cb = Recommender.currentCombatLevel(currentStats);

    const categoryTag = {
      starter: 'green', quest: 'gold', skill: 'blue', minigame: 'purple',
      gear: 'gold', setup: 'green', milestone: 'gold', boss: 'red',
      daily: 'green', skilling: 'blue'
    };

    function renderCard(r, badge, doneable) {
      const key = recKey(r);
      const isLocked = r.tag === 'locked';
      return `
        <div class="card" ${isLocked ? 'style="opacity:0.85;"' : ''}>
          <div class="card-header">
            <div class="card-title">
              <span style="font-size:22px;">${r.icon}</span>
              <span>${esc(r.title)}</span>
            </div>
            <div>
              ${r.cat ? `<span class="tag ${categoryTag[r.cat] || 'blue'}">${esc(r.cat)}</span>` : ''}
              ${badge ? `<span class="tag ${badge === 'TOP' ? 'gold' : 'locked'}">${badge}</span>` : ''}
            </div>
          </div>
          ${r.unlockLabel ? `
            <div style="margin:8px 0 0;padding:6px 12px;background:linear-gradient(90deg,var(--pink-50),transparent);border-left:3px solid var(--pink-400);border-radius:8px;font-size:13px;font-weight:600;color:var(--pink-600);">
              📌 Do this at: ${r.unlockLabel}
            </div>
          ` : ''}
          ${r.trainingHints && r.trainingHints.length ? `
            <div style="margin:8px 0 0;padding:8px 12px;background:linear-gradient(90deg,#e8f5ff,transparent);border-left:3px solid #5ba6e8;border-radius:8px;font-size:13px;">
              <strong style="color:#2b6fc4;">🎓 Where to train right now:</strong>
              ${r.trainingHints.map(h => `
                <div style="margin:6px 0 0;padding:4px 0;">
                  <strong>${h.skillIcon || ''} ${esc(h.skill)} ${h.from} → ${h.to}:</strong><br>
                  <span style="color:var(--text-soft);">${esc(h.method)} @ ${esc(h.where || '')}</span><br>
                  <span style="color:var(--text-faint);font-size:12px;">${esc(h.xpHr || '')} xp/hr — switch at level ${h.switchAt} to the next method</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <p style="margin:6px 0 0;color:var(--text-soft);">${r.detail || ''}</p>
          <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            ${r.wiki ? `<a class="wiki-link" target="_blank" href="${r.wiki}">Wiki →</a>` : ''}
            ${doneable ? `<button class="btn" style="font-size:12px;padding:5px 14px;margin-left:auto;"
              data-key="${esc(key)}" data-type="${esc(r.type || '')}" data-id="${esc(r.id || '')}" data-title="${esc(r.title)}"
              onclick="UI.markRecDone(this)">✓ Mark Done</button>` : ''}
          </div>
        </div>
      `;
    }

    const pathNext = nextPathStep();
    const pathBanner = pathNext ? `
      <div class="card" style="background:linear-gradient(135deg,var(--pink-50),#fff8d0);cursor:pointer;" onclick="UI.showSection('path')">
        <div style="font-weight:800;color:var(--pink-600);">🧭 Next step on your Path to a Bossing Main</div>
        <div style="margin-top:4px;font-weight:700;">${esc(pathNext.step.label)}</div>
        <div style="color:var(--text-soft);font-size:13px;margin-top:2px;">${esc(pathNext.step.detail || '')}</div>
        <div style="font-size:12px;color:var(--pink-600);margin-top:6px;">Open The Path →</div>
      </div>` : '';

    el.innerHTML = `
      <h2>💖 Next Up — for ${esc(currentStats.name)}</h2>
      <p style="color:var(--text-soft); margin-top:-6px;">
        You're combat <strong>${cb}</strong>. These are progressive — only stuff she can actually do <em>right now</em>. ✨
      </p>
      ${pathBanner}

      <h3>✨ Do these now (top priority)</h3>
      ${recs.length === 0 ? '<p style="color:var(--text-soft);">All caught up! Check Coming Soon below ✨</p>' : ''}
      ${recs.map(r => renderCard(r, r.priority === 1 ? 'TOP' : null, true)).join('')}

      ${upcoming.length ? `
        <h3>🔜 Coming Up — your roadmap</h3>
        <p style="color:var(--text-soft);font-size:13px;margin-top:-4px;">
          Sorted by what unlocks next. Each card shows exactly what level you need. ✨
        </p>
        ${upcoming.map(r => renderCard(r, null, false)).join('')}
      ` : ''}

      <h3>🌟 Lifetime Goals (always working toward these)</h3>
      <p style="color:var(--text-soft);font-size:13px;margin-top:-4px;">
        The long-term targets — quest cape, max cape, fire cape, comp cape. Show your progress.
      </p>
      ${Recommender.lifetimeGoals(currentStats, completed)
        .filter(r => !completedRecs.has(recKey(r)))
        .map(r => renderCard(r, null, true)).join('')}

      ${completedRecs.size ? `
        <h3 style="margin-top:32px;">🎀 Completed (${completedRecs.size}) <button class="btn btn-soft" style="float:right;font-size:11px;padding:4px 10px;" onclick="UI.resetCompletedRecs()">Reset</button></h3>
        <p style="color:var(--text-soft);font-size:12px;margin-top:-4px;">Recommendations you've marked done. They'll stay hidden from the lists above. 💕</p>
      ` : ''}
    `;
  }

  function markRecDone(btn) {
    const key   = btn.dataset.key;
    const type  = btn.dataset.type;
    const id    = btn.dataset.id;
    const title = btn.dataset.title;

    const set = loadCompletedRecs();
    set.add(key);
    saveCompletedRecs(set);

    let xpInfoMsg = '';

    // If it's a quest, also write to the bulk quest store so all views agree
    if (type === 'quest' && id) {
      const qSet = loadCompletedQuests();
      qSet.add(id);
      saveCompletedQuests(qSet);

      // Show the quest's XP rewards as INFO only — we no longer auto-add it to
      // your levels (that caused inflated levels). Update your level explicitly
      // if a quest pushed you up: e.g. tell the AI "set magic to 6".
      const quest = QUESTS.find(q => q.id === id);
      if (quest?.xpRewards) {
        const lines = Object.entries(quest.xpRewards).map(([sid, xp]) => {
          const m = SKILL_META.find(mm => mm.id === sid);
          return `${m?.icon || ''} +${xp.toLocaleString()} ${m?.name || sid}`;
        });
        xpInfoMsg = `<br><span style="opacity:.85;font-size:12px;">In-game reward: ${lines.join(' · ')}</span>`;
        Journal.add('quest', `📜 Completed: ${title} (${lines.join(', ')})`, true);
      }
    }

    Journal.add('done', `✅ Marked done: ${title}`, false);
    renderAll();
    toast(`✨ Marked done!${xpInfoMsg}`);
  }

  function resetCompletedRecs() {
    if (!confirm('Clear all "done" markings? Hidden recommendations will reappear.')) return;
    saveCompletedRecs(new Set());
    renderAll();
  }

  // ============ MY TASKS ============
  function renderTasks() {
    const el = sectionEl('tasks');
    const open = TaskList.open();
    const dn = TaskList.done();
    el.innerHTML = `
      <h2>✅ My Tasks</h2>
      <p style="color:var(--text-soft);">Auto-added based on your stats. Check things off as you complete them — they save automatically. 💕</p>
      <div class="add-task">
        <input id="task-input" placeholder="add your own task (e.g. 'grind to 50 fishing')" />
        <button class="btn" onclick="UI.addTask()">+ Add</button>
      </div>
      <h3>To-Do (${open.length})</h3>
      ${open.length === 0 ? '<p style="color:var(--text-soft);">All caught up! ✨</p>' : ''}
      ${open.map(t => taskRow(t)).join('')}
      <h3>Completed (${dn.length}) ${dn.length ? `<button class="btn btn-soft" style="float:right;font-size:12px;padding:4px 10px;" onclick="UI.clearDone()">Clear all</button>` : ''}</h3>
      ${dn.slice().reverse().slice(0, 20).map(t => taskRow(t)).join('')}
    `;
  }

  function taskRow(t) {
    return `
      <div class="task-row ${t.done ? 'done' : ''}">
        <div class="task-check ${t.done ? 'checked' : ''}" onclick="UI.toggleTask('${t.id}')"></div>
        <div class="task-body">
          <div class="task-label">${esc(t.label)}</div>
          ${t.meta ? `<div class="task-meta">${esc(t.meta)}</div>` : ''}
        </div>
        <button class="task-delete" onclick="UI.removeTask('${t.id}')" title="Delete">×</button>
      </div>
    `;
  }

  function addTask() {
    const inp = document.getElementById('task-input');
    if (!inp) return;
    TaskList.addManual(inp.value);
    inp.value = '';
    renderTasks();
  }
  function toggleTask(id) { TaskList.toggle(id); renderTasks(); renderNext(); }
  function removeTask(id) { TaskList.remove(id); renderTasks(); }
  function clearDone()    { TaskList.clearDone(); renderTasks(); }

  // ============ STATS ============
  function renderStats() {
    const el = sectionEl('stats');
    const s = currentStats.skills;
    const now = Date.now();

    el.innerHTML = `
      <h2>📊 Your Stats</h2>
      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
        <div class="stats-grid">
          ${SKILL_META.map(m => {
            const sk = s[m.id] || { level: 1, xp: 0 };
            const recent = recentDiffs[m.id] && (now - recentDiffs[m.id] < 5*60*1000);
            const pending = sk._pending;
            // Progress to next level (0-100%)
            const curBase = xpForLevel(sk.level);
            const nextBase = sk.level >= 99 ? curBase : xpForLevel(sk.level + 1);
            const pct = sk.level >= 99 ? 100 : Math.max(0, Math.min(100, ((sk.xp - curBase) / (nextBase - curBase)) * 100));
            return `
              <div class="stat ${recent ? 'recently-gained' : ''}" ${pending ? 'title="Includes quest XP not yet on hiscores"' : ''}>
                <span class="stat-icon">${m.icon}</span>
                <div>
                  <div class="stat-name">${esc(m.name)}</div>
                  <div class="stat-xp">${NUM(sk.xp)} xp${pending ? ` <span style="color:var(--pink-500);font-weight:700;">+${NUM(pending)} 💖</span>` : ''}</div>
                </div>
                <div class="stat-lvl">${sk.level}</div>
                <div class="stat-progress"><div class="stat-progress-fill" style="width:${pct.toFixed(1)}%;"></div></div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="flex:1;min-width:300px;">
          <div class="card">
            <div class="card-title">⏳ XP to Next Level</div>
            <table class="method-table" style="margin:8px 0 0;">
              <tr><th>Skill</th><th>Lv</th><th>XP to next</th></tr>
              ${SKILL_META.map(m => {
                const sk = s[m.id]; if (!sk || sk.level >= 99) return '';
                const need = xpToNext(sk.xp, sk.level);
                return `<tr><td>${m.icon} ${esc(m.name)}</td><td>${sk.level}</td><td>${NUM(need)}</td></tr>`;
              }).join('')}
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // ============ QUESTS ============
  function renderQuests() {
    const el = sectionEl('quests');
    const completed = completedSet();
    const ready = Recommender.readyQuests(currentStats, completed);
    const locked = Recommender.lockedQuests(currentStats, completed);

    el.innerHTML = `
      <h2>📜 Quests</h2>
      <p style="color:var(--text-soft);">
        ✨ TIP: Install <strong>Quest Helper</strong> in RuneLite — it walks you through every quest in-game.
      </p>

      <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <strong>📝 Bulk-mark your completed quests</strong>
          <div class="card-sub">${completed.size} marked so far. Open the editor to tick everything she's already done.</div>
        </div>
        <button class="btn" onclick="UI.showBulkQuestEditor()">Open Quest Editor ✨</button>
      </div>

      <h3>✅ Ready to start (sorted by priority)</h3>
      <div class="grid-3">
        ${ready.map(q => questCard(q, 'ready')).join('') || '<p>Nothing ready right now.</p>'}
      </div>

      <h3>🔒 Locked (need more stats / prereqs)</h3>
      <div class="grid-3">
        ${locked.slice(0, 30).map(q => questCard(q, 'locked')).join('')}
      </div>
    `;
  }

  function questCard(q, mode) {
    const reqsTxt = formatReqs(q.reqs);
    const walkthrough = QUEST_WALKTHROUGHS[q.id];
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📜 ${esc(q.name)} ${q.members ? '<span class="tag purple">MEMBERS</span>' : '<span class="tag green">F2P</span>'}</div>
          <span class="tag ${mode === 'ready' ? 'ready' : 'locked'}">${mode === 'ready' ? 'READY ✨' : 'LOCKED'}</span>
        </div>
        <p class="card-sub" style="margin:4px 0 6px;">${esc(q.why || '')}</p>
        <p style="margin:2px 0;font-size:13px;"><strong>Length:</strong> ${esc(q.length || '?')}</p>
        ${reqsTxt ? `<p style="margin:2px 0;font-size:13px;"><strong>Reqs:</strong> ${reqsTxt}</p>` : ''}
        <p style="margin:2px 0;font-size:13px;"><strong>Rewards:</strong> ${(q.rewards || []).map(esc).join(', ')}</p>
        ${walkthrough ? `
          <details style="margin:8px 0 0;background:var(--pink-50);border-radius:10px;padding:8px 12px;">
            <summary style="cursor:pointer;font-weight:700;color:var(--pink-600);">📖 Quick walkthrough (${walkthrough.length} steps)</summary>
            <ol style="margin:6px 0 0;padding-left:22px;font-size:13px;line-height:1.5;">
              ${walkthrough.map(step => `<li>${esc(step)}</li>`).join('')}
            </ol>
          </details>
        ` : ''}
        <p style="margin:8px 0 0;">
          <a class="wiki-link" target="_blank" href="${WIKI(q.name)}">Wiki guide →</a>
          ${mode === 'ready' ? ` &nbsp; <button class="btn btn-soft" style="font-size:12px;padding:4px 12px;" data-qname="${esc(q.name)}" onclick="UI.markQuestDone('${q.id}', this.dataset.qname)">Mark done ✓</button>` : ''}
        </p>
      </div>
    `;
  }

  function markQuestDone(qid, name) {
    TaskList.add({ id: 'auto_' + qid, label: `📜 Did: ${name}`, source: 'auto' });
    TaskList.toggle('auto_' + qid);
    // Also save to bulk store so editor stays in sync
    const set = loadCompletedQuests();
    set.add(qid);
    saveCompletedQuests(set);
    Journal.add('quest', `📜 Completed quest: ${name}`, true);
    renderQuests(); renderNext(); renderTasks();
  }

  // ============ AI / COMMAND ACTIONS ============
  // Resolve a free-text quest/task name → { kind, id, name } or null
  function resolveCompletable(name) {
    if (!name) return null;
    const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const n = norm(name);
    if (!n) return null;
    const tasks = (typeof MASTER_TASKS !== 'undefined') ? MASTER_TASKS : [];
    // exact name
    let q = QUESTS.find(x => norm(x.name) === n);  if (q) return { kind:'quest', id:q.id, name:q.name };
    let t = tasks.find(x => norm(x.name) === n);    if (t) return { kind:'task',  id:t.id, name:t.name };
    // includes (need a reasonably specific query)
    if (n.length >= 4) {
      q = QUESTS.find(x => norm(x.name).includes(n));  if (q) return { kind:'quest', id:q.id, name:q.name };
      t = tasks.find(x => norm(x.name).includes(n));   if (t) return { kind:'task',  id:t.id, name:t.name };
      // query contains the item name (e.g. "i finished the cooks assistant quest")
      q = QUESTS.find(x => n.includes(norm(x.name)));  if (q) return { kind:'quest', id:q.id, name:q.name };
      t = tasks.find(x => n.includes(norm(x.name)));   if (t) return { kind:'task',  id:t.id, name:t.name };
    }
    // id slug
    const slug = n.replace(/\s+/g, '_');
    q = QUESTS.find(x => x.id === slug || x.id.includes(slug));
    if (q) return { kind:'quest', id:q.id, name:q.name };
    return null;
  }

  // Execute ONE structured action. Returns a confirmation string or null.
  // Mutates currentStats / stores but does NOT re-render (applyActions batches that).
  function applyAction(a) {
    if (!a || !a.type) return null;
    try {
      switch (a.type) {
        case 'setLevel': {
          const sid = SKILL_META.find(m => m.id === a.skill)?.id;
          const lvl = Math.max(1, Math.min(99, parseInt(a.level)));
          if (!sid || !lvl) return null;
          const loaded = Hiscores.setManualLevel(currentStats, sid, lvl);
          if (!loaded) return null;
          currentStats = PendingXp.apply(loaded);
          const m = SKILL_META.find(mm => mm.id === sid);
          Journal.add('xp', `✏️ Set ${m.name} to ${lvl}`, false);
          return `${m.icon} ${m.name} → ${lvl}`;
        }
        case 'setXp': {
          const sid = SKILL_META.find(m => m.id === a.skill)?.id;
          if (!sid) return null;
          const loaded = Hiscores.setManualXp(currentStats, sid, a.xp);
          if (!loaded) return null;
          currentStats = PendingXp.apply(loaded);
          const m = SKILL_META.find(mm => mm.id === sid);
          return `${m.icon} ${m.name} → ${currentStats.skills[sid].level} (${Number(a.xp).toLocaleString()} xp)`;
        }
        case 'markQuest':
        case 'markTask': {
          const target = a.id
            ? { kind: a.type === 'markTask' ? 'task' : 'quest', id: a.id, name: a.name || a.id }
            : resolveCompletable(a.name);
          if (!target) return null;
          const set = loadCompletedQuests();
          const done = a.done !== false;
          if (done) set.add(target.id); else set.delete(target.id);
          saveCompletedQuests(set);
          Journal.add('quest', `${done ? '📜 Completed' : '↩️ Un-marked'}: ${target.name}`, done);
          return `${done ? '✅' : '↩️'} ${target.name} ${done ? 'marked done' : 'un-marked'}`;
        }
        case 'fixData':
          return (typeof UserOverrides !== 'undefined') ? UserOverrides.applyFix(a) : null;
        default:
          return null;
      }
    } catch (e) { console.warn('applyAction failed', a, e); return null; }
  }

  // Execute a batch, re-render once, return confirmation strings.
  function applyActions(actions) {
    if (!Array.isArray(actions) || !actions.length) return [];
    const confirms = [];
    for (const a of actions) { const c = applyAction(a); if (c) confirms.push(c); }
    if (confirms.length) renderAll();
    return confirms;
  }

  function formatReqs(reqs) {
    if (!reqs) return '';
    const parts = [];
    if (reqs.skill) parts.push(Object.entries(reqs.skill).map(([k,v]) => `${v} ${k}`).join(', '));
    if (reqs.quests) {
      parts.push(reqs.quests.map(qid => {
        const q = QUESTS.find(qq => qq.id === qid);
        return q ? q.name : qid;
      }).join(', '));
    }
    return parts.join(' · ');
  }

  // ============ COMBAT ============
  function renderCombat() {
    const el = sectionEl('combat');
    const s = currentStats.skills;
    const cl = combatLevel(Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, s[m.id]?.level || 1])));

    el.innerHTML = `
      <h2>⚔️ Combat</h2>
      <div class="card">
        <div class="card-title">Your Combat Level: ${cl}</div>
        <p>Combat is calculated from Attack, Strength, Defence, HP, Prayer, and your best of Ranged/Magic.</p>
        <p><strong>Key breakpoints:</strong> 60 (Scurrius safe), 70 (whip + barrows gear), 85+ (most slayer bosses), 100+ (Vorkath territory).</p>
      </div>

      ${['attack','strength','defence','ranged','magic','prayer'].map(sid => skillTierBlock(sid)).join('')}
    `;
  }

  function skillTierBlock(sid) {
    const meta = SKILL_META.find(m => m.id === sid);
    const tiers = SKILL_TIERS[sid] || [];
    const lvl = currentStats.skills[sid]?.level || 1;
    const xp  = currentStats.skills[sid]?.xp || 0;
    const next = xpToNext(xp, lvl);
    const cur = Recommender.currentTier(sid, lvl);

    return `
      <details class="skill-detail" ${meta.combat || lvl < 50 ? 'open' : ''}>
        <summary>
          ${meta.icon} ${meta.name} — Level ${lvl}
          <span class="tag" style="margin-left:8px;">XP to next: ${NUM(next)}</span>
          ${cur ? `<span class="tag green">Now: ${esc(cur.name)}</span>` : ''}
        </summary>
        <div class="skill-body">
          <table class="method-table">
            <tr><th>Levels</th><th>Method</th><th>Where</th><th>XP/hr</th><th>Why switch</th></tr>
            ${tiers.map(t => {
              const isCur = lvl >= t.from && lvl < t.to;
              const isLocked = lvl < t.from;
              return `
                <tr class="${isCur ? 'current-tier' : ''} ${isLocked ? 'locked-tier' : ''}">
                  <td><strong>${t.from}–${t.to}</strong></td>
                  <td>${esc(t.name)}</td>
                  <td>${esc(t.where || '')}</td>
                  <td>${esc(t.xpHr || '')}</td>
                  <td style="font-size:12px;color:var(--text-soft);">${esc(t.why || '')}${t.reqs && t.reqs !== 'none' ? `<br><em>Req: ${esc(t.reqs)}</em>` : ''}</td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
      </details>
    `;
  }

  // ============ SKILLS (non-combat) ============
  function renderSkills() {
    const el = sectionEl('skills');
    const nonCombat = SKILL_META.filter(m => !m.combat);
    const f2pNote = AccountMode.isF2P()
      ? `<p style="background:var(--pink-50);border:1px solid var(--pink-200);border-radius:10px;padding:8px 12px;font-size:13px;color:var(--text-soft);">🆓 <strong>F2P mode:</strong> Agility, Herblore, Farming, Hunter, Construction, Thieving (most), Fletching and Slayer are members-only — the methods below show the full game; ignore members methods until you subscribe.</p>`
      : '';
    el.innerHTML = `
      <h2>🌸 Skills</h2>
      <p style="color:var(--text-soft);">Click any skill to see the level-by-level training plan. Your current tier is highlighted. ✨</p>
      ${f2pNote}
      ${nonCombat.map(m => skillTierBlock(m.id)).join('')}
    `;
  }

  // ============ BOSSES ============
  const BOSS_TIER_LABEL = {
    early: '🌱 Early / beginner', mid: '⚔️ Mid-game', slayer: '💀 Slayer bosses',
    gwd: '🛡️ God Wars Dungeon', dt2: '🏜️ Desert Treasure II', endgame: '🔥 Endgame', raid: '🐲 Raids',
  };
  const BOSS_TIER_ORDER = ['early', 'mid', 'slayer', 'gwd', 'dt2', 'endgame', 'raid'];

  function bossCard(b, lockedMode) {
    const gap = lockedMode && b._gap ? formatMiniGap(b._gap) : '';
    const kc = bossKcFor(b);
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${b.icon || '👑'} ${esc(b.name)}${b.f2p ? ' <span class="tag green" style="font-size:10px;">F2P</span>' : ''}</div>
          <span class="tag ${lockedMode ? 'locked' : 'ready'}">${lockedMode ? 'LOCKED' : 'READY ✨'}</span>
        </div>
        ${kc != null ? `<p style="margin:2px 0;font-size:13px;"><strong>Your KC:</strong> <span style="color:var(--pink-600);font-weight:700;">${NUM(kc)}</span></p>` : ''}
        <p style="margin:4px 0;font-size:13px;"><strong>Stats:</strong> ${esc(b.stats || '')}</p>
        <p style="margin:4px 0;font-size:13px;"><strong>Location:</strong> ${esc(b.location || '')}</p>
        <p style="margin:4px 0;font-size:13px;"><strong>Loot:</strong> ${esc(b.loot || '')}</p>
        ${b.questNote ? `<p style="margin:4px 0;font-size:13px;color:var(--text-soft);"><strong>Requires:</strong> ${esc(b.questNote)}</p>` : ''}
        ${gap ? `<p style="margin:4px 0;font-size:13px;color:var(--pink-600);"><strong>Unlock at:</strong> ${gap}</p>` : ''}
        <p style="margin:6px 0 0;color:var(--text-soft);">${esc(b.why || '')}</p>
        <p style="margin:8px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(b.wiki || b.name)}">Wiki guide →</a></p>
      </div>`;
  }

  function renderBosses() {
    const el = sectionEl('bosses');
    const ready = Recommender.readyBosses(currentStats);
    const locked = Recommender.lockedBosses(currentStats);
    let readyHtml = '';
    for (const t of BOSS_TIER_ORDER) {
      const group = ready.filter(b => b.tier === t);
      if (!group.length) continue;
      readyHtml += `<h4 style="margin:16px 0 6px;color:var(--text-soft);">${BOSS_TIER_LABEL[t] || t}</h4>
        <div class="grid-3">${group.map(b => bossCard(b, false)).join('')}</div>`;
    }
    el.innerHTML = `
      <h2>👑 Boss Ladder</h2>
      <p style="color:var(--text-soft);">
        Every boss, gated by <em>your</em> stats. ✅ = your combat/skills are high enough now — still check the
        <strong>Requires</strong> line for a quest/slayer prereq. Sorted easiest → hardest. ✨
      </p>
      <h3>✅ Ready by your stats (${ready.length})</h3>
      ${readyHtml || '<p>Train your combat up a bit to unlock your first boss!</p>'}
      <h3 style="margin-top:20px;">🔒 Coming up (closest first)</h3>
      <div class="grid-3">${locked.map(b => bossCard(b, true)).join('')}</div>
    `;
  }

  // Boss KC from hiscores (filled in workstream C). Returns a number or null.
  function bossKcFor(b) {
    const map = currentStats && currentStats.bossKc;
    if (!map) return null;
    return map[b.id] != null ? map[b.id] : null;
  }

  // ============ MONEY ============
  // Approx gp/hr value parsed from the method's gpHr string, for ranking.
  function moneyValue(m) {
    const s = String(m.gpHr || '').toLowerCase();
    let max = 0;
    for (const mt of s.matchAll(/([\d.]+)\s*([km])?/g)) {
      let n = parseFloat(mt[1]);
      if (!isFinite(n)) continue;
      if (mt[2] === 'm') n *= 1e6; else if (mt[2] === 'k') n *= 1e3;
      if (n > max) max = n;
    }
    if (/day/.test(s)) max = max / 8; // normalize per-day income toward an hourly rate
    return max;
  }

  function renderMoney() {
    const el = sectionEl('money');
    const f2p = AccountMode.isF2P();
    // Top money makers first (highest gp/hr). Starter/one-time methods fall to the bottom.
    const ranked = MONEY_METHODS.slice()
      .filter(m => !f2p || m.f2p)
      .sort((a, b) => moneyValue(b) - moneyValue(a));
    el.innerHTML = `
      <h2>💰 Top Money Makers${f2p ? ' <span class="tag green" style="font-size:12px;vertical-align:middle;">F2P</span>' : ''}</h2>
      <p style="color:var(--text-soft);">Ranked by gp/hr — best earners first. Check the <strong>Reqs</strong> to see what you can do at your level. ✨${f2p ? ' <em>Showing F2P methods only.</em>' : ''}</p>
      ${ranked.map((m, i) => {
        const isTop = i < 3 && moneyValue(m) > 0;
        return `
        <div class="card"${isTop ? ' style="border:1px solid var(--pink-300);box-shadow:0 2px 12px rgba(232,56,138,0.12);"' : ''}>
          <div class="card-header">
            <div class="card-title">${isTop ? '🔥 ' : ''}<span style="color:var(--text-faint);font-size:13px;">#${i + 1}</span> 💰 ${esc(m.name)}</div>
            <span class="tag ${isTop ? 'gold' : 'green'}">${esc(m.gpHr)}${/day/i.test(m.gpHr) ? '' : ' / hr'}</span>
          </div>
          <p style="margin:4px 0;font-size:13px;"><strong>Reqs:</strong> ${esc(m.reqs)}</p>
          <p style="margin:6px 0 0;color:var(--text-soft);">${esc(m.summary)}</p>
          <p style="margin:6px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(m.wiki || m.name)}">Wiki →</a></p>
        </div>`;
      }).join('')}

      ${cluesSection(f2p)}
    `;
  }

  function cluesSection(f2p) {
    if (typeof CLUES === 'undefined') return '';
    const tiers = CLUES.filter(c => !f2p || c.f2p);
    const counts = (currentStats && currentStats.clues) || {};
    const totalDone = Object.values(counts).reduce((s, n) => s + (n || 0), 0);
    return `
      <h3 style="margin-top:22px;">🗺️ Clue Scrolls (Treasure Trails)${totalDone ? ` — <span style="color:var(--pink-600);">${NUM(totalDone)} completed</span>` : ''}</h3>
      <p style="color:var(--text-soft);">A steady side activity: gp, cosmetics, and a few real upgrades (Ranger boots, god books). Grab a Clue Scroll plugin to track steps. ✨</p>
      <div class="grid-3">
        ${tiers.map(c => {
          const done = counts[c.womKey];
          return `
          <div class="card">
            <div class="card-header">
              <div class="card-title">${c.icon} ${esc(c.tier)} clue${c.f2p ? ' <span class="tag green" style="font-size:10px;">F2P</span>' : ' <span class="tag purple" style="font-size:10px;">MEMBERS</span>'}</div>
              ${done != null ? `<span class="tag gold">${NUM(done)} done</span>` : `<span class="tag">${esc(c.steps)} steps</span>`}
            </div>
            <p style="margin:4px 0;font-size:13px;"><strong>Rewards:</strong> ${esc(c.rewards)}</p>
            <p style="margin:4px 0;font-size:13px;color:var(--text-soft);"><strong>Where:</strong> ${esc(c.source)}</p>
            <p style="margin:6px 0 0;color:var(--text-soft);">${esc(c.why)}</p>
            <p style="margin:8px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI('Treasure Trails')}">Treasure Trails guide →</a></p>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  // ============ GEAR ============
  function renderGear() {
    const el = sectionEl('gear');
    const melee = Recommender.gearForLevel('melee', currentStats);
    const ranged = Recommender.gearForLevel('ranged', currentStats);
    const magic = Recommender.gearForLevel('magic', currentStats);

    function gearTable(title, set) {
      const slots = ['weapon','head','body','legs','boots','gloves','amulet','ring','cape'];
      return `
        <h3>${title}</h3>
        <table class="method-table">
          <tr><th>Slot</th><th>Best you can wear now</th><th>Where to get</th><th>Notes</th></tr>
          ${slots.map(slot => {
            const g = set[slot];
            return `<tr>
              <td>${slot}</td>
              <td>${g ? esc(g.item) : '<em>—</em>'}</td>
              <td>${g && g.where ? esc(g.where) : ''}</td>
              <td style="font-size:12px;color:var(--text-soft);">${g && g.notes ? esc(g.notes) : ''}</td>
            </tr>`;
          }).join('')}
        </table>
      `;
    }

    el.innerHTML = `
      <h2>🛡️ Gear Progression</h2>
      <p style="color:var(--text-soft);">Best items you can equip right now, by combat style. ✨</p>
      ${gearTable('⚔️ Melee', melee)}
      ${gearTable('🏹 Ranged', ranged)}
      ${gearTable('🔮 Magic', magic)}
    `;
  }

  // ============ DIARIES ============
  function renderDiaries() {
    const el = sectionEl('diaries');
    el.innerHTML = `
      <h2>📔 Achievement Diaries — Easy Tier</h2>
      <p style="color:var(--text-soft);">Easy diaries give HUGE rewards for beginners. Check tasks off as you do them — saved locally.</p>
      ${DIARIES_EASY.map((d, idx) => `
        <div class="card">
          <div class="card-header">
            <div class="card-title">📔 ${esc(d.region)} (${esc(d.tier)})</div>
            <span class="tag gold">REWARD</span>
          </div>
          <p style="margin:4px 0 12px;color:var(--text-soft);">${esc(d.reward)}</p>
          ${d.tasks.map((task, i) => {
            const id = `diary_${d.region.toLowerCase().replace(/\W+/g,'_')}_${i}`;
            return `
              <div class="task-row" style="margin-bottom:4px;">
                <div class="task-check ${isChecked(id) ? 'checked' : ''}" onclick="UI.toggleDiary('${id}')"></div>
                <div class="task-body"><div class="task-label" style="font-weight:500;font-size:13px;">${esc(task)}</div></div>
              </div>
            `;
          }).join('')}
          <p style="margin:10px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(d.region + ' Diary')}">Wiki guide →</a></p>
        </div>
      `).join('')}
    `;
  }

  function isChecked(id) {
    try { return localStorage.getItem('bvels10_diary_' + id) === '1'; } catch { return false; }
  }
  function toggleDiary(id) {
    const k = 'bvels10_diary_' + id;
    if (localStorage.getItem(k) === '1') localStorage.removeItem(k);
    else localStorage.setItem(k, '1');
    renderDiaries();
  }

  // ============ PLUGINS ============
  function renderPlugins() {
    const el = sectionEl('plugins');
    el.innerHTML = `
      <h2>🔌 RuneLite Plugins</h2>
      <p style="color:var(--text-soft);">
        Open RuneLite → Configuration (wrench icon) → toggle these on. Plugin Hub plugins need the "Plugin Hub" panel to install. ✨
      </p>
      ${PLUGINS.map(p => `
        <div class="card">
          <div class="card-header">
            <div class="card-title">🔌 ${esc(p.name)}</div>
            <span class="tag ${p.priority === 'MUST-HAVE' ? 'gold' : p.priority === 'HIGH' ? 'green' : 'purple'}">${esc(p.priority)}</span>
          </div>
          <p style="margin:6px 0 4px;"><strong>What:</strong> ${esc(p.what)}</p>
          <p style="margin:4px 0;"><strong>Why:</strong> ${esc(p.why)}</p>
          <p style="margin:4px 0;color:var(--text-soft);font-size:13px;"><strong>How:</strong> ${esc(p.how)}</p>
        </div>
      `).join('')}
    `;
  }

  // ============ RULES ============
  function renderRules() {
    const el = sectionEl('rules');
    el.innerHTML = `
      <h2>📖 Golden Rules</h2>
      <p style="color:var(--text-soft);">Hard-won wisdom for surviving OSRS. ✨</p>
      <div class="grid">
        ${GOLDEN_RULES.map(r => `
          <div class="card">
            <div class="card-title">${esc(r.rule)}</div>
            <p style="margin:6px 0 0;color:var(--text-soft);">${esc(r.detail)}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ============ KEYS ============
  function renderKeys() {
    const el = sectionEl('keys');
    el.innerHTML = `
      <h2>⌨️ Keybinds & UI Tips</h2>
      <p style="color:var(--text-soft);">Set these in Settings → Controls (F-keys). Huge QoL. ✨</p>
      <table class="method-table">
        <tr><th>Keys</th><th>What it does</th></tr>
        ${KEYBINDS.map(k => `<tr><td><kbd style="background:var(--pink-100);padding:2px 8px;border-radius:6px;font-family:monospace;font-weight:700;">${esc(k.key)}</kbd></td><td>${esc(k.what)}</td></tr>`).join('')}
      </table>
    `;
  }

  // ============ JOURNAL ============
  function renderJournal() {
    const el = sectionEl('journal');
    const entries = Journal.all();
    el.innerHTML = `
      <h2>📓 Progress Journal</h2>
      <p style="color:var(--text-soft);">Auto-logged level-ups, big XP gains, and tasks. ✨</p>
      ${entries.length === 0 ? '<p style="color:var(--text-soft);">Nothing logged yet — your gains will appear here as you play.</p>' : ''}
      ${entries.slice(0, 100).map(e => `
        <div class="journal-entry ${e.milestone ? 'milestone' : ''}">
          <span class="ts">${new Date(e.ts).toLocaleString()}</span><br>
          ${esc(e.text)}
        </div>
      `).join('')}
      ${entries.length ? `<button class="btn btn-soft" style="margin-top:14px;" onclick="if(confirm('Clear journal?')) { Journal.clear(); UI.renderAllPublic(); }">Clear journal</button>` : ''}
    `;
  }

  // ============ NOTES ============
  function renderNotes() {
    const el = sectionEl('notes');
    const saved = localStorage.getItem('bvels10_notes') || '';
    el.innerHTML = `
      <h2>📝 My Notes</h2>
      <p style="color:var(--text-soft);">A scratchpad just for you. Saves automatically. 💕</p>
      <textarea id="notes-pad" placeholder="dump your thoughts, goals, drop logs, anything…">${esc(saved)}</textarea>
    `;
    setTimeout(() => {
      const pad = document.getElementById('notes-pad');
      if (pad) pad.addEventListener('input', () => localStorage.setItem('bvels10_notes', pad.value));
    }, 0);
  }

  // ---------- toast ----------
  function toast(msg) {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 7000);
  }

  // ---------- panic modal ----------
  function showPanic() {
    if (!currentStats) { toast('Loading your stats… try again in a sec 💕'); return; }
    const completed = completedSet();
    const recs = Recommender.topRecommendations(currentStats, completed).slice(0, 3);
    const html = `
      <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
        <div class="modal">
          <h3>💡 What you should do right now</h3>
          <p style="color:var(--text-soft);">Based on your stats this very moment. Pick whichever feels fun. 💕</p>
          ${recs.map(r => `
            <div style="margin:10px 0;padding:12px;background:var(--pink-50);border-radius:12px;">
              <div style="font-weight:700;">${r.icon} ${esc(r.title)}</div>
              <div style="color:var(--text-soft);font-size:13px;margin-top:4px;">${esc(r.detail || '')}</div>
            </div>
          `).join('')}
          <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">close ✨</button>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  }

  // ---------- Bulk Quest Editor ----------
  function showBulkQuestEditor() {
    const done = loadCompletedQuests();
    // Combined unique list: ALL_QUESTS_FLAT + any from QUESTS not already there
    const all = [...ALL_QUESTS_FLAT];
    const seen = new Set(all.map(q => q.name.toLowerCase()));
    for (const q of QUESTS) {
      if (!seen.has(q.name.toLowerCase())) {
        all.push({ name: q.name, members: q.members, tier: q.length === 'Very short' ? 'novice' : 'intermediate' });
      }
    }
    all.sort((a, b) => a.name.localeCompare(b.name));

    const html = `
      <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
        <div class="modal" style="max-width:720px;max-height:90vh;display:flex;flex-direction:column;">
          <h3>📝 Mark Completed Quests</h3>
          <p style="color:var(--text-soft);font-size:13px;margin:0 0 8px;">
            Tick every quest she's already finished. Saves instantly. Recommendations update when you close. 💕
          </p>
          <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
            <input id="quest-search" placeholder="🔍 search…" oninput="UI.filterQuestEditor()"
                   style="flex:1;min-width:200px;padding:6px 12px;border-radius:999px;border:1px solid var(--card-border);">
            <button class="btn btn-soft" style="font-size:12px;padding:4px 12px;" onclick="UI.bulkQuestFilter('all')">All</button>
            <button class="btn btn-soft" style="font-size:12px;padding:4px 12px;" onclick="UI.bulkQuestFilter('f2p')">F2P</button>
            <button class="btn btn-soft" style="font-size:12px;padding:4px 12px;" onclick="UI.bulkQuestFilter('members')">Members</button>
            <button class="btn btn-soft" style="font-size:12px;padding:4px 12px;" onclick="UI.bulkQuestFilter('done')">Done</button>
          </div>
          <div id="quest-editor-list" style="flex:1;overflow-y:auto;border:1px solid var(--card-border);border-radius:12px;padding:6px;">
            ${all.map(q => {
              const id = questNameToId(q.name);
              const isDone = done.has(id);
              return `
                <label class="quest-edit-row" data-name="${esc(q.name.toLowerCase())}" data-mem="${q.members ? '1' : '0'}" data-done="${isDone ? '1' : '0'}"
                       style="display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;cursor:pointer;">
                  <input type="checkbox" ${isDone ? 'checked' : ''} onchange="UI.toggleBulkQuest('${id}', this.checked)"
                         style="width:18px;height:18px;accent-color:var(--pink-500);">
                  <span style="flex:1;font-weight:500;font-size:14px;">${esc(q.name)}</span>
                  <span class="tag ${q.members ? 'purple' : 'green'}" style="font-size:10px;">${q.members ? 'M' : 'F2P'}</span>
                  <span class="tag" style="font-size:10px;background:#eee;color:#666;">${esc(q.tier)}</span>
                </label>
              `;
            }).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
            <button class="modal-close" style="margin:0;" onclick="if(confirm('Uncheck ALL quests?')) UI.resetBulkQuests()">Reset all</button>
            <button class="btn" onclick="this.closest('.modal-backdrop').remove(); UI.refreshAfterBulkEdit();">Done ✨</button>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  }

  function toggleBulkQuest(id, isChecked) {
    const set = loadCompletedQuests();
    if (isChecked) set.add(id); else set.delete(id);
    saveCompletedQuests(set);
    // update the row's data-done so filters work right
    const row = document.querySelector(`.quest-edit-row input[onchange*="${id}'"]`)?.closest('.quest-edit-row');
    if (row) row.dataset.done = isChecked ? '1' : '0';
  }

  function filterQuestEditor() {
    const q = (document.getElementById('quest-search')?.value || '').toLowerCase().trim();
    document.querySelectorAll('.quest-edit-row').forEach(row => {
      const match = !q || row.dataset.name.includes(q);
      row.style.display = match && !row.dataset.hidden ? '' : 'none';
    });
  }

  function bulkQuestFilter(mode) {
    document.querySelectorAll('.quest-edit-row').forEach(row => {
      let show = true;
      if (mode === 'f2p')     show = row.dataset.mem === '0';
      if (mode === 'members') show = row.dataset.mem === '1';
      if (mode === 'done')    show = row.dataset.done === '1';
      row.dataset.hidden = show ? '' : '1';
      row.style.display = show ? '' : 'none';
    });
    filterQuestEditor();
  }

  function resetBulkQuests() {
    saveCompletedQuests(new Set());
    document.querySelector('.modal-backdrop')?.remove();
    showBulkQuestEditor();
  }

  function refreshAfterBulkEdit() {
    renderAll();
    toast('💖 Quest list updated! Check the Next Up tab for new recommendations.');
  }

  // ---------- Manual stat entry modal ----------
  function showManualEntry() {
    const existing = Hiscores.loadManual() || (currentStats ? { name: currentStats.name, ...currentStats.skills } : {});
    const skillsObj = existing.skills || existing;
    const html = `
      <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
        <div class="modal" style="max-width:560px;max-height:90vh;overflow-y:auto;">
          <h3>✏️ Enter Your Stats Manually</h3>
          <p style="color:var(--text-soft);font-size:13px;">
            Use this if Hiscores isn't loading. Type her current level for each skill — XP is calculated for you.
            Saves automatically. 💕
          </p>
          <div style="margin:10px 0;">
            <label style="font-size:12px;color:var(--text-soft);font-weight:700;">DISPLAY NAME</label><br>
            <input id="manual-name" value="${esc(existing.name || currentStats?.name || 'bvels10')}"
                   style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--card-border);font-family:var(--font-body);font-weight:600;">
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
            ${SKILL_META.map(m => {
              const cur = (skillsObj[m.id]?.level) || 1;
              return `
                <label style="display:flex;align-items:center;gap:6px;background:var(--pink-50);padding:6px 8px;border-radius:8px;">
                  <span style="font-size:14px;">${m.icon}</span>
                  <span style="font-size:12px;font-weight:600;flex:1;">${esc(m.name)}</span>
                  <input type="number" min="1" max="99" value="${cur}" id="manual-${m.id}"
                    style="width:48px;text-align:center;border:1px solid var(--card-border);border-radius:6px;padding:2px;font-weight:700;color:var(--pink-600);">
                </label>
              `;
            }).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button class="btn" onclick="UI.saveManualEntry()">💖 Save & use these stats</button>
            <button class="modal-close" onclick="UI.clearManualEntry()" style="margin:0;">Clear manual</button>
            <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()" style="margin:0;">Cancel</button>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  }

  function saveManualEntry() {
    const stats = { name: (document.getElementById('manual-name').value || 'bvels10').trim() };
    for (const m of SKILL_META) {
      const lvl = parseInt(document.getElementById('manual-' + m.id).value) || 1;
      stats[m.id] = { level: Math.max(1, Math.min(99, lvl)) };
    }
    Hiscores.saveManual(stats);
    const loaded = Hiscores.loadManual();
    UI.setStats(loaded, null);
    document.querySelector('.modal-backdrop')?.remove();
    toast('💖 Stats saved! Recommendations updated.');
  }

  function clearManualEntry() {
    Hiscores.clearManual();
    document.querySelector('.modal-backdrop')?.remove();
    toast('Manual stats cleared — reverting to live Hiscores 💕');
    // App will refetch on next interval; trigger immediately
    if (window.AppBoot) window.AppBoot.refetch();
  }

  // ============ DAILIES ============
  function renderDailies() {
    const el = sectionEl('dailies');
    const completed = completedSet();
    const items = DailyChecklist.eligibleItems(currentStats, completed);
    const today = DailyChecklist.getTodayState();
    const streak = DailyChecklist.getStreak();
    el.innerHTML = `
      <h2>📅 Daily Checklist</h2>
      <p style="color:var(--text-soft);">
        Resets at midnight. Streak: <strong>🔥 ${streak.count} day${streak.count === 1 ? '' : 's'}</strong> ✨
      </p>
      ${['farm','profit','pvm','minigame','maint','fun'].map(cat => {
        const catItems = items.filter(i => i.category === cat);
        if (!catItems.length) return '';
        const labels = { farm: '🌿 Farm runs', profit: '💰 Profit', pvm: '⚔️ PvM', minigame: '🎮 Minigames', maint: '🔧 Maintenance', fun: '💕 Fun' };
        return `
          <h3>${labels[cat]}</h3>
          ${catItems.map(i => `
            <div class="task-row ${today[i.id] ? 'done' : ''}">
              <div class="task-check ${today[i.id] ? 'checked' : ''}" onclick="UI.toggleDaily('${i.id}')"></div>
              <div class="task-body">
                <div class="task-label">${i.icon} ${esc(i.name)}</div>
                <div class="task-meta">${esc(i.why)}</div>
              </div>
            </div>
          `).join('')}
        `;
      }).join('')}
      <p style="color:var(--text-faint);font-size:12px;margin-top:24px;">Items grayed out = you don't meet the reqs yet. Train up to unlock them ✨</p>
    `;
  }

  function toggleDaily(id) {
    DailyChecklist.toggle(id);
    renderDailies();
    renderHeader();
  }

  // ============ GOALS ============
  function renderGoals() {
    const el = sectionEl('goals');
    const active = Goals.active();
    const done = Goals.all().filter(g => g.completed);
    el.innerHTML = `
      <h2>🎯 Goals</h2>
      <p style="color:var(--text-soft);">Set custom targets. ETA estimates use weekly XP gains. ✨</p>

      <div class="card">
        <div class="card-title">➕ Add a skill goal</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;">
          <select id="goal-skill" style="padding:6px 12px;border-radius:999px;border:1px solid var(--card-border);font-family:var(--font-body);font-weight:600;">
            ${SKILL_META.map(m => `<option value="${m.id}">${m.icon} ${m.name}</option>`).join('')}
          </select>
          <input type="number" id="goal-level" min="1" max="99" placeholder="target lvl"
            style="width:90px;padding:6px 12px;border-radius:999px;border:1px solid var(--card-border);">
          <input type="date" id="goal-deadline" style="padding:6px 12px;border-radius:999px;border:1px solid var(--card-border);">
          <button class="btn" onclick="UI.addSkillGoal()">+ Add</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <input id="goal-task" placeholder="…or add a custom goal (e.g. 'get Fire Cape')"
            style="flex:1;padding:8px 16px;border-radius:999px;border:1px solid var(--card-border);">
          <button class="btn" onclick="UI.addTaskGoal()">+ Custom</button>
        </div>
      </div>

      <h3>Active (${active.length})</h3>
      ${active.length === 0 ? '<p style="color:var(--text-soft);">No goals yet — set one above! ✨</p>' : ''}
      ${active.map(g => goalCard(g)).join('')}

      ${done.length ? `<h3>Completed (${done.length})</h3>${done.slice(-10).map(g => goalCard(g)).join('')}` : ''}
    `;
  }

  function goalCard(g) {
    let etaText = '';
    if (g.type === 'skill') {
      const m = SKILL_META.find(mm => mm.id === g.skill);
      const sk = currentStats.skills[g.skill];
      const xpNeeded = Math.max(0, xpForLevel(g.targetLevel) - (sk?.xp || 0));
      etaText = xpNeeded === 0
        ? '🎉 Already at target!'
        : `${(xpNeeded).toLocaleString()} XP to go`;
    }
    const dl = Goals.deadlineStatus(g);
    return `
      <div class="card" style="${g.completed ? 'opacity:0.55;' : ''}">
        <div class="card-header">
          <div class="card-title">
            <div class="task-check ${g.completed ? 'checked' : ''}" onclick="UI.toggleGoal('${g.id}')" style="display:inline-flex;"></div>
            <span>${Goals.describe(g)}</span>
          </div>
          <button class="task-delete" onclick="UI.removeGoal('${g.id}')">×</button>
        </div>
        ${etaText ? `<p style="margin:6px 0 0;color:var(--text-soft);">${etaText}</p>` : ''}
        ${dl ? `<p style="margin:4px 0 0;font-size:12px;color:${dl.days < 0 ? '#c43a3a' : 'var(--text-soft)'};">
          ${dl.days < 0 ? `⏰ Overdue by ${-dl.days} days` : dl.days === 0 ? '⏰ Due today!' : `⏰ ${dl.days} days left (${dl.dueDate})`}
        </p>` : ''}
      </div>
    `;
  }

  function addSkillGoal() {
    const skill = document.getElementById('goal-skill').value;
    const level = document.getElementById('goal-level').value;
    const deadline = document.getElementById('goal-deadline').value;
    if (!level) { toast('💔 Pick a target level'); return; }
    Goals.addSkillGoal(skill, level, deadline);
    renderGoals();
  }
  function addTaskGoal() {
    const text = document.getElementById('goal-task').value;
    if (!text.trim()) return;
    Goals.addTaskGoal(text);
    document.getElementById('goal-task').value = '';
    renderGoals();
  }
  function toggleGoal(id) {
    Goals.toggle(id);
    renderGoals();
    Confetti.fire();
  }
  function removeGoal(id) { Goals.remove(id); renderGoals(); }

  // ============ PETS ============
  function renderPets() {
    const el = sectionEl('pets');
    el.innerHTML = `
      <h2>🐾 Pet Collection</h2>
      <p style="color:var(--text-soft);">Cute companions and their drop rates ✨</p>
      <div class="grid">
        ${PETS.map(p => `
          <div class="card">
            <div class="card-title">${p.icon} ${esc(p.name)}</div>
            <p style="margin:4px 0;font-size:13px;"><strong>From:</strong> ${esc(p.source)}</p>
            <p style="margin:4px 0;font-size:13px;color:var(--text-soft);"><strong>Rate:</strong> ${esc(p.rate)}</p>
            <p style="margin:6px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(p.wiki)}">Wiki →</a></p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ============ MUSIC ============
  function renderMusic() {
    const el = sectionEl('music');
    el.innerHTML = `
      <h2>🎵 Music Cape Highlights</h2>
      <p style="color:var(--text-soft);">Notable tracks worth unlocking — the music cape is a hidden cosmetic goal. ✨</p>
      <table class="method-table">
        <tr><th>Track</th><th>Where to unlock</th><th>Category</th></tr>
        ${MUSIC_TRACKS.map(t => `
          <tr>
            <td><strong>${esc(t.name)}</strong></td>
            <td>${esc(t.where)}</td>
            <td><span class="tag">${esc(t.category)}</span></td>
          </tr>
        `).join('')}
      </table>
      <p style="color:var(--text-faint);font-size:12px;margin-top:14px;">There are ~800 tracks total. Use RuneLite's Music plugin to track unlocks.</p>
    `;
  }

  // ============ SLAYER ============
  function renderSlayer() {
    const el = sectionEl('slayer');
    const slLvl = currentStats.skills.slayer?.level || 1;
    el.innerHTML = `
      <h2>💀 Slayer Assistant</h2>
      <p style="color:var(--text-soft);">Your Slayer: <strong>level ${slLvl}</strong>. Monsters you can task right now ✨</p>
      <div class="grid">
        ${SLAYER_MONSTERS.filter(m => m.reqs.slayer <= slLvl).map(m => `
          <div class="card">
            <div class="card-header">
              <div class="card-title">💀 ${esc(m.name)}</div>
              <span class="tag green">Slayer ${m.reqs.slayer}</span>
            </div>
            <p style="margin:4px 0;font-size:13px;"><strong>Where:</strong> ${esc(m.location)}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Gear:</strong> ${esc(m.gear)}</p>
            <p style="margin:6px 0 0;color:var(--text-soft);font-size:13px;">${esc(m.tips)}</p>
          </div>
        `).join('')}
      </div>
      ${SLAYER_MONSTERS.filter(m => m.reqs.slayer > slLvl).length ? `
        <h3>🔒 Locked (level up to unlock)</h3>
        <div class="grid">
          ${SLAYER_MONSTERS.filter(m => m.reqs.slayer > slLvl).slice(0, 6).map(m => `
            <div class="card" style="opacity:0.6;">
              <div class="card-header">
                <div class="card-title">💀 ${esc(m.name)}</div>
                <span class="tag locked">Slayer ${m.reqs.slayer}</span>
              </div>
              <p style="margin:4px 0;font-size:13px;">${esc(m.location)}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ============ LOADOUTS ============
  function renderLoadouts() {
    const el = sectionEl('loadouts');
    el.innerHTML = `
      <h2>🎒 Boss Loadouts</h2>
      <p style="color:var(--text-soft);">Exact gear + inventory for each boss. Copy-paste into your bank tags. ✨</p>
      ${Object.entries(BOSS_LOADOUTS).map(([id, l]) => `
        <div class="card">
          <div class="card-title">🎒 ${esc(l.boss)}</div>
          <p style="margin:6px 0;"><strong>👕 Gear:</strong></p>
          <ul style="margin:4px 0;padding-left:22px;font-size:13px;">
            ${l.gear.map(g => `<li>${esc(g)}</li>`).join('')}
          </ul>
          <p style="margin:6px 0;"><strong>🎒 Inventory:</strong></p>
          <ul style="margin:4px 0;padding-left:22px;font-size:13px;">
            ${l.inventory.map(i => `<li>${esc(i)}</li>`).join('')}
          </ul>
          <p style="margin:8px 0 0;padding:8px 12px;background:var(--pink-50);border-left:3px solid var(--pink-400);border-radius:8px;font-size:13px;"><strong>💡 Notes:</strong> ${esc(l.notes)}</p>
        </div>
      `).join('')}
    `;
  }

  // ============ FULL DIARIES TAB ============
  function renderDiariesTab() {
    const el = sectionEl('diariestab');
    el.innerHTML = `
      <h2>📔 Achievement Diaries (All Regions)</h2>
      <p style="color:var(--text-soft);">Each tier unlocks better rewards. Detailed task lists on wiki. ✨</p>
      ${DIARIES.map(d => `
        <div class="card">
          <div class="card-title">${d.icon} ${esc(d.region)}</div>
          ${d.tiers.map(t => `
            <details style="margin:8px 0;border:1px solid var(--pink-100);border-radius:10px;padding:10px;">
              <summary style="cursor:pointer;font-weight:700;color:${t.tier === 'Elite' ? '#b08400' : 'var(--text)'};">
                ${t.tier} (${t.tasks} tasks)
              </summary>
              <p style="margin:6px 0;color:var(--text-soft);font-size:13px;">${esc(t.reward)}</p>
              <a class="wiki-link" target="_blank" href="${WIKI(t.wiki)}">Wiki task list →</a>
            </details>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  // ============ MINIGAMES ============
  function formatMiniGap(gap) {
    if (!gap || !gap.missing) return '';
    return gap.missing.map(x => {
      if (x.kind === 'combat') return `Combat ${x.need}`;
      if (x.kind === 'skill')  return `${x.icon || ''} ${x.name} ${x.need}`;
      if (x.kind === 'quest')  return `Quest: ${x.name}`;
      return '';
    }).filter(Boolean).join(' · ');
  }

  function minigameCard(m, lockedMode) {
    const grows = Array.isArray(m.grows) ? m.grows.join(', ') : m.grows;
    const gap = lockedMode && m._gap ? formatMiniGap(m._gap) : '';
    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${m.icon} ${esc(m.name)}</div>
          <span class="tag ${lockedMode ? 'locked' : 'ready'}">${lockedMode ? 'LOCKED' : 'READY ✨'}</span>
        </div>
        <p class="card-sub" style="margin:4px 0 6px;">${esc(m.why)}</p>
        <p style="margin:2px 0;font-size:13px;"><strong>Grows:</strong> ${esc(grows)}</p>
        ${m.unlocks ? `<p style="margin:2px 0;font-size:13px;"><strong>Unlocks:</strong> ${esc(m.unlocks)}</p>` : ''}
        ${m.gp && m.gp !== '—' ? `<p style="margin:2px 0;font-size:13px;"><strong>gp:</strong> ${esc(m.gp)}</p>` : ''}
        ${m.questNote ? `<p style="margin:2px 0;font-size:13px;color:var(--text-soft);"><strong>Also needs:</strong> ${esc(m.questNote)}</p>` : ''}
        ${gap ? `<p style="margin:2px 0;font-size:13px;color:var(--pink-600);"><strong>Unlock at:</strong> ${gap}</p>` : ''}
        ${m.how ? `<p style="margin:6px 0 0;font-size:13px;color:var(--text-soft);"><em>How:</em> ${esc(m.how)}</p>` : ''}
        <p style="margin:8px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(m.wiki || m.name)}">Wiki →</a></p>
      </div>`;
  }

  function renderMinigames() {
    const el = sectionEl('minigames');
    const completed = completedSet();
    const ready = Recommender.readyMinigames(currentStats, completed);
    const locked = Recommender.lockedMinigames(currentStats, completed);
    el.innerHTML = `
      <h2>🎮 Minigames</h2>
      <p style="color:var(--text-soft);">
        Minigames are some of the best ways to <strong>grow your account</strong> — fast XP, gear you can't get anywhere else (Void, Fighter torso, Fire cape, outfits), and gp. The ones below are unlocked at <em>your</em> current stats. ✨
      </p>
      <h3>✅ Ready now (${ready.length})</h3>
      <div class="grid-3">${ready.map(m => minigameCard(m, false)).join('') || '<p>Train up a little to unlock your first minigames!</p>'}</div>
      <h3>🔒 Coming up (closest first)</h3>
      <div class="grid-3">${locked.map(m => minigameCard(m, true)).join('') || '<p>You\'ve unlocked them all! 🎉</p>'}</div>
    `;
  }

  // ============ PATH / ROADMAP ============
  const ROADMAP_DONE_KEY = 'bvels10_roadmap_done_v1';
  function loadRoadmapDone() { try { return new Set(JSON.parse(localStorage.getItem(ROADMAP_DONE_KEY) || '[]')); } catch { return new Set(); } }
  function saveRoadmapDone(set) { localStorage.setItem(ROADMAP_DONE_KEY, JSON.stringify([...set])); }

  function toggleRoadmapStep(id) {
    const s = loadRoadmapDone();
    const nowDone = !s.has(id);
    if (s.has(id)) s.delete(id); else s.add(id);
    saveRoadmapDone(s);
    toast(nowDone ? '✅ Checked off your Path' : '↩ Un-checked');
    renderPath();
    renderNext();
    renderHistory();
  }

  function questDoneByName(completed, name) {
    if (completed.has(questNameToId(name))) return true;
    const q = QUESTS.find(x => x.name === name);
    return !!(q && completed.has(q.id));
  }

  // null = no detectable condition (manual-only); else true/false.
  // Conditions are OR'd: any single indicator counts the step done (e.g. Waterfall
  // is done if the quest is marked OR att/str are already 30). `quests` requires all.
  function roadmapStepAutoDone(step, ctx) {
    let has = false, any = false;
    if (step.quest)  { has = true; if (questDoneByName(ctx.completed, step.quest)) any = true; }
    if (step.quests) { has = true; if (step.quests.every(n => questDoneByName(ctx.completed, n))) any = true; }
    if (step.skill)  { has = true; if (Object.entries(step.skill).every(([sid, lvl]) => (ctx.lvl[sid] || 1) >= lvl)) any = true; }
    if (step.combat != null) { has = true; if (ctx.combat >= step.combat) any = true; }
    if (step.boss)   { has = true; if (ctx.bossKc[step.boss] > 0) any = true; }
    return has ? any : null;
  }
  function roadmapStepDone(step, ctx) {
    if (ctx.manual.has(step.id)) return true;
    return roadmapStepAutoDone(step, ctx) === true;
  }

  function roadmapCtx() {
    const lvl = {};
    for (const m of SKILL_META) lvl[m.id] = currentStats.skills[m.id]?.level || 1;
    const combat = combatLevel(Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, lvl[m.id]])));
    return { lvl, combat, completed: completedSet(), bossKc: currentStats.bossKc || {}, manual: loadRoadmapDone() };
  }

  // The single next step on the path (first not-done), for banners elsewhere.
  function nextPathStep() {
    if (typeof ROADMAP === 'undefined' || !currentStats) return null;
    const ctx = roadmapCtx();
    for (const ph of ROADMAP) for (const st of ph.steps) {
      if (!roadmapStepDone(st, ctx)) return { step: st, phase: ph };
    }
    return null;
  }

  function renderPath() {
    const el = sectionEl('path');
    const ctx = roadmapCtx();
    let total = 0, doneCount = 0;
    let current = null;
    // first pass: counts + current step
    for (const ph of ROADMAP) for (const st of ph.steps) {
      total++;
      if (roadmapStepDone(st, ctx)) doneCount++;
      else if (!current) current = st;
    }
    const pct = total ? Math.round((doneCount / total) * 100) : 0;

    const phaseHtml = ROADMAP.map(ph => {
      const phSteps = ph.steps.map(st => {
        const done = roadmapStepDone(st, ctx);
        const isCurrent = st === current;
        const auto = roadmapStepAutoDone(st, ctx);
        // auto===true means your stats/quests/KC already prove it — locked done.
        // Otherwise it's yours to check off (manual step, or an override).
        const canToggle = auto !== true;
        const toggleAttr = canToggle ? `onclick="UI.toggleRoadmapStep('${st.id}')" style="cursor:pointer;"` : `title="Auto-completed from your stats, quests or boss KC" style="cursor:default;"`;
        const hint = !done && canToggle
          ? '<span style="color:var(--text-faint);">done it? tap to check off · </span>'
          : (done && auto === true ? '<span style="color:var(--text-faint);">✓ auto-completed from your account · </span>' : '');
        return `
          <div class="card" style="padding:10px 14px;margin:6px 0;${isCurrent ? 'border:2px solid var(--pink-400);box-shadow:0 2px 14px rgba(232,56,138,0.18);' : ''}${done ? 'opacity:.7;' : ''}">
            <div style="display:flex;align-items:flex-start;gap:12px;">
              <div class="task-check${done ? ' checked' : ''}" ${toggleAttr} title="${done ? (canToggle ? 'Mark not done' : 'Auto-completed from your account') : 'Mark done'}"></div>
              <div style="flex:1;${canToggle ? 'cursor:pointer;' : ''}" ${canToggle ? `onclick="UI.toggleRoadmapStep('${st.id}')"` : ''}>
                <div style="font-weight:700;${done ? 'text-decoration:line-through;' : ''}">${esc(st.label)}${isCurrent ? ' <span class="tag gold" style="font-size:10px;">YOU ARE HERE</span>' : ''}</div>
                <div style="color:var(--text-soft);font-size:13px;margin-top:2px;">${esc(st.detail || '')}</div>
                <div style="margin-top:4px;font-size:12px;">
                  ${hint}
                  ${st.wiki ? `<a class="wiki-link" target="_blank" href="${WIKI(st.wiki)}" onclick="event.stopPropagation();">Wiki →</a>` : ''}
                </div>
              </div>
            </div>
          </div>`;
      }).join('');
      const phDone = ph.steps.every(st => roadmapStepDone(st, ctx));
      return `
        <div style="margin:18px 0 4px;">
          <h3 style="margin-bottom:2px;">${ph.icon} ${esc(ph.phase)} ${phDone ? '✅' : ''}</h3>
          <p style="color:var(--text-soft);margin:0 0 6px;">${esc(ph.goal)}</p>
          ${phSteps}
        </div>`;
    }).join('');

    el.innerHTML = `
      <h2>🧭 Your Path to a Bossing Main</h2>
      <p style="color:var(--text-soft);">The efficient, ordered route from here to endgame PvM. Steps auto-complete from your stats, quests, and boss KC — tap any ⬜/✅ to override. ✨</p>
      <div class="card" style="background:linear-gradient(135deg,var(--pink-50),#fff8d0);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
          <div style="font-weight:800;color:var(--pink-600);">Overall progress: ${doneCount}/${total} steps (${pct}%)</div>
          <div style="flex:1;min-width:160px;max-width:340px;height:14px;background:#fff;border-radius:999px;overflow:hidden;border:1px solid var(--card-border);">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--pink-400),var(--pink-500));"></div>
          </div>
        </div>
        ${current ? `<div style="margin-top:10px;font-size:14px;">▶️ <strong>Do this next:</strong> ${esc(current.label)}<br><span style="color:var(--text-soft);font-size:13px;">${esc(current.detail || '')}</span></div>` : '<div style="margin-top:10px;">🎉 You\'ve completed the whole roadmap — you\'re a bossing main! 💖</div>'}
      </div>
      ${phaseHtml}
    `;
  }

  // ============ UNLOCKS (outfits, slayer rewards, prayers/spellbooks) ============
  function renderUnlocks() {
    const el = sectionEl('unlocks');
    const lvl = id => currentStats.skills[id]?.level || 1;
    const outfits = (typeof SKILLING_OUTFITS !== 'undefined') ? SKILLING_OUTFITS : [];
    const slayer = (typeof SLAYER_UNLOCKS !== 'undefined') ? SLAYER_UNLOCKS : [];
    const power = (typeof POWER_UNLOCKS !== 'undefined') ? POWER_UNLOCKS : [];

    el.innerHTML = `
      <h2>🔓 Unlocks — outfits, Slayer rewards & power spikes</h2>
      <p style="color:var(--text-soft);">The permanent upgrades that compound: XP-boosting outfits, the Slayer reward shop, and the prayer/spellbook unlocks that define your DPS. ✨</p>

      <h3>👕 Skilling outfits</h3>
      <p style="color:var(--text-soft);font-size:13px;margin-top:-4px;">Wear the full set for the bonus. Grab the one for whatever you're grinding.</p>
      <div class="grid-3">
        ${outfits.map(o => `
          <div class="card">
            <div class="card-header"><div class="card-title">${o.icon} ${esc(o.name)}</div><span class="tag green">${esc(o.skill)}</span></div>
            <p style="margin:4px 0;font-size:13px;"><strong>Bonus:</strong> ${esc(o.bonus)}</p>
            <p style="margin:4px 0;font-size:13px;color:var(--text-soft);"><strong>From:</strong> ${esc(o.source)}</p>
          </div>`).join('')}
      </div>

      <h3 style="margin-top:18px;">💀 Slayer reward unlocks</h3>
      <p style="color:var(--text-soft);font-size:13px;margin-top:-4px;">Spend Slayer points here in roughly this order. You're Slayer ${lvl('slayer')}.</p>
      ${[1,2,3].map(p => {
        const items = slayer.filter(s => s.priority === p);
        if (!items.length) return '';
        const label = p === 1 ? 'Buy first' : p === 2 ? 'Then these' : 'Later / situational';
        return `<h4 style="margin:12px 0 4px;color:var(--text-soft);">${label}</h4>
          ${items.map(s => `
            <div class="task-row"><div class="task-body">
              <div class="task-label">${esc(s.name)} <span class="tag gold" style="font-size:10px;">${esc(s.cost)} pts</span></div>
              <div class="task-meta">${esc(s.why)}</div>
            </div></div>`).join('')}`;
      }).join('')}

      <h3 style="margin-top:18px;">🙏 Prayer & spellbook power unlocks</h3>
      <div class="grid-3">
        ${power.map(u => `
          <div class="card">
            <div class="card-header"><div class="card-title">${u.icon} ${esc(u.name)}</div><span class="tag purple">${esc(u.req)}</span></div>
            <p style="margin:4px 0;font-size:13px;">${esc(u.why)}</p>
            <p style="margin:4px 0;font-size:13px;color:var(--text-soft);"><em>How:</em> ${esc(u.how)}</p>
          </div>`).join('')}
      </div>
    `;
  }

  // ============ HISTORY (everything you've checked off) ============
  function deslug(s) {
    return String(s || '').replace(/^(near_|train_|mg_|lifetime_|endgame_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  // Resolve any completed id to a friendly name across all datasets.
  function resolveCompletedName(id) {
    const q = QUESTS.find(x => x.id === id); if (q) return q.name;
    const t = (typeof MASTER_TASKS !== 'undefined') && MASTER_TASKS.find(x => x.id === id); if (t) return t.name;
    const b = (typeof BOSSES !== 'undefined') && BOSSES.find(x => x.id === id); if (b) return b.name;
    const mg = (typeof MINIGAMES !== 'undefined') && MINIGAMES.find(x => x.id === id); if (mg) return mg.name;
    return deslug(id);
  }

  function historyRow(label, onUndo, sub) {
    return `
      <div class="task-row done" style="align-items:center;">
        <div class="task-check checked" style="cursor:default;"></div>
        <div class="task-body">
          <div class="task-label" style="text-decoration:none;">${esc(label)}</div>
          ${sub ? `<div class="task-meta">${esc(sub)}</div>` : ''}
        </div>
        <button class="btn btn-soft" style="font-size:12px;padding:4px 12px;" onclick="${onUndo}" title="Uncheck / undo">↩ Uncheck</button>
      </div>`;
  }

  function renderHistory() {
    const el = sectionEl('history');
    const completedQuests = [...loadCompletedQuests()];
    const completedRecsSet = loadCompletedRecs();
    const roadmapDone = [...loadRoadmapDone()];
    const doneTasks = TaskList.done();

    // Dismissed recs that aren't already shown as completed quests
    const recEntries = [...completedRecsSet].map(key => {
      const [, id] = String(key).split(':');
      return { key, id };
    }).filter(r => !loadCompletedQuests().has(r.id));

    // Diary checkboxes ticked (scan localStorage)
    const diaryIds = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('bvels10_diary_') && localStorage.getItem(k) === '1') diaryIds.push(k.slice('bvels10_diary_'.length));
      }
    } catch (_) {}

    const log = (typeof Journal !== 'undefined') ? Journal.all().slice(0, 40) : [];
    const totalDone = completedQuests.length + recEntries.length + roadmapDone.length + doneTasks.length + diaryIds.length;

    const section = (title, items, emptyMsg) => `
      <h3>${title} (${items.length})</h3>
      ${items.length ? items.join('') : `<p style="color:var(--text-soft);font-size:13px;">${emptyMsg}</p>`}`;

    el.innerHTML = `
      <h2>🗂️ History — everything you've checked off</h2>
      <p style="color:var(--text-soft);">A record of everything marked done across the app. Made a mistake? Hit <strong>↩ Uncheck</strong> on any item to undo it — it'll reappear where it came from. ✨</p>
      <div class="card" style="background:linear-gradient(135deg,var(--pink-50),#fff8d0);"><strong>${totalDone}</strong> things completed so far 💖</div>

      ${section('📜 Quests & milestones',
        completedQuests.map(id => historyRow(resolveCompletedName(id), `UI.undoCompletedQuest('${esc(id)}')`)),
        'No quests or milestones marked done yet.')}

      ${section('💖 Dismissed recommendations',
        recEntries.map(r => historyRow(resolveCompletedName(r.id), `UI.undoRec('${esc(r.key)}')`, 'was hidden from Next Up')),
        'No recommendations dismissed.')}

      ${section('🧭 Path steps ticked',
        roadmapDone.map(id => {
          let label = id;
          if (typeof ROADMAP !== 'undefined') for (const ph of ROADMAP) for (const st of ph.steps) if (st.id === id) label = st.label;
          return historyRow(label, `UI.undoRoadmap('${esc(id)}')`);
        }),
        'No Path steps manually checked off.')}

      ${section('✅ Finished to-dos',
        doneTasks.slice().reverse().map(t => historyRow(t.label, `UI.restoreTask('${esc(t.id)}')`)),
        'No to-dos completed yet.')}

      ${diaryIds.length ? `
        <details style="margin-top:14px;">
          <summary style="cursor:pointer;font-weight:700;color:var(--pink-600);">📔 Diary tasks ticked (${diaryIds.length})</summary>
          <div style="margin-top:8px;">
            ${diaryIds.map(id => historyRow(deslug(id), `UI.undoDiary('${esc(id)}')`)).join('')}
          </div>
        </details>` : ''}

      ${log.length ? `
        <h3 style="margin-top:20px;">📓 Activity log</h3>
        <div class="card">
          ${log.map(e => `<div style="padding:4px 0;border-bottom:1px solid var(--pink-50);font-size:13px;">${esc(e.text || e.label || '')}</div>`).join('')}
        </div>` : ''}
    `;
  }

  // ---- History undo handlers ----
  function undoCompletedQuest(id) {
    const set = loadCompletedQuests(); set.delete(id); saveCompletedQuests(set);
    // also clear any matching rec key so it isn't double-tracked
    const recs = loadCompletedRecs();
    for (const k of [...recs]) if (String(k).split(':')[1] === id) recs.delete(k);
    saveCompletedRecs(recs);
    Journal.add('undo', `↩ Un-marked: ${resolveCompletedName(id)}`, false);
    toast(`↩ Un-marked ${resolveCompletedName(id)}`);
    renderAll();
  }
  function undoRec(key) {
    const recs = loadCompletedRecs(); recs.delete(key); saveCompletedRecs(recs);
    toast('↩ Recommendation restored to Next Up');
    renderAll();
  }
  function undoRoadmap(id) {
    const s = loadRoadmapDone(); s.delete(id); saveRoadmapDone(s);
    toast('↩ Path step un-checked');
    renderAll();
  }
  function restoreTask(id) {
    TaskList.toggle(id);
    toast('↩ To-do moved back to open');
    renderAll();
  }
  function undoDiary(id) {
    try { localStorage.removeItem('bvels10_diary_' + id); } catch (_) {}
    toast('↩ Diary task un-ticked');
    renderAll();
  }

  // ============ AI ASSISTANT ============
  function renderAI() {
    const el = sectionEl('ai');
    const msgs = AIChat.all();
    el.innerHTML = `
      <h2>💬 Ask AI — Your OSRS Helper</h2>
      <p style="color:var(--text-soft);">
        Powered by free public LLM (Pollinations.ai). Ask anything — quests, gear, training paths, bossing. The AI sees your live stats. ✨
      </p>

      <div id="ai-messages" style="background:var(--card-bg-strong);border:1px solid var(--card-border);border-radius:var(--radius);padding:14px;max-height:55vh;overflow-y:auto;box-shadow:var(--shadow-soft);min-height:240px;">
        ${msgs.length === 0 ? `
          <div style="text-align:center;color:var(--text-faint);padding:30px 0;">
            <div style="font-size:48px;">💬</div>
            <p>Ask me anything! Try:</p>
            <div style="display:flex;flex-direction:column;gap:6px;align-items:center;margin-top:10px;">
              <button class="btn btn-soft" style="font-size:12px;padding:6px 14px;" onclick="UI.aiSuggest('What should I do next?')">What should I do next?</button>
              <button class="btn btn-soft" style="font-size:12px;padding:6px 14px;" onclick="UI.aiSuggest('How do I do Waterfall Quest?')">How do I do Waterfall Quest?</button>
              <button class="btn btn-soft" style="font-size:12px;padding:6px 14px;" onclick="UI.aiSuggest('What gear should I be wearing right now?')">What gear should I be wearing right now?</button>
              <button class="btn btn-soft" style="font-size:12px;padding:6px 14px;" onclick="UI.aiSuggest('How do I make money at my level?')">How do I make money at my level?</button>
            </div>
          </div>
        ` : msgs.map(m => aiBubble(m)).join('')}
      </div>

      <div id="ai-image-preview" style="display:none;margin-top:10px;"></div>
      <div style="display:flex;gap:8px;margin-top:12px;align-items:center;">
        <input type="file" id="ai-file" accept="image/*" style="display:none;" onchange="UI.attachImage(this)">
        <button class="btn btn-soft" title="Attach a Skills-panel screenshot" onclick="document.getElementById('ai-file').click()"
          style="flex:0 0 auto;padding:10px 14px;">📎</button>
        <input id="ai-input" placeholder="Ask anything, or 📎 attach a stats screenshot… 💕" autocomplete="off"
          style="flex:1;padding:12px 18px;border-radius:999px;border:1px solid var(--card-border);background:white;font-family:var(--font-body);font-size:14px;outline:none;"
          onpaste="UI.handleChatPaste(event)"
          onkeydown="if(event.key==='Enter'){UI.aiSend();}">
        <button class="btn" id="ai-send-btn" onclick="UI.aiSend()">Send ✨</button>
      </div>
      <p style="color:var(--text-faint);font-size:11px;margin:6px 2px 0;">📎 Tip: screenshot your in-game Skills panel and attach it — the AI reads every level and fills your stats in. (Needs a vision model — free Groq works.)</p>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:11px;color:var(--text-faint);">
        <span>💕 Conversations save locally per browser. AI may be wrong — always sanity-check.</span>
        ${msgs.length ? `<button class="btn btn-soft" style="font-size:11px;padding:4px 10px;" onclick="if(confirm('Clear chat?')){AIChat.clear();UI.renderAllPublic();}">Clear chat</button>` : ''}
      </div>
    `;

    // Scroll to bottom
    setTimeout(() => {
      const el = document.getElementById('ai-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  function aiBubble(m) {
    const isUser = m.role === 'user';
    return `
      <div style="display:flex;justify-content:${isUser ? 'flex-end' : 'flex-start'};margin-bottom:10px;">
        <div style="
          max-width:75%;
          padding:10px 14px;
          border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
          background:${isUser ? 'linear-gradient(135deg,var(--pink-500),var(--pink-400))' : 'var(--pink-50)'};
          color:${isUser ? 'white' : 'var(--text)'};
          font-size:14px;
          line-height:1.5;
          white-space:pre-wrap;
          word-wrap:break-word;
          box-shadow:0 2px 6px rgba(232,56,138,0.1);
        ">${esc(m.content)}</div>
      </div>
    `;
  }

  function aiSuggest(text) {
    const input = document.getElementById('ai-input');
    if (input) input.value = text;
    aiSend();
  }

  // ---------- Chat image attachment (screenshot → stats) ----------
  let pendingImage = null; // { dataUrl, mediaType }

  function fileToScaledDataUrl(file, cb) {
    if (!file || !file.type || !file.type.startsWith('image/')) { cb(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600; // keep small skill numbers legible while bounding payload
        let w = img.width, h = img.height;
        const scale = Math.min(1, MAX / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          cb({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), mediaType: 'image/jpeg' });
        } catch { cb({ dataUrl: reader.result, mediaType: file.type || 'image/png' }); }
      };
      img.onerror = () => cb({ dataUrl: reader.result, mediaType: file.type || 'image/png' });
      img.src = reader.result;
    };
    reader.onerror = () => cb(null);
    reader.readAsDataURL(file);
  }

  function setPendingImage(file) {
    fileToScaledDataUrl(file, (img) => {
      if (!img) { toast('💔 Could not read that image'); return; }
      pendingImage = img;
      refreshImagePreviews();
      toast('📷 Screenshot attached — hit Send and I\'ll read your levels ✨');
    });
  }

  function attachImage(input) {
    const file = input && input.files && input.files[0];
    if (file) setPendingImage(file);
    if (input) input.value = ''; // allow re-selecting the same file
  }

  function handleChatPaste(event) {
    const items = (event.clipboardData && event.clipboardData.items) || [];
    for (const it of items) {
      if (it.type && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) { event.preventDefault(); setPendingImage(file); return; }
      }
    }
  }

  function clearPendingImage() { pendingImage = null; refreshImagePreviews(); }

  function refreshImagePreviews() {
    const html = pendingImage ? `
      <div style="display:inline-flex;align-items:center;gap:8px;background:var(--pink-50);border:1px solid var(--pink-200);border-radius:12px;padding:6px 10px;">
        <img src="${pendingImage.dataUrl}" alt="screenshot" style="height:40px;width:auto;border-radius:6px;">
        <span style="font-size:12px;color:var(--text-soft);">📷 screenshot ready to read</span>
        <button onclick="UI.clearPendingImage()" title="Remove" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-soft);line-height:1;">×</button>
      </div>` : '';
    for (const id of ['chat-image-preview-floating', 'ai-image-preview']) {
      const el = document.getElementById(id);
      if (el) { el.innerHTML = html; el.style.display = pendingImage ? 'block' : 'none'; }
    }
  }

  async function aiSend() {
    const input = document.getElementById('ai-input');
    const btn = document.getElementById('ai-send-btn');
    const text = (input?.value || '').trim();
    if ((!text && !pendingImage) || !currentStats) return;
    const img = pendingImage; clearPendingImage();
    input.value = '';
    btn.disabled = true;
    btn.textContent = '…';

    // Optimistic render: show user message + typing indicator
    const msgsEl = document.getElementById('ai-messages');
    if (msgsEl) {
      // Clear placeholder if first message
      if (AIChat.all().length === 0) msgsEl.innerHTML = '';
      msgsEl.insertAdjacentHTML('beforeend', aiBubble({ role: 'user', content: (img ? '📷 Screenshot' + (text ? ' — ' + text : '') : text) }));
      msgsEl.insertAdjacentHTML('beforeend', `
        <div id="ai-typing" style="display:flex;justify-content:flex-start;margin-bottom:10px;">
          <div style="padding:10px 14px;border-radius:16px 16px 16px 4px;background:var(--pink-50);color:var(--text-soft);font-size:14px;">
            <span style="display:inline-block;animation:pulse 1.5s infinite;">${img ? '🔍 reading your screenshot…' : '💭 thinking…'}</span>
          </div>
        </div>
      `);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    const completed = completedSet();
    await AIChat.send(text, currentStats, completed, applyActions, img);

    btn.disabled = false;
    btn.textContent = 'Send ✨';
    renderAI();
  }

  // ============ FLOATING CHAT BUBBLE ============
  function toggleChatPanel(open) {
    const panel = document.getElementById('chat-panel');
    const fab = document.getElementById('chat-fab');
    if (!panel || !fab) return;
    const wantOpen = open ?? (panel.style.display === 'none');
    if (wantOpen) {
      panel.style.display = 'flex';
      fab.style.transform = 'scale(0.85)';
      fab.innerHTML = '−';
      renderFloatingChat();
      setTimeout(() => document.getElementById('chat-input-floating')?.focus(), 100);
    } else {
      panel.style.display = 'none';
      fab.style.transform = 'none';
      fab.innerHTML = '💬';
    }
  }

  function renderFloatingChat() {
    const el = document.getElementById('chat-messages-floating');
    if (!el) return;
    const msgs = AIChat.all();
    if (msgs.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;color:var(--text-faint);padding:30px 8px;">
          <div style="font-size:32px;">💬</div>
          <p style="font-size:13px;margin:8px 0;">Hi! Ask me anything OSRS 💕</p>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px;">
            <button class="btn btn-soft" style="font-size:11px;padding:5px 10px;" onclick="UI.chatSuggest('What should I do next?')">What should I do next?</button>
            <button class="btn btn-soft" style="font-size:11px;padding:5px 10px;" onclick="UI.chatSuggest('How do I make money at my level?')">How do I make money?</button>
            <button class="btn btn-soft" style="font-size:11px;padding:5px 10px;" onclick="UI.chatSuggest('What gear should I wear?')">What gear should I wear?</button>
          </div>
        </div>
      `;
      return;
    }
    el.innerHTML = msgs.map(m => `
      <div style="display:flex;justify-content:${m.role === 'user' ? 'flex-end' : 'flex-start'};margin-bottom:8px;">
        <div style="max-width:80%;padding:8px 12px;border-radius:${m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${m.role === 'user' ? 'linear-gradient(135deg,var(--pink-500),var(--pink-400))' : 'white'};color:${m.role === 'user' ? 'white' : 'var(--text)'};font-size:13px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 4px rgba(0,0,0,0.06);">${esc(m.content)}</div>
      </div>
    `).join('');
    el.scrollTop = el.scrollHeight;
  }

  function chatSuggest(text) {
    document.getElementById('chat-input-floating').value = text;
    chatSend();
  }

  // ---------- AI Settings popup ----------
  function showAISettings() {
    const providers = AIChat.getProviders();
    const cfg = AIChat.loadConfig();
    const current = cfg.provider || 'groq';
    const html = `
      <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
        <div class="modal" style="max-width:580px;">
          <h3>⚙️ AI Assistant Setup</h3>
          <p style="color:var(--text-soft);font-size:13px;">
            Plug in a free API key to unlock a real AI agent that knows your stats. 💖
          </p>

          <div style="margin:14px 0;">
            <label style="font-size:12px;font-weight:700;color:var(--text-soft);">PROVIDER</label>
            <select id="ai-provider" onchange="UI.onProviderChange()" style="width:100%;padding:8px 12px;border-radius:10px;border:1px solid var(--card-border);font-family:var(--font-body);font-weight:600;margin-top:4px;">
              ${Object.entries(providers).map(([id, p]) => `
                <option value="${id}" ${id === current ? 'selected' : ''}>${esc(p.name)}</option>
              `).join('')}
            </select>
          </div>

          <div id="ai-signup-callout"></div>

          <div style="margin:14px 0;">
            <label style="font-size:12px;font-weight:700;color:var(--text-soft);">PASTE YOUR API KEY HERE</label>
            <input type="password" id="ai-apikey" value="${esc(cfg.apiKey || '')}"
              placeholder="sk-... or your-key-here"
              style="width:100%;padding:10px 14px;border-radius:10px;border:2px solid var(--pink-200);font-family:monospace;font-size:13px;margin-top:4px;">
            <p style="font-size:11px;color:var(--text-faint);margin:4px 0 0;">Saved locally in your browser. Never sent anywhere except the provider you picked.</p>
          </div>

          <div style="margin:14px 0;">
            <label style="font-size:11px;font-weight:600;color:var(--text-soft);">MODEL (optional)</label>
            <input type="text" id="ai-model" value="${esc(cfg.model || '')}"
              placeholder="${esc(providers[current].defaultModel)}"
              style="width:100%;padding:6px 12px;border-radius:10px;border:1px solid var(--card-border);font-family:monospace;font-size:12px;margin-top:4px;">
            <p style="font-size:10px;color:var(--text-faint);margin:2px 0 0;">Leave blank for default.</p>
          </div>

          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
            <button class="modal-close" style="margin:0;" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
            <button class="btn" onclick="UI.saveAISettings()">💖 Save</button>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    onProviderChange(); // render callout for the initially-selected provider
  }

  const SIGNUP_CALLOUTS = {
    groq: {
      title: '⚡ Groq — FREE Llama 3.3 70B · 30 requests/min · 14,400/day',
      url: 'https://console.groq.com/keys',
      steps: [
        'Click the button below — opens Groq API keys page',
        'Sign in with Google (one click) or create a free account',
        'Click "Create API Key" → name it whatever',
        'Copy the key (starts with <code>gsk_...</code>)',
        'Paste it below + hit Save 💖',
      ],
      buttonText: '⚡ Create Groq account + get key →',
      buttonColor: 'linear-gradient(135deg, #ff7ab6, #ffd700)',
    },
    cerebras: {
      title: '🚀 Cerebras — FREE 1M tokens/day · 30 req/min · fastest inference',
      url: 'https://cloud.cerebras.ai/?redirect=/platform/api-keys',
      steps: [
        'Click the button below — opens Cerebras platform',
        'Sign up (Google login works, no card needed)',
        'Navigate to API Keys → Create',
        'Copy the key (starts with <code>csk-...</code>)',
        'Paste it below + hit Save',
      ],
      buttonText: '🚀 Create Cerebras account + get key →',
      buttonColor: 'linear-gradient(135deg, #c84fb8, #ff7ab6)',
    },
    openrouter: {
      title: '🌸 OpenRouter — paid models great, free models heavily rate-limited 😢',
      url: 'https://openrouter.ai/keys',
      steps: [
        '⚠️ Free :free models share a global pool — 1 message per 5+ minutes is normal',
        'Better: add $5 credit ONCE to unlock cheap paid models (Gemini Flash = ~$0.0001/question)',
        'Sign in with Google',
        'Click "Create Key"',
        'Paste key below, optionally pick a paid model like <code>google/gemini-2.0-flash-001</code>',
      ],
      buttonText: 'Open OpenRouter keys →',
      buttonColor: 'linear-gradient(135deg, var(--pink-500), var(--pink-400))',
    },
    openai: {
      title: '🔑 OpenAI — requires credit card',
      url: 'https://platform.openai.com/api-keys',
      steps: [
        '⚠️ Note: OpenAI requires a credit card. $5 free credit on signup.',
        'Click the button below',
        'Sign in / sign up',
        'Add a payment method',
        'Create an API key, paste below',
      ],
      buttonText: 'Open OpenAI API keys →',
      buttonColor: 'linear-gradient(135deg, #b08400, #e8388a)',
    },
    anthropic: {
      title: '🤖 Anthropic Claude — requires credit card',
      url: 'https://console.anthropic.com/settings/keys',
      steps: [
        '⚠️ Note: Anthropic requires payment setup.',
        'Click the button below',
        'Sign in / sign up + add payment',
        'Create an API key',
        'Paste below + hit Save',
      ],
      buttonText: 'Open Anthropic console →',
      buttonColor: 'linear-gradient(135deg, #7e36c4, #ff7ab6)',
    },
    pollinations: {
      title: '🌐 Pollinations — free public, often rate-limited',
      url: null,
      steps: ['No signup or key needed. May be slow or fail under load.'],
      buttonText: null,
      buttonColor: null,
    },
  };

  function onProviderChange() {
    const sel = document.getElementById('ai-provider').value;
    const c = SIGNUP_CALLOUTS[sel];
    const providers = AIChat.getProviders();
    const calloutEl = document.getElementById('ai-signup-callout');
    if (calloutEl && c) {
      calloutEl.innerHTML = `
        <div style="background:linear-gradient(135deg,var(--pink-50),#fff8d0);padding:14px 16px;border-radius:14px;margin:14px 0;border:1px solid var(--card-border);">
          <div style="font-weight:800;font-size:14px;color:var(--pink-600);margin-bottom:10px;">${c.title}</div>
          <ol style="margin:0 0 12px 18px;padding:0;font-size:13px;line-height:1.7;color:var(--text);">
            ${c.steps.map(s => `<li>${s}</li>`).join('')}
          </ol>
          ${c.buttonText ? `
            <a href="${c.url}" target="_blank" rel="noopener" style="display:inline-block;background:${c.buttonColor};color:white;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;box-shadow:0 4px 14px rgba(232,56,138,0.3);">${c.buttonText}</a>
          ` : ''}
        </div>
      `;
    }
    const model = document.getElementById('ai-model');
    if (model && providers[sel]) model.placeholder = providers[sel].defaultModel;
  }

  function saveAISettings() {
    const cfg = {
      provider: document.getElementById('ai-provider').value,
      apiKey: document.getElementById('ai-apikey').value.trim(),
      model: document.getElementById('ai-model').value.trim() || null,
    };
    AIChat.saveConfig(cfg);
    document.querySelector('.modal-backdrop')?.remove();
    toast('✨ AI settings saved! Try the chat now 💖');
  }

  async function chatSend() {
    const input = document.getElementById('chat-input-floating');
    const btn = document.getElementById('chat-send-btn');
    const text = (input?.value || '').trim();
    if ((!text && !pendingImage) || !currentStats) return;
    const img = pendingImage; clearPendingImage();
    input.value = '';
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    const el = document.getElementById('chat-messages-floating');
    if (el) {
      if (AIChat.all().length === 0) el.innerHTML = '';
      el.insertAdjacentHTML('beforeend', `
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
          <div style="max-width:80%;padding:8px 12px;border-radius:14px 14px 4px 14px;background:linear-gradient(135deg,var(--pink-500),var(--pink-400));color:white;font-size:13px;line-height:1.4;white-space:pre-wrap;word-wrap:break-word;">${img ? '📷 Screenshot' + (text ? ' — ' + esc(text) : '') : esc(text)}</div>
        </div>
      `);
      el.insertAdjacentHTML('beforeend', `
        <div id="chat-typing-floating" style="display:flex;justify-content:flex-start;margin-bottom:8px;">
          <div style="padding:8px 12px;border-radius:14px 14px 14px 4px;background:white;color:var(--text-soft);font-size:13px;">
            <span style="display:inline-block;animation:pulse 1.5s infinite;">${img ? '🔍 reading your screenshot…' : '💭 thinking…'}</span>
          </div>
        </div>
      `);
      el.scrollTop = el.scrollHeight;
    }

    const completed = completedSet();
    await AIChat.send(text, currentStats, completed, applyActions, img);

    if (btn) { btn.disabled = false; btn.textContent = 'Send ✨'; }
    renderFloatingChat();
    // Also refresh the main AI tab if open
    renderAI();
  }

  // ============ GLOBAL SEARCH ============
  function globalSearch(q) {
    const results = [];
    const query = q.toLowerCase();
    if (query.length < 2) return results;
    for (const it of QUESTS) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'quest', name: it.name, tab: 'quests' });
    for (const it of MASTER_TASKS) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'task', name: it.name, tab: 'next' });
    for (const it of BOSSES) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'boss', name: it.name, tab: 'bosses' });
    for (const it of SLAYER_MONSTERS) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'slayer', name: it.name, tab: 'slayer' });
    for (const it of PETS) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'pet', name: it.name, tab: 'pets' });
    for (const it of MONEY_METHODS) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'money', name: it.name, tab: 'money' });
    if (typeof MINIGAMES !== 'undefined') for (const it of MINIGAMES) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'minigame', name: it.name, tab: 'minigames' });
    for (const it of PLUGINS) if (it.name.toLowerCase().includes(query)) results.push({ kind: 'plugin', name: it.name, tab: 'plugins' });
    for (const m of SKILL_META) if (m.name.toLowerCase().includes(query)) results.push({ kind: 'skill', name: m.name, tab: 'skills' });
    return results.slice(0, 12);
  }

  function handleSearch() {
    const q = document.getElementById('global-search')?.value || '';
    const wrap = document.getElementById('global-search-results');
    if (!wrap) return;
    const results = globalSearch(q);
    if (!q || !results.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = `
      <div style="background:var(--card-bg-strong);border:1px solid var(--card-border);border-radius:14px;padding:8px;margin-top:6px;box-shadow:var(--shadow-pop);">
        ${results.map(r => `
          <div style="padding:6px 10px;cursor:pointer;border-radius:8px;display:flex;justify-content:space-between;align-items:center;" onmouseover="this.style.background='var(--pink-50)'" onmouseout="this.style.background='transparent'" onclick="UI.jumpToTab('${r.tab}')">
            <span><strong>${esc(r.name)}</strong></span>
            <span class="tag">${r.kind}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function jumpToTab(tab) {
    document.getElementById('global-search').value = '';
    document.getElementById('global-search-results').innerHTML = '';
    showSection(tab);
  }

  // ============ I'M BORED ============
  function showBored() {
    if (!currentStats) return;
    const completed = completedSet();
    const all = [...Recommender.readyMasterTasks(currentStats, completed),
                 ...Recommender.readyQuests(currentStats, completed)];
    if (!all.length) { toast('Nothing immediately ready — go check Coming Up 💕'); return; }
    const pick = all[Math.floor(Math.random() * all.length)];
    const isQuest = QUESTS.some(q => q.id === pick.id);
    const html = `
      <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
        <div class="modal">
          <h3>🎲 Try this!</h3>
          <p style="color:var(--text-soft);font-size:13px;">Random pick from things she qualifies for right now. ✨</p>
          <div style="margin:12px 0;padding:14px;background:var(--pink-50);border-radius:12px;">
            <div style="font-size:20px;font-weight:700;">${pick.icon || '📜'} ${esc(pick.name)}</div>
            <p style="margin:8px 0 0;color:var(--text-soft);">${esc(pick.why || '')}</p>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn" onclick="this.closest('.modal-backdrop').remove();UI.showBored();">🎲 Re-roll</button>
            <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()" style="margin:0;">Close</button>
          </div>
        </div>
      </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
  }

  return { setStats, showSection, addTask, toggleTask, removeTask, clearDone,
           markQuestDone, toggleDiary, toast, showPanic,
           showManualEntry, saveManualEntry, clearManualEntry,
           showBulkQuestEditor, toggleBulkQuest, filterQuestEditor,
           bulkQuestFilter, resetBulkQuests, refreshAfterBulkEdit,
           markRecDone, resetCompletedRecs,
           toggleDaily, addSkillGoal, addTaskGoal, toggleGoal, removeGoal,
           handleSearch, jumpToTab, showBored,
           aiSend, aiSuggest,
           toggleChatPanel, renderFloatingChat, chatSuggest, chatSend,
           showAISettings, onProviderChange, saveAISettings,
           applyAction, applyActions, resolveCompletable,
           resumeLiveSync, toggleAccountMode, toggleRoadmapStep,
           renderNav, showGroup,
           undoCompletedQuest, undoRec, undoRoadmap, restoreTask, undoDiary,
           attachImage, handleChatPaste, clearPendingImage,
           renderAllPublic: renderAll };
})();
