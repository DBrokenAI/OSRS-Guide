/* ==========================================================
   PendingXp — locally credit XP from quests she's marked done
   before her live hiscores reflect it. Auto-clears once
   the API catches up.
   Storage: localStorage['bvels10_pending_xp_v1'] = { skillId: xpAmount }
   ========================================================== */
const PendingXp = (() => {
  const KEY = 'bvels10_pending_xp_v1';
  let map = {};

  function load() {
    try { map = JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch { map = {}; }
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(map));
  }

  function get(skillId) { return map[skillId] || 0; }
  function all() { return Object.assign({}, map); }

  function add(rewards) {
    if (!rewards) return;
    for (const [sid, xp] of Object.entries(rewards)) {
      map[sid] = (map[sid] || 0) + (xp || 0);
    }
    save();
  }

  function clear() { map = {}; save(); }
  function clearSkill(sid) { delete map[sid]; save(); }

  // Given live stats, return a new stats object with pending XP overlaid
  // and recalculated levels. Also auto-clears pending entries where live caught up.
  function apply(stats) {
    if (!stats || !stats.skills) return stats;
    const merged = JSON.parse(JSON.stringify(stats));
    let changed = false;
    for (const sid of Object.keys(map)) {
      const sk = merged.skills[sid];
      if (!sk) continue;
      // We compare the LIVE xp to a previously-recorded "baseline at credit time".
      // Simpler heuristic: if pending exists AND live xp grew by >= pending since
      // first credit, treat as caught up. We track baseline per skill.
      const baselineKey = '_baseline_' + sid;
      if (map[baselineKey] != null) {
        if (sk.xp >= map[baselineKey] + map[sid]) {
          // hiscores caught up — clear pending
          delete map[sid];
          delete map[baselineKey];
          changed = true;
          continue;
        }
      } else {
        // first time seeing this pending — record current live xp as baseline
        map[baselineKey] = sk.xp;
        changed = true;
      }
      // Overlay pending xp + recalc level
      sk.xp = sk.xp + map[sid];
      sk.level = levelFromXp(sk.xp);
      sk._pending = map[sid];
    }
    if (changed) save();
    // Recalculate total
    let total = 0, totalXp = 0;
    for (const sid of Object.keys(merged.skills)) {
      total += merged.skills[sid].level;
      totalXp += merged.skills[sid].xp;
    }
    merged.totalLevel = total;
    merged.totalXp = totalXp;
    return merged;
  }

  load();
  return { get, all, add, clear, clearSkill, apply };
})();
