/* ==========================================================
   Journal — auto-log XP gains, level ups, milestones
   Storage: localStorage['bvels10_journal_v1']
   ========================================================== */
const Journal = (() => {
  const KEY = 'bvels10_journal_v1';
  const MAX_ENTRIES = 500;
  let entries = [];
  let listeners = [];

  function load() {
    try {
      entries = JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch { entries = []; }
  }

  function save() {
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(entries));
    for (const cb of listeners) cb(entries);
  }

  function add(type, text, milestone = false) {
    entries.push({ ts: Date.now(), type, text, milestone });
    save();
  }

  function recordDiff(diff) {
    if (!diff) return;
    for (const [skillId, d] of Object.entries(diff)) {
      const meta = SKILL_META.find(m => m.id === skillId);
      if (!meta) continue;
      if (d.lvlDiff > 0) {
        const milestone = d.toLvl % 10 === 0 || d.toLvl >= 70;
        add('level', `${meta.icon} ${meta.name} → level ${d.toLvl}!  (+${d.lvlDiff})`, milestone);
      } else if (d.xpDiff > 100) {
        add('xp', `${meta.icon} ${meta.name} +${d.xpDiff.toLocaleString()} XP`);
      }
    }
  }

  function all() { return entries.slice().reverse(); }
  function on(cb) { listeners.push(cb); }
  function clear() { entries = []; save(); }

  load();
  return { add, recordDiff, all, on, clear };
})();
