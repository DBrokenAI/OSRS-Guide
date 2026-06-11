/* ==========================================================
   UserOverrides — lets the player correct wrong data (via the
   AI "fixData" action) without editing source. Overrides are
   stored in localStorage and re-applied to the in-memory data
   (QUESTS) every load, so they survive refreshes.

   Storage: localStorage['bvels10_overrides_v1'] = {
     quests: { [questId]: { xpRewards:{skill:xp}, reqsSkill:{skill:lvl}, practicalCombat:n } }
   }

   Must load AFTER data.js (needs QUESTS, SKILL_META) and BEFORE
   recommender.js so corrected data feeds the recommendations.
   ========================================================== */
const UserOverrides = (() => {
  const KEY = 'bvels10_overrides_v1';
  let data = { quests: {} };

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && typeof raw === 'object') data = Object.assign({ quests: {} }, raw);
    } catch { data = { quests: {} }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(data)); }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  }
  function resolveQuest(name) {
    if (!name) return null;
    const n = norm(name);
    return QUESTS.find(q => q.id === name)
        || QUESTS.find(q => norm(q.name) === n)
        || (n.length >= 4 && QUESTS.find(q => norm(q.name).includes(n)))
        || (n.length >= 4 && QUESTS.find(q => n.includes(norm(q.name))))
        || null;
  }
  function resolveSkill(s) {
    if (!s) return null;
    const n = norm(s);
    const m = SKILL_META.find(mm => mm.id === n || mm.name.toLowerCase() === n);
    return m ? m.id : null;
  }

  // Re-apply every stored override to the in-memory QUESTS objects.
  function applyAll() {
    for (const [qid, ov] of Object.entries(data.quests || {})) {
      const q = QUESTS.find(x => x.id === qid);
      if (!q) continue;
      if (ov.xpRewards) {
        q.xpRewards = Object.assign({}, q.xpRewards || {}, ov.xpRewards);
        for (const [k, v] of Object.entries(ov.xpRewards)) if (!v) delete q.xpRewards[k];
      }
      if (ov.reqsSkill) {
        q.reqs = q.reqs || {};
        q.reqs.skill = Object.assign({}, q.reqs.skill || {}, ov.reqsSkill);
        for (const [k, v] of Object.entries(ov.reqsSkill)) if (!v) delete q.reqs.skill[k];
        if (q.reqs.skill && !Object.keys(q.reqs.skill).length) delete q.reqs.skill;
      }
      if (ov.practicalCombat != null) q.practicalCombat = ov.practicalCombat;
    }
  }

  function ensureQuest(qid) {
    data.quests = data.quests || {};
    data.quests[qid] = data.quests[qid] || {};
    return data.quests[qid];
  }

  // Handle a {type:'fixData', ...} action. Returns a confirmation string or null.
  function applyFix(a) {
    if (!a) return null;
    const q = resolveQuest(a.quest);
    if (!q) return null;
    const ov = ensureQuest(q.id);

    switch (a.target) {
      case 'questXp': {
        const sid = resolveSkill(a.skill);
        if (!sid) return null;
        const xp = Math.max(0, Math.min(500000, parseInt(a.xp) || 0));
        ov.xpRewards = Object.assign({}, ov.xpRewards, { [sid]: xp });
        save(); applyAll();
        const m = SKILL_META.find(mm => mm.id === sid);
        return `🔧 ${q.name}: ${m.icon} ${m.name} XP reward set to ${xp.toLocaleString()}`;
      }
      case 'questReq': {
        const sid = resolveSkill(a.skill);
        if (!sid) return null;
        const lvl = Math.max(0, Math.min(99, parseInt(a.level) || 0)); // 0 = remove the req
        ov.reqsSkill = Object.assign({}, ov.reqsSkill, { [sid]: lvl });
        save(); applyAll();
        const m = SKILL_META.find(mm => mm.id === sid);
        return lvl
          ? `🔧 ${q.name}: now requires ${m.name} ${lvl}`
          : `🔧 ${q.name}: removed the ${m.name} requirement`;
      }
      case 'practicalCombat': {
        const v = Math.max(0, Math.min(126, parseInt(a.value) || 0));
        ov.practicalCombat = v;
        save(); applyAll();
        return `🔧 ${q.name}: suggested combat level set to ${v}`;
      }
      default:
        return null;
    }
  }

  function reset() { data = { quests: {} }; save(); }

  load();
  applyAll();
  return { applyFix, applyAll, reset, all: () => data };
})();
