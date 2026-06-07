/* ==========================================================
   Daily Checklist — resets every day at midnight (local).
   Storage: localStorage['bvels10_dailies_<YYYY-MM-DD>']
   Streak: localStorage['bvels10_streak'] = { lastDate, count }
   ========================================================== */
const DAILY_ITEMS = [
  // EVERY-DAY essentials
  { id: 'herb_run',         icon: '🌿', name: 'Herb run (5 patches)',        category: 'farm',   reqs: { farming: 32 }, why: '500K-1M gp + 50K+ Farming XP. ~5 min round-trip via Spirit Tree + Fairy Ring + Glory.' },
  { id: 'tree_run',         icon: '🌳', name: 'Tree run',                    category: 'farm',   reqs: { farming: 15 }, why: 'Passive WC + Farming XP. Plant trees, come back tomorrow.' },
  { id: 'fruit_tree_run',   icon: '🍎', name: 'Fruit tree run',              category: 'farm',   reqs: { farming: 27 }, why: 'Each fruit tree ~3.5K Farming XP at low levels. Long grow time but stack them daily.' },
  { id: 'hespori',          icon: '🌺', name: 'Hespori (boss farm patch)',   category: 'farm',   reqs: { farming: 65 }, why: 'Bottomless compost + Tangleroot pet roll. ~3 min weekly boss.' },

  // PROFITABLE dailies
  { id: 'battlestaves',     icon: '🪄', name: 'Zaff battlestaves (~150K gp)', category: 'profit', reqs: { quest: 'Varrock Easy Diary' }, why: 'Buy 64 at 7K each, alch for 9K. ~150K free gp daily.' },
  { id: 'managing_misc',    icon: '👑', name: 'Manage Miscellania kingdom',  category: 'profit', reqs: { quest: 'Throne of Miscellania' }, why: 'Daily passive resources (logs, herbs, gp).' },
  { id: 'mahogany_homes',   icon: '🏠', name: 'Mahogany Homes contract',      category: 'profit', reqs: { construction: 1 }, why: 'Daily MH contract = bonus reward points + Plank Sack progress.' },
  { id: 'farming_contract', icon: '🌾', name: 'Farming Contract (Jane)',     category: 'profit', reqs: { farming: 45 }, why: 'Free seeds + Anima seed unlocks.' },

  // PvM dailies
  { id: 'barrows',          icon: '⚰️', name: 'Barrows run (1× daily)',      category: 'pvm',    reqs: { combat: 80 }, why: 'Avg ~300K gp/chest. Set + spell book.' },
  { id: 'giant_mole',       icon: '🦔', name: 'Giant Mole (5 min boss)',     category: 'pvm',    reqs: { combat: 70 }, why: 'Fast boss kc. Easy gp + pet chance.' },
  { id: 'scurrius',         icon: '🐀', name: 'Scurrius (instanced 1×/day free)', category: 'pvm', reqs: { combat: 60 }, why: 'Scurrius spine grind. Drop with stab bonus.' },

  // MINIGAME dailies (good for routine)
  { id: 'wintertodt_3',     icon: '🔥', name: 'Wintertodt × 3 (supplies)',    category: 'minigame', reqs: { firemaking: 50 }, why: 'Pet rolls + supplies + FM XP. Quick burn.' },
  { id: 'tempoross_3',      icon: '🌊', name: 'Tempoross × 3 (fish + flakes)', category: 'minigame', reqs: { fishing: 35 }, why: 'Pet rolls + Spirit Flakes + Angler outfit pieces.' },

  // SETUP / MAINTENANCE
  { id: 'birdhouse_runs',   icon: '🐦', name: 'Birdhouse runs × 4 (50 min cycle)', category: 'farm', reqs: { hunter: 5, crafting: 5 }, why: '5K Hunter XP passive per run + bird nest drops.' },
  { id: 'amulet_glory',     icon: '💎', name: 'Recharge Amulet of Glory',     category: 'maint',  reqs: { combat: 1 }, why: 'Free recharge at Fountain of Heroes if you have access.' },
  { id: 'play_with_pet',    icon: '🐾', name: 'Play with your follower pet 💕', category: 'fun',  reqs: { combat: 1 }, why: 'Pure serotonin. No XP, no gp, just vibes.' },
];

const DailyChecklist = (() => {
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const STORAGE_KEY = 'bvels10_dailies';
  const STREAK_KEY  = 'bvels10_streak_v1';

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      // Auto-prune entries older than 7 days
      const today = todayKey();
      const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7);
      const cutoffKey = cutoff.toISOString().slice(0, 10);
      for (const k of Object.keys(raw)) {
        if (k < cutoffKey) delete raw[k];
      }
      return raw;
    } catch { return {}; }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getTodayState() {
    const all = load();
    return all[todayKey()] || {};
  }

  function setToday(state) {
    const all = load();
    all[todayKey()] = state;
    save(all);
  }

  function toggle(id) {
    const state = getTodayState();
    state[id] = !state[id];
    setToday(state);
    updateStreak();
  }

  function isDone(id) {
    return !!getTodayState()[id];
  }

  function reset() {
    setToday({});
  }

  // Eligible based on stats + completed quests
  function eligibleItems(stats, completedQuestIds) {
    return DAILY_ITEMS.filter(item => {
      if (!item.reqs) return true;
      if (item.reqs.farming && (stats?.skills?.farming?.level || 1) < item.reqs.farming) return false;
      if (item.reqs.hunter && (stats?.skills?.hunter?.level || 1) < item.reqs.hunter) return false;
      if (item.reqs.crafting && (stats?.skills?.crafting?.level || 1) < item.reqs.crafting) return false;
      if (item.reqs.firemaking && (stats?.skills?.firemaking?.level || 1) < item.reqs.firemaking) return false;
      if (item.reqs.fishing && (stats?.skills?.fishing?.level || 1) < item.reqs.fishing) return false;
      if (item.reqs.construction && (stats?.skills?.construction?.level || 1) < item.reqs.construction) return false;
      if (item.reqs.combat) {
        const skills = Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, stats?.skills?.[m.id]?.level || 1]));
        if (combatLevel(skills) < item.reqs.combat) return false;
      }
      if (item.reqs.quest && completedQuestIds) {
        const qid = QUESTS.find(q => q.name === item.reqs.quest)?.id || item.reqs.quest.toLowerCase().replace(/\W+/g, '_');
        if (!completedQuestIds.has(qid)) return false;
      }
      return true;
    });
  }

  // ----- Streak tracking -----
  function loadStreak() {
    try { return JSON.parse(localStorage.getItem(STREAK_KEY) || 'null') || { lastDate: null, count: 0 }; }
    catch { return { lastDate: null, count: 0 }; }
  }
  function saveStreak(s) { localStorage.setItem(STREAK_KEY, JSON.stringify(s)); }

  function updateStreak() {
    const today = todayKey();
    const s = loadStreak();
    const todayState = getTodayState();
    const anyDone = Object.values(todayState).some(v => v);
    if (!anyDone) return;
    if (s.lastDate === today) return;

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);

    if (s.lastDate === yKey) {
      s.count += 1;
    } else {
      s.count = 1;
    }
    s.lastDate = today;
    saveStreak(s);
  }

  function getStreak() { return loadStreak(); }

  return { todayKey, getTodayState, toggle, isDone, reset, eligibleItems, getStreak, updateStreak };
})();
