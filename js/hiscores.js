/* ==========================================================
   Hiscores fetcher + polling
   Uses CORS proxy because page is served from file://
   ========================================================== */
const Hiscores = (() => {
  const HISCORES_BASE = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=';
  const isLocalServer = location.protocol === 'http:' && /^(localhost|127\.0\.0\.1)/.test(location.hostname);

  // CORS proxies (used only when NOT running via local server)
  const PROXIES = [
    (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
    (url) => 'https://cors.eu.org/' + url,
  ];

  const SKILL_NAME_MAP = {
    overall: 'overall', attack: 'attack', defence: 'defence', strength: 'strength',
    hitpoints: 'hitpoints', ranged: 'ranged', prayer: 'prayer', magic: 'magic',
    cooking: 'cooking', woodcutting: 'woodcutting', fletching: 'fletching',
    fishing: 'fishing', firemaking: 'firemaking', crafting: 'crafting',
    smithing: 'smithing', mining: 'mining', herblore: 'herblore', agility: 'agility',
    thieving: 'thieving', slayer: 'slayer', farming: 'farming', runecraft: 'runecraft',
    hunter: 'hunter', construction: 'construction',
  };

  async function tryFetch(url) {
    // direct fetch first (sometimes works)
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch (_) {}

    for (const proxy of PROXIES) {
      try {
        const r = await fetch(proxy(url), { cache: 'no-cache' });
        if (r.ok) {
          const text = await r.text();
          try { return JSON.parse(text); } catch { /* try next */ }
        }
      } catch (_) {}
    }
    throw new Error('All proxies failed');
  }

  function parseJson(json) {
    const skills = {};
    let totalLevel = 0, totalXp = 0;
    for (const s of (json.skills || [])) {
      const key = (s.name || '').toLowerCase();
      if (key === 'overall') {
        totalLevel = s.level;
        totalXp = s.xp;
        continue;
      }
      if (SKILL_NAME_MAP[key]) {
        skills[key] = { level: Math.max(1, s.level || 1), xp: Math.max(0, s.xp || 0), rank: s.rank };
      }
    }
    // backfill missing skills as level 1
    for (const meta of SKILL_META) {
      if (!skills[meta.id]) skills[meta.id] = { level: 1, xp: 0, rank: -1 };
    }
    return { skills, totalLevel, totalXp, fetchedAt: Date.now(), name: json.name };
  }

  // --- WiseOldMan API parser (CORS-enabled, designed for stat tracking) ---
  function parseWom(json) {
    const snap = json.latestSnapshot?.data?.skills;
    if (!snap) throw new Error('WOM: no snapshot data');
    const skills = {};
    let totalLevel = 0, totalXp = 0;
    // WOM uses "runecrafting"; we use "runecraft"
    const remap = { runecraft: 'runecrafting' };
    for (const meta of SKILL_META) {
      const key = remap[meta.id] || meta.id;
      const s = snap[key] || {};
      skills[meta.id] = {
        level: Math.max(1, s.level || 1),
        xp:    Math.max(0, s.experience || 0),
        rank:  s.rank ?? -1,
      };
    }
    const overall = snap.overall || {};
    totalLevel = overall.level || 0;
    totalXp    = overall.experience || 0;
    return {
      name: json.displayName || json.username || 'You',
      skills, totalLevel, totalXp,
      fetchedAt: Date.now(),
      source: 'wom',
    };
  }

  async function fetchViaWom(username) {
    const WOM = 'https://api.wiseoldman.net/v2/players/' + encodeURIComponent(username);
    let r = await fetch(WOM, { cache: 'no-cache' });
    if (r.status === 404) {
      // Player not yet tracked on WOM — register them, then retry
      try {
        await fetch(WOM, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
      } catch (_) {}
      await new Promise(res => setTimeout(res, 2500));
      r = await fetch(WOM, { cache: 'no-cache' });
    }
    if (!r.ok) throw new Error('WOM returned ' + r.status);
    return parseWom(await r.json());
  }

  // Trigger WOM to refetch from official hiscores (call sparingly)
  async function refreshWom(username) {
    const WOM = 'https://api.wiseoldman.net/v2/players/' + encodeURIComponent(username);
    try {
      await fetch(WOM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch (_) {}
  }

  async function fetchStats(username) {
    // 1. Local PowerShell server (best when running via start.bat)
    if (isLocalServer) {
      const r = await fetch('/api/hiscores?player=' + encodeURIComponent(username), { cache: 'no-cache' });
      if (!r.ok) throw new Error('Local proxy returned ' + r.status);
      return parseJson(await r.json());
    }
    // 2. WiseOldMan API (CORS-enabled — works on GitHub Pages, any HTTPS origin)
    try {
      return await fetchViaWom(username);
    } catch (e) {
      console.warn('WOM failed:', e.message);
    }
    // 3. Public CORS proxies (last resort)
    const url = HISCORES_BASE + encodeURIComponent(username);
    const json = await tryFetch(url);
    return parseJson(json);
  }

  // ---------- Manual stat entry (fallback for unranked / offline) ----------
  const MANUAL_KEY = 'bvels10_manual_stats';

  function saveManual(stats) {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(stats));
  }

  function loadManual() {
    try {
      const raw = localStorage.getItem(MANUAL_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      // Build same shape as parseJson
      const skills = {};
      let totalLevel = 0, totalXp = 0;
      for (const meta of SKILL_META) {
        const lvl = Math.max(1, parseInt(obj[meta.id]?.level) || 1);
        const xp  = Math.max(0, parseInt(obj[meta.id]?.xp)    || xpForLevel(lvl));
        skills[meta.id] = { level: lvl, xp: xp, rank: -1 };
        totalLevel += lvl;
        totalXp += xp;
      }
      return { skills, totalLevel, totalXp, fetchedAt: Date.now(),
               name: obj.name || 'You', manual: true };
    } catch { return null; }
  }

  function clearManual() { localStorage.removeItem(MANUAL_KEY); }
  function hasManual()   { return !!localStorage.getItem(MANUAL_KEY); }

  // ---------- polling ----------
  let pollTimer = null;
  let pollListeners = [];
  let currentUsername = null;
  let lastStats = null;
  let pollCount = 0;
  const POLL_MS = 90 * 1000;

  function startPolling(username, onUpdate) {
    currentUsername = username;
    if (onUpdate) pollListeners.push(onUpdate);
    stopPolling();
    pollOnce();
    pollTimer = setInterval(pollOnce, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  async function pollOnce() {
    if (!currentUsername) return;
    if (document.hidden) return; // polite: don't poll when tab hidden
    try {
      pollCount++;
      // Every 5th poll (~7.5 min) when running via WOM, trigger a fresh hiscores refetch
      if (!isLocalServer && pollCount % 5 === 0) {
        refreshWom(currentUsername).catch(() => {});
      }
      const stats = await fetchStats(currentUsername);
      const diff = lastStats ? computeDiff(lastStats, stats) : null;
      lastStats = stats;
      for (const cb of pollListeners) cb(stats, diff);
    } catch (e) {
      console.warn('Hiscores poll failed:', e);
    }
  }

  function computeDiff(prev, next) {
    const skillDiffs = {};
    let anyGained = false;
    for (const meta of SKILL_META) {
      const p = prev.skills[meta.id], n = next.skills[meta.id];
      if (!p || !n) continue;
      const xpDiff = n.xp - p.xp;
      const lvlDiff = n.level - p.level;
      if (xpDiff > 0 || lvlDiff > 0) {
        skillDiffs[meta.id] = { xpDiff, lvlDiff, fromLvl: p.level, toLvl: n.level };
        anyGained = true;
      }
    }
    return anyGained ? skillDiffs : null;
  }

  // Resume polling when tab becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pollOnce();
  });

  return { fetchStats, startPolling, stopPolling, pollOnce: () => pollOnce(),
           saveManual, loadManual, clearManual, hasManual,
           get lastStats() { return lastStats; } };
})();
