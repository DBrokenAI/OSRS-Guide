/* ==========================================================
   Recommender — turns live stats into prioritized next-steps
   ========================================================== */
const Recommender = (() => {

  function currentTier(skillId, level) {
    const tiers = SKILL_TIERS[skillId];
    if (!tiers) return null;
    return tiers.find(t => level >= t.from && level < t.to)
        || tiers[tiers.length - 1];
  }

  function nextTier(skillId, level) {
    const tiers = SKILL_TIERS[skillId];
    if (!tiers) return null;
    return tiers.find(t => t.from > level);
  }

  function currentCombatLevel(stats) {
    return combatLevel(Object.fromEntries(
      SKILL_META.filter(m => m.combat).map(m => [m.id, stats.skills[m.id]?.level || 1])
    ));
  }

  function questQualifies(quest, stats, completedIds) {
    if (!quest.reqs) return true;
    if (quest.reqs.skill) {
      for (const [skillId, lvl] of Object.entries(quest.reqs.skill)) {
        if ((stats.skills[skillId]?.level || 1) < lvl) return false;
      }
    }
    if (quest.reqs.quests) {
      for (const qid of quest.reqs.quests) {
        if (!completedIds.has(qid)) return false;
      }
    }
    // Practical combat req — can she actually beat the quest fights?
    if (quest.practicalCombat) {
      if (currentCombatLevel(stats) < quest.practicalCombat) return false;
    }
    return true;
  }

  function masterTaskQualifies(task, stats, completedIds) {
    if (!task.reqs) return true;
    if (task.reqs.skill) {
      for (const [skillId, lvl] of Object.entries(task.reqs.skill)) {
        if ((stats.skills[skillId]?.level || 1) < lvl) return false;
      }
    }
    if (task.reqs.combat) {
      if (currentCombatLevel(stats) < task.reqs.combat) return false;
    }
    if (task.reqs.quest) {
      const qid = QUESTS.find(q => q.name === task.reqs.quest)?.id || task.reqs.quest.toLowerCase().replace(/\W+/g, '_');
      if (!completedIds.has(qid)) return false;
    }
    if (task.reqs.task && !completedIds.has(task.reqs.task)) return false;
    return true;
  }

  function readyMasterTasks(stats, completedIds) {
    return MASTER_TASKS
      .filter(t => !completedIds.has(t.id))
      .filter(t => masterTaskQualifies(t, stats, completedIds))
      .sort((a, b) => (a.priority || 9) - (b.priority || 9));
  }

  // "Soon" — within ~10 levels of one missing req
  function nearMasterTasks(stats, completedIds) {
    const cb = currentCombatLevel(stats);
    return MASTER_TASKS
      .filter(t => !completedIds.has(t.id))
      .filter(t => !masterTaskQualifies(t, stats, completedIds))
      .filter(t => {
        if (t.reqs?.combat && t.reqs.combat - cb <= 10 && t.reqs.combat - cb > 0) return true;
        if (t.reqs?.skill) {
          for (const [sid, need] of Object.entries(t.reqs.skill)) {
            const cur = stats.skills[sid]?.level || 1;
            if (need - cur > 0 && need - cur <= 10) return true;
          }
        }
        return false;
      })
      .sort((a, b) => (a.priority || 9) - (b.priority || 9));
  }

  function nearQuests(stats, completedIds) {
    const cb = currentCombatLevel(stats);
    return QUESTS
      .filter(q => !completedIds.has(q.id))
      .filter(q => !questQualifies(q, stats, completedIds))
      .filter(q => {
        // missing only practical combat by ≤10
        if (q.practicalCombat && q.practicalCombat - cb > 0 && q.practicalCombat - cb <= 10) {
          // also check that skill/quest prereqs are met
          if (q.reqs?.skill) {
            for (const [sid, need] of Object.entries(q.reqs.skill)) {
              if ((stats.skills[sid]?.level || 1) < need) return false;
            }
          }
          if (q.reqs?.quests) {
            for (const qid of q.reqs.quests) if (!completedIds.has(qid)) return false;
          }
          return true;
        }
        return false;
      })
      .sort((a, b) => (a.priority || 9) - (b.priority || 9));
  }

  function readyQuests(stats, completedIds) {
    return QUESTS
      .filter(q => !completedIds.has(q.id))
      .filter(q => questQualifies(q, stats, completedIds))
      .sort((a, b) => (a.priority || 9) - (b.priority || 9));
  }

  function lockedQuests(stats, completedIds) {
    return QUESTS
      .filter(q => !completedIds.has(q.id))
      .filter(q => !questQualifies(q, stats, completedIds));
  }

  function gearForLevel(category, stats) {
    const all = GEAR_BREAKPOINTS[category] || [];
    const meta = {
      melee: { att: stats.skills.attack?.level || 1, def: stats.skills.defence?.level || 1 },
      ranged: { rng: stats.skills.ranged?.level || 1, def: stats.skills.defence?.level || 1 },
      magic: { mag: stats.skills.magic?.level || 1, def: stats.skills.defence?.level || 1 },
    }[category];
    // group by slot, pick best each slot
    const bySlot = {};
    for (const g of all) {
      const passes =
        category === 'melee' ? (meta.att >= g.lvl || meta.def >= g.lvl)
        : category === 'ranged' ? meta.rng >= g.lvl
        : meta.mag >= g.lvl;
      if (passes) {
        const slot = g.slot || 'misc';
        bySlot[slot] = bySlot[slot] || [];
        bySlot[slot].push(g);
      }
    }
    const result = {};
    for (const slot of Object.keys(bySlot)) {
      bySlot[slot].sort((a, b) => b.lvl - a.lvl);
      result[slot] = bySlot[slot][0];
    }
    return result;
  }

  function bossReady(boss, stats) {
    const cb = combatLevel(stats.skills && Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, stats.skills[m.id]?.level || 1])));
    const r = boss.reqs || {};
    if (r.combat && cb < r.combat) return false;
    if (r.att   && (stats.skills.attack?.level   || 1) < r.att) return false;
    if (r.str   && (stats.skills.strength?.level || 1) < r.str) return false;
    if (r.def   && (stats.skills.defence?.level  || 1) < r.def) return false;
    if (r.range && (stats.skills.ranged?.level   || 1) < r.range) return false;
    if (r.mage  && (stats.skills.magic?.level    || 1) < r.mage) return false;
    if (r.prayer&& (stats.skills.prayer?.level   || 1) < r.prayer) return false;
    if (r.range_or_mage) {
      if ((stats.skills.ranged?.level || 1) < r.range_or_mage && (stats.skills.magic?.level || 1) < r.range_or_mage) return false;
    }
    return true;
  }

  function readyBosses(stats) {
    return BOSSES.filter(b => bossReady(b, stats));
  }

  // ---------- "What to do next" — only show what she can actually do NOW ----------
  function topRecommendations(stats, completedQuestIds) {
    const recs = [];
    const cb = currentCombatLevel(stats);
    const att = stats.skills.attack?.level || 1;
    const str = stats.skills.strength?.level || 1;
    const def = stats.skills.defence?.level || 1;
    const hp  = stats.skills.hitpoints?.level || 1;
    const rng = stats.skills.ranged?.level || 1;
    const mag = stats.skills.magic?.level || 1;
    const pray= stats.skills.prayer?.level || 1;

    // ===== 1. ZERO-REQUIREMENT WINS (do these any time) =====

    if (!completedQuestIds.has('stronghold_of_security')) {
      recs.push({
        id: 'stronghold_of_security', type: 'master',
        priority: 1, icon: '🛡️', tag: 'green', cat: 'starter',
        title: `Stronghold of Security — free 10,000 gp + boots`,
        detail: '30 min, no combat reqs. Read the dialogue (it teaches account security), get 10K gp and Fancy or Fighter boots.',
        wiki: WIKI('Stronghold of Security'),
      });
    }

    if (pray < 9 && !completedQuestIds.has('restless_ghost')) {
      recs.push({
        id: 'restless_ghost', type: 'quest',
        priority: 1, icon: '🙏', tag: 'gold', cat: 'quest',
        title: `The Restless Ghost (F2P) — Prayer 1 → 9, no combat needed`,
        detail: 'Free 1,125 Prayer XP. Path to Prayer 43 (Protect prayers — biggest combat unlock).',
        wiki: WIKI('The Restless Ghost'),
      });
    }

    if (mag < 5 && !completedQuestIds.has('witchs_potion')) {
      recs.push({
        id: 'witchs_potion', type: 'quest',
        priority: 1, icon: '🔮', tag: 'blue', cat: 'quest',
        title: `Witch's Potion — Magic 1 → 5, no combat needed (10 min)`,
        detail: 'Tiny F2P quest. 325 Magic XP. Tied with Cook\'s Assistant as the fastest XP per minute.',
        wiki: WIKI("Witch's Potion"),
      });
    }

    if (!completedQuestIds.has('cooks_assistant')) {
      recs.push({
        id: 'cooks_assistant', type: 'quest',
        priority: 2, icon: '🍳', tag: 'green', cat: 'quest',
        title: `Cook's Assistant — 300 Cooking XP in 5 min`,
        detail: 'Easy F2P. Talk to the Cook in Lumbridge Castle kitchen. Bring milk, egg, flour from the cattle field nearby.',
        wiki: WIKI("Cook's Assistant"),
      });
    }

    if (!completedQuestIds.has('sheep_shearer')) {
      recs.push({
        id: 'sheep_shearer', type: 'quest',
        priority: 2, icon: '✂️', tag: 'green', cat: 'quest',
        title: `Sheep Shearer — 150 Crafting XP in 5 min`,
        detail: 'F2P. Get shears from Fred the Farmer, shear 20 sheep, return the wool.',
        wiki: WIKI('Sheep Shearer'),
      });
    }

    if (!completedQuestIds.has('imp_catcher') && mag < 13) {
      recs.push({
        id: 'imp_catcher', type: 'quest',
        priority: 2, icon: '🔮', tag: 'blue', cat: 'quest',
        title: `Imp Catcher — 875 Magic XP (gets you Magic 8+)`,
        detail: 'F2P. Easy: buy 4 beads from GE, give to Wizard Mizgog. Path toward Magic 13 (Curse spells).',
        wiki: WIKI('Imp Catcher'),
      });
    }

    if (!completedQuestIds.has('dorics_quest')) {
      recs.push({
        id: 'dorics_quest', type: 'quest',
        priority: 2, icon: '⛏️', tag: 'green', cat: 'quest',
        title: `Doric's Quest — Mining 1 → 10`,
        detail: 'F2P. Bring 6 clay, 4 copper, 2 iron ore to Doric (north of Falador). Quick easy Mining start.',
        wiki: WIKI("Doric's Quest"),
      });
    }

    if (!completedQuestIds.has('druidic_ritual')) {
      recs.push({
        id: 'druidic_ritual', type: 'quest',
        priority: 1, icon: '🌿', tag: 'gold', cat: 'quest',
        title: `Druidic Ritual — UNLOCKS Herblore (members)`,
        detail: 'Members only. No combat. Short. Without this you literally cannot train Herblore.',
        wiki: WIKI('Druidic Ritual'),
      });
    }

    // ===== 2. STATS BEHIND OTHER STATS (catch-up suggestions) =====

    // HP behind melee
    if (hp < Math.max(att, str) - 5 && !completedQuestIds.has('witchs_house') && cb >= 35) {
      recs.push({
        id: 'witchs_house', type: 'quest',
        priority: 1, icon: '❤️', tag: 'gold', cat: 'quest',
        title: `Witch's House — free 6,325 HP XP (instantly Level 23 HP)`,
        detail: 'F2P. Combat 35+ recommended (consecutive Shapeshifter fight, no break). Your HP is behind your melee — this catches it up.',
        wiki: WIKI("Witch's House"),
      });
    }

    // Defence way behind
    if (def === 1 && Math.max(att, str) >= 20) {
      recs.push({
        id: 'train_defence_30', type: 'skill',
        priority: 1, icon: '🛡️', tag: 'red', cat: 'skill',
        title: `🚨 Defence is still 1 — train it to 30 at Sand Crabs (Defensive style)`,
        detail: `Without Defence you can't wear armor and you take massive damage. Crabclaw Isle (Hosidius) — multi-combat, AFK. ~20K xp/hr at your level.`,
      });
    }

    // ===== 3. PRACTICAL QUESTS SHE CAN DO RIGHT NOW =====
    const readyQs = readyQuests(stats, completedQuestIds).slice(0, 4);
    for (const q of readyQs) {
      if (recs.some(r => r.id === q.id)) continue;
      recs.push({
        id: q.id, type: 'quest',
        priority: q.priority || 3,
        icon: '📜', tag: 'ready', cat: 'quest',
        title: `${q.name} — ${q.length || ''}`,
        detail: q.why + (q.rewards?.length ? ` Rewards: ${q.rewards.slice(0, 2).join(', ')}.` : ''),
        wiki: WIKI(q.name),
      });
    }

    // ===== 4. MASTER TASKS SHE QUALIFIES FOR =====
    const readyTasks = readyMasterTasks(stats, completedQuestIds)
      .filter(t => t.category !== 'milestone')
      .slice(0, 5);
    for (const t of readyTasks) {
      if (recs.some(r => r.id === t.id)) continue;
      recs.push({
        id: t.id, type: 'master',
        priority: t.priority || 3,
        icon: t.icon, tag: t.priority === 1 ? 'gold' : 'green', cat: t.category,
        title: t.name,
        detail: t.why + (t.how ? `<br><em>How:</em> ${t.how}` : ''),
        wiki: t.wiki ? WIKI(t.wiki) : null,
      });
    }

    // ===== 5. CURRENT BEST METHOD for her 1-2 weakest non-combat skills =====
    const weakSkills = SKILL_META
      .filter(m => !m.combat)
      .map(m => ({ id: m.id, name: m.name, icon: m.icon, lvl: stats.skills[m.id]?.level || 1 }))
      .filter(s => s.lvl < 50)
      .sort((a, b) => a.lvl - b.lvl)
      .slice(0, 2);
    for (const w of weakSkills) {
      const tier = currentTier(w.id, w.lvl);
      if (!tier) continue;
      recs.push({
        id: `train_${w.id}`, type: 'skill',
        priority: 4, icon: w.icon, tag: 'blue', cat: 'skill',
        title: `${w.name} ${w.lvl} → ${tier.name} (${tier.xpHr} xp/hr)`,
        detail: `${tier.where}. ${tier.why}`,
      });
    }

    // Dedupe by title, sort by priority, cap at 8
    const seen = new Set();
    return recs
      .filter(r => !seen.has(r.title) && seen.add(r.title))
      .sort((a, b) => (a.priority || 9) - (b.priority || 9))
      .slice(0, 8);
  }

  // "Coming up next" — within ~10 levels of being ready
  function comingUpRecommendations(stats, completedQuestIds) {
    const cb = currentCombatLevel(stats);
    const upcoming = [];

    // Near-ready quests
    for (const q of nearQuests(stats, completedQuestIds).slice(0, 4)) {
      upcoming.push({
        icon: '📜', cat: 'quest', tag: 'locked',
        title: q.name,
        detail: `Need combat ${q.practicalCombat} (you're ${cb}). ${q.why}`,
        wiki: WIKI(q.name),
      });
    }

    // Near-ready master tasks
    for (const t of nearMasterTasks(stats, completedQuestIds).slice(0, 6)) {
      const missing = [];
      if (t.reqs?.combat && cb < t.reqs.combat) missing.push(`Combat ${t.reqs.combat} (you: ${cb})`);
      if (t.reqs?.skill) {
        for (const [sid, need] of Object.entries(t.reqs.skill)) {
          const cur = stats.skills[sid]?.level || 1;
          if (cur < need) {
            const m = SKILL_META.find(mm => mm.id === sid);
            missing.push(`${m?.name || sid} ${need} (you: ${cur})`);
          }
        }
      }
      upcoming.push({
        icon: t.icon, cat: t.category, tag: 'locked',
        title: t.name,
        detail: `<strong>Need:</strong> ${missing.join(', ')}.<br>${t.why}`,
        wiki: t.wiki ? WIKI(t.wiki) : null,
      });
    }

    return upcoming.slice(0, 8);
  }

  function readyDiaryTasks(_stats) {
    // We don't know which specific tasks she's done; show them all as a checklist.
    return DIARIES_EASY;
  }

  return { topRecommendations, comingUpRecommendations,
           readyQuests, lockedQuests, readyBosses,
           readyMasterTasks, nearMasterTasks, nearQuests,
           currentTier, nextTier, gearForLevel, readyDiaryTasks,
           currentCombatLevel };
})();
