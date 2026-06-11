/* ==========================================================
   PendingXp — DEPRECATED / NEUTRALIZED.

   This module USED to overlay quest XP on top of your stats
   ("Mark done → +325 Magic"). That caused a bug: in manual mode
   the overlay never reconciled, so every quest you marked done
   permanently inflated your level — making "Up Next" recommend
   content you weren't actually high enough for.

   New model (see actions / UI.applyAction): your levels are a
   SINGLE SOURCE OF TRUTH (live hiscores OR what you typed/told
   the AI). Marking a quest done only records completion — it
   never silently changes a skill level. If you want a level
   bumped, set it explicitly ("set magic to 6" / manual editor).

   apply() is now a passthrough. On first load it ALSO wipes any
   legacy pending XP so existing users instantly stop seeing
   inflated levels.
   ========================================================== */
const PendingXp = (() => {
  const KEY = 'bvels10_pending_xp_v1';

  // One-time migration: clear any leftover inflated pending XP.
  try { localStorage.removeItem(KEY); } catch (_) {}

  function noop() {}
  function apply(stats) { return stats; } // single source of truth — no overlay

  return {
    get: () => 0,
    all: () => ({}),
    add: noop,
    clear: noop,
    clearSkill: noop,
    apply,
  };
})();
