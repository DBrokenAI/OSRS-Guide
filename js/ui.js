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
    currentStats = stats;
    if (diff) {
      const now = Date.now();
      for (const sid of Object.keys(diff)) recentDiffs[sid] = now;
    }
    renderAll();
  }

  // ---------- Header ----------
  function renderHeader() {
    if (!currentStats) return;
    document.getElementById('player-name').textContent = currentStats.name || '—';
    const skillsByMeta = Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, currentStats.skills[m.id]?.level || 1]));
    const cb = combatLevel(skillsByMeta);
    document.getElementById('combat-level').textContent = `⚔️ Combat ${cb}`;
    document.getElementById('total-level').textContent = `🎀 Total ${currentStats.totalLevel || 0}`;

    const minsAgo = currentStats.fetchedAt ? Math.round((Date.now() - currentStats.fetchedAt) / 60000) : null;
    document.getElementById('last-update').textContent =
      minsAgo == null ? 'updating…' :
      minsAgo === 0 ? 'just updated 💕' :
      `updated ${minsAgo}m ago`;
  }

  // ---------- Sections ----------
  function showSection(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.dataset.section === name));
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
      return `
        <div class="card">
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

    el.innerHTML = `
      <h2>💖 Next Up — for ${esc(currentStats.name)}</h2>
      <p style="color:var(--text-soft); margin-top:-6px;">
        You're combat <strong>${cb}</strong>. These are progressive — only stuff she can actually do <em>right now</em>. ✨
      </p>

      <h3>✨ Do these now (top priority)</h3>
      ${recs.length === 0 ? '<p style="color:var(--text-soft);">All caught up! Check Coming Soon below ✨</p>' : ''}
      ${recs.map(r => renderCard(r, r.priority === 1 ? 'TOP' : null, true)).join('')}

      ${upcoming.length ? `
        <h3>🔜 Coming Soon (within ~10 levels)</h3>
        <p style="color:var(--text-soft);font-size:13px;margin-top:-4px;">
          Things to plan for as she levels up. Each one tells you exactly what to train.
        </p>
        ${upcoming.map(r => renderCard(r, 'soon', false)).join('')}
      ` : ''}

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

    // If it's a quest, also write to the bulk quest store so all views agree
    if (type === 'quest' && id) {
      const qSet = loadCompletedQuests();
      qSet.add(id);
      saveCompletedQuests(qSet);
    }

    Journal.add('done', `✅ Marked done: ${title}`, false);
    renderAll();
    toast(`✨ Marked done!`);
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
            return `
              <div class="stat ${recent ? 'recently-gained' : ''}">
                <span class="stat-icon">${m.icon}</span>
                <div>
                  <div class="stat-name">${esc(m.name)}</div>
                  <div class="stat-xp">${NUM(sk.xp)} xp</div>
                </div>
                <div class="stat-lvl">${sk.level}</div>
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
    el.innerHTML = `
      <h2>🌸 Skills</h2>
      <p style="color:var(--text-soft);">Click any skill to see the level-by-level training plan. Your current tier is highlighted. ✨</p>
      ${nonCombat.map(m => skillTierBlock(m.id)).join('')}
    `;
  }

  // ============ BOSSES ============
  function renderBosses() {
    const el = sectionEl('bosses');
    const ready = Recommender.readyBosses(currentStats).map(b => b.id);
    el.innerHTML = `
      <h2>👑 Boss Ladder</h2>
      <p style="color:var(--text-soft);">Sequenced from easiest to hardest. ✨ = next one ready for you.</p>
      ${BOSSES.map(b => {
        const isReady = ready.includes(b.id);
        return `
          <div class="card">
            <div class="card-header">
              <div class="card-title">${isReady ? '✨' : '🔒'} ${esc(b.name)}</div>
              <span class="tag ${isReady ? 'ready' : 'locked'}">${isReady ? 'READY' : 'LOCKED'}</span>
            </div>
            <p style="margin:4px 0;font-size:13px;"><strong>Stats:</strong> ${esc(b.suggestedStats)}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Location:</strong> ${esc(b.location)}</p>
            <p style="margin:4px 0;font-size:13px;"><strong>Loot:</strong> ${esc(b.loot)}</p>
            <p style="margin:6px 0 0;color:var(--text-soft);">${esc(b.why)}</p>
            <p style="margin:8px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(b.wiki || b.name)}">Wiki guide →</a></p>
          </div>
        `;
      }).join('')}
    `;
  }

  // ============ MONEY ============
  function renderMoney() {
    const el = sectionEl('money');
    el.innerHTML = `
      <h2>💰 Money-Making</h2>
      <p style="color:var(--text-soft);">Sorted from no-requirement starter methods to mid-game bossing. ✨</p>
      ${MONEY_METHODS.map(m => `
        <div class="card">
          <div class="card-header">
            <div class="card-title">💰 ${esc(m.name)}</div>
            <span class="tag gold">${esc(m.gpHr)} / hr</span>
          </div>
          <p style="margin:4px 0;font-size:13px;"><strong>Reqs:</strong> ${esc(m.reqs)}</p>
          <p style="margin:6px 0 0;color:var(--text-soft);">${esc(m.summary)}</p>
          <p style="margin:6px 0 0;"><a class="wiki-link" target="_blank" href="${WIKI(m.wiki || m.name)}">Wiki →</a></p>
        </div>
      `).join('')}
    `;
  }

  // ============ GEAR ============
  function renderGear() {
    const el = sectionEl('gear');
    const melee = Recommender.gearForLevel('melee', currentStats);
    const ranged = Recommender.gearForLevel('ranged', currentStats);
    const magic = Recommender.gearForLevel('magic', currentStats);

    function gearTable(title, set) {
      const slots = ['weapon','head','body','legs','boots','amulet','cape'];
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

  return { setStats, showSection, addTask, toggleTask, removeTask, clearDone,
           markQuestDone, toggleDiary, toast, showPanic,
           showManualEntry, saveManualEntry, clearManualEntry,
           showBulkQuestEditor, toggleBulkQuest, filterQuestEditor,
           bulkQuestFilter, resetBulkQuests, refreshAfterBulkEdit,
           markRecDone, resetCompletedRecs,
           renderAllPublic: renderAll };
})();
