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

  // Compute the smallest "distance" (combined missing levels) to readiness
  function readinessGap(reqs, stats, completedIds) {
    const cb = currentCombatLevel(stats);
    let total = 0;
    let maxSingle = 0;
    const missing = [];
    if (!reqs) return { total: 0, maxSingle: 0, missing };
    if (reqs.combat) {
      const d = reqs.combat - cb;
      if (d > 0) { total += d; maxSingle = Math.max(maxSingle, d); missing.push({ kind: 'combat', name: 'Combat', need: reqs.combat, cur: cb }); }
    }
    if (reqs.skill) {
      for (const [sid, need] of Object.entries(reqs.skill)) {
        const cur = stats.skills[sid]?.level || 1;
        const d = need - cur;
        if (d > 0) {
          total += d; maxSingle = Math.max(maxSingle, d);
          const m = SKILL_META.find(mm => mm.id === sid);
          missing.push({ kind: 'skill', name: m?.name || sid, need, cur, icon: m?.icon });
        }
      }
    }
    if (reqs.quest) {
      const qid = QUESTS.find(q => q.name === reqs.quest)?.id || reqs.quest.toLowerCase().replace(/\W+/g, '_');
      if (!completedIds.has(qid)) {
        total += 999; missing.push({ kind: 'quest', name: reqs.quest });
      }
    }
    if (reqs.quests) {
      for (const qid of reqs.quests) {
        if (!completedIds.has(qid)) {
          total += 999;
          const q = QUESTS.find(qq => qq.id === qid);
          missing.push({ kind: 'quest', name: q?.name || qid });
        }
      }
    }
    return { total, maxSingle, missing };
  }

  // "Coming Up" — ALL locked items sorted by how close she is. Each shows "Do at X" label.
  function nearMasterTasks(stats, completedIds) {
    return MASTER_TASKS
      .filter(t => !completedIds.has(t.id))
      .filter(t => !masterTaskQualifies(t, stats, completedIds))
      .map(t => ({ t, gap: readinessGap(t.reqs, stats, completedIds) }))
      .filter(x => x.gap.total > 0)
      .sort((a, b) => a.gap.total - b.gap.total || (a.t.priority || 9) - (b.t.priority || 9))
      .map(x => Object.assign({}, x.t, { _gap: x.gap }));
  }

  function nearQuests(stats, completedIds) {
    return QUESTS
      .filter(q => !completedIds.has(q.id))
      .filter(q => !questQualifies(q, stats, completedIds))
      .map(q => {
        const reqs = Object.assign({}, q.reqs, q.practicalCombat ? { combat: q.practicalCombat } : {});
        return { q, gap: readinessGap(reqs, stats, completedIds) };
      })
      .filter(x => x.gap.total > 0)
      .sort((a, b) => a.gap.total - b.gap.total || (a.q.priority || 9) - (b.q.priority || 9))
      .map(x => Object.assign({}, x.q, { _gap: x.gap }));
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
      // Dynamic course pick for Graceful pieces based on her current Agility
      let howText = t.how || '';
      if (t.id && t.id.startsWith('graceful_') && t.marksNeeded) {
        howText = gracefulCourseFor(stats.skills.agility?.level || 1, t.marksNeeded);
      }
      recs.push({
        id: t.id, type: 'master',
        priority: t.priority || 3,
        icon: t.icon, tag: t.priority === 1 ? 'gold' : 'green', cat: t.category,
        title: t.name,
        detail: t.why + (howText ? `<br><em>How:</em> ${howText}` : ''),
        wiki: t.wiki ? WIKI(t.wiki) : null,
      });
    }

    // ===== 4b. XP-SHORTCUT QUESTS — surface every uncompleted quest that gives
    //          XP in a skill she's still leveling. She marks done → XP credited →
    //          next thing unlocks. Fully progressive chain. =====
    const xpShortcutSet = new Set();
    for (const q of QUESTS) {
      if (!q.xpRewards) continue;
      if (completedQuestIds.has(q.id)) continue;
      if (!questQualifies(q, stats, completedQuestIds)) continue;
      // Does the quest target a skill she's still leveling (lvl < 70)?
      const helpful = Object.entries(q.xpRewards).some(([sid, xp]) => {
        const cur = stats.skills[sid]?.level || 1;
        return cur < 70 && xp >= 100;
      });
      if (!helpful) continue;
      if (recs.some(r => r.id === q.id)) continue;
      xpShortcutSet.add(q.id);

      const xpLines = Object.entries(q.xpRewards).map(([sid, xp]) => {
        const m = SKILL_META.find(mm => mm.id === sid);
        return `${m?.icon || ''} +${xp.toLocaleString()} ${m?.name || sid}`;
      }).join(' · ');

      recs.push({
        id: q.id, type: 'quest',
        priority: q.priority || 3,
        icon: '✨', tag: 'gold', cat: 'quest',
        title: `${q.name} — ${xpLines}`,
        detail: `${q.why || ''} <br><strong>📊 Free XP:</strong> ${xpLines}. Mark done to credit it instantly.`,
        wiki: WIKI(q.name),
      });
    }

    // ===== 5. CURRENT BEST METHOD for her weakest non-combat skills =====
    // Show ALL non-combat skills under level 20 — beginners need every method spelled out.
    // For higher levels, just show the 3 weakest.
    const allWeak = SKILL_META
      .filter(m => !m.combat)
      .map(m => ({ id: m.id, name: m.name, icon: m.icon, lvl: stats.skills[m.id]?.level || 1 }))
      .filter(s => s.lvl < 99)
      .sort((a, b) => a.lvl - b.lvl);
    const veryLow = allWeak.filter(s => s.lvl < 20);
    const weakSkills = veryLow.length ? veryLow : allWeak.slice(0, 3);

    for (const w of weakSkills) {
      const tier = currentTier(w.id, w.lvl);
      if (!tier) continue;
      // Spread skill training cards across priorities so they don't all cluster
      const priorityByLevel = w.lvl < 5 ? 2 : w.lvl < 15 ? 3 : 4;
      recs.push({
        id: `train_${w.id}`, type: 'skill',
        priority: priorityByLevel, icon: w.icon, tag: 'blue', cat: 'skill',
        title: `Train ${w.name} ${w.lvl} → ${tier.to} at ${tier.name}`,
        detail: `📍 <strong>${tier.where || ''}</strong> · ${tier.xpHr || ''} xp/hr<br>${tier.why || ''}<br><em>Switch at level ${tier.to} to the next method.</em>`,
      });
    }

    // ===== 6. AT 99 IN A SKILL: suggest the next slow skill OR endgame goal =====
    const has99s = SKILL_META.filter(m => (stats.skills[m.id]?.level || 1) >= 99).length;
    if (has99s >= 3) {
      // Suggest the lowest combat-level skill if not yet 99
      const lowestCombat = SKILL_META.filter(m => m.combat)
        .map(m => ({ id: m.id, name: m.name, icon: m.icon, lvl: stats.skills[m.id]?.level || 1 }))
        .filter(s => s.lvl < 99 && s.id !== 'hitpoints')
        .sort((a, b) => a.lvl - b.lvl)[0];
      if (lowestCombat) {
        const tier = currentTier(lowestCombat.id, lowestCombat.lvl);
        if (tier) recs.push({
          id: `endgame_${lowestCombat.id}`, type: 'skill',
          priority: 3, icon: lowestCombat.icon, tag: 'gold', cat: 'skill',
          title: `Push ${lowestCombat.name} (${lowestCombat.lvl}) to 99 — Max Cape progress`,
          detail: `${tier.name} @ ${tier.where} (${tier.xpHr} xp/hr). ${tier.why}`,
        });
      }
    }

    // Dedupe by title, sort by priority. Cap higher so the chain flows.
    const seen = new Set();
    return recs
      .filter(r => !seen.has(r.title) && seen.add(r.title))
      .sort((a, b) => (a.priority || 9) - (b.priority || 9))
      .slice(0, 20);
  }

  function formatMissing(missing) {
    return missing.map(m => {
      if (m.kind === 'combat') return `Combat ${m.need} (you: ${m.cur})`;
      if (m.kind === 'skill')  return `${m.icon || ''} ${m.name} ${m.need} (you: ${m.cur})`;
      if (m.kind === 'quest')  return `Quest: ${m.name}`;
      return '';
    }).filter(Boolean).join(' · ');
  }

  // Quests that give XP in a specific skill (uncompleted only)
  function questsGivingSkill(skillId, completedIds) {
    return QUESTS
      .filter(q => !completedIds.has(q.id))
      .filter(q => q.xpRewards && q.xpRewards[skillId])
      .sort((a, b) => (b.xpRewards[skillId] || 0) - (a.xpRewards[skillId] || 0));
  }

  // For each missing skill in a rec, surface the top quest XP shortcuts
  function boostQuestsForGap(missing, completedIds) {
    const out = [];
    for (const m of missing) {
      if (m.kind !== 'skill') continue;
      const skillId = SKILL_META.find(mm => mm.name === m.name)?.id || m.name.toLowerCase();
      const quests = questsGivingSkill(skillId, completedIds).slice(0, 3);
      for (const q of quests) {
        out.push({
          name: q.name,
          xp: q.xpRewards[skillId],
          skill: m.name,
          skillIcon: m.icon,
        });
      }
    }
    return out;
  }

  // For each missing skill, build a "where to train" hint with the current tier
  function trainingHintsForGap(missing, stats) {
    const out = [];
    for (const m of missing) {
      if (m.kind !== 'skill') continue;
      const skillId = SKILL_META.find(mm => mm.name === m.name)?.id || m.name.toLowerCase();
      const tier = currentTier(skillId, m.cur);
      if (!tier) continue;
      out.push({
        skill: m.name,
        skillIcon: m.icon,
        from: m.cur,
        to: m.need,
        method: tier.name,
        where: tier.where,
        xpHr: tier.xpHr,
        switchAt: tier.to,
        why: tier.why,
      });
    }
    return out;
  }

  // "Coming up next" — ALL locked items, sorted by closest. Caller controls how many.
  function comingUpRecommendations(stats, completedQuestIds, limit = 30) {
    const upcoming = [];

    for (const q of nearQuests(stats, completedQuestIds)) {
      upcoming.push({
        id: `near_${q.id}`, type: 'quest_locked',
        icon: '📜', cat: 'quest', tag: 'locked',
        title: q.name,
        unlockLabel: formatMissing(q._gap.missing),
        trainingHints: trainingHintsForGap(q._gap.missing, stats),
        boostQuests: boostQuestsForGap(q._gap.missing, completedQuestIds),
        detail: q.why,
        wiki: WIKI(q.name),
        _gap: q._gap.total,
      });
    }

    for (const t of nearMasterTasks(stats, completedQuestIds)) {
      upcoming.push({
        id: `near_${t.id}`, type: 'master_locked',
        icon: t.icon, cat: t.category, tag: 'locked',
        title: t.name,
        unlockLabel: formatMissing(t._gap.missing),
        trainingHints: trainingHintsForGap(t._gap.missing, stats),
        boostQuests: boostQuestsForGap(t._gap.missing, completedQuestIds),
        detail: t.why,
        wiki: t.wiki ? WIKI(t.wiki) : null,
        _gap: t._gap,
      });
    }

    // sort by gap (closest first), then priority
    upcoming.sort((a, b) => {
      const ga = typeof a._gap === 'number' ? a._gap : a._gap.total || 0;
      const gb = typeof b._gap === 'number' ? b._gap : b._gap.total || 0;
      return ga - gb;
    });

    return upcoming.slice(0, limit);
  }

  function readyDiaryTasks(_stats) {
    // We don't know which specific tasks she's done; show them all as a checklist.
    return DIARIES_EASY;
  }

  // Lifetime goals — always shown in Next Up as long-term targets
  function lifetimeGoals(stats, completedQuestIds) {
    const goals = [];
    const totalLevel = stats.totalLevel || 0;
    const has99s = SKILL_META.filter(m => (stats.skills[m.id]?.level || 1) >= 99).length;
    const cb = currentCombatLevel(stats);

    // Quest Cape — show progress
    goals.push({
      id: 'lifetime_quest_cape', type: 'master',
      icon: '🦸', cat: 'milestone',
      title: 'Quest Cape — complete every quest',
      detail: `Best non-trophy cape. Use Quest Helper plugin to grind through. You\'re working toward this every time you knock off a quest. Currently ${completedQuestIds.size} marked done.`,
      wiki: WIKI('Quest point cape'),
    });

    // Max Cape — show 99s progress
    goals.push({
      id: 'lifetime_max_cape', type: 'master',
      icon: '👑', cat: 'milestone',
      title: `Max Cape — ${has99s}/23 skills at 99`,
      detail: `The ultimate stats goal. Multi-year for most players. Focus on the slowest skills: Slayer, Agility, Runecrafting, Construction. Total level ${totalLevel}/2277.`,
      wiki: WIKI('Max cape'),
    });

    // Fire Cape / Inferno (combat-gated)
    if (cb >= 70) {
      goals.push({
        id: 'lifetime_fire_cape', type: 'master',
        icon: '🔥', cat: 'gear',
        title: 'Fire Cape — TzHaar Fight Cave',
        detail: '+4 strength bonus cape. Solo 63 waves. Practice on the Inferno HD plugin. Required for Infernal Cape later.',
        wiki: WIKI('Fire cape'),
      });
    }

    // Inferno (high combat)
    if (cb >= 100) {
      goals.push({
        id: 'lifetime_inferno', type: 'master',
        icon: '🌋', cat: 'gear',
        title: 'Infernal Cape — TzKal-Zuk',
        detail: '+4 str, biggest trophy cape in the game. ~10 hr trial, need Tbow ideally. Requires Fire Cape first.',
        wiki: WIKI('Infernal cape'),
      });
    }

    // Achievement Diary Cape
    goals.push({
      id: 'lifetime_diary_cape', type: 'master',
      icon: '📔', cat: 'milestone',
      title: 'Achievement Diary Cape — complete every Elite diary',
      detail: 'Best skill cape stats. Combines every region\'s diary reward. Visit the Diary tab for tasks.',
      wiki: WIKI('Achievement Diary cape'),
    });

    // Comp (endgame trophy)
    if (has99s >= 5 || cb >= 100) {
      goals.push({
        id: 'lifetime_comp_cape', type: 'master',
        icon: '🏆', cat: 'milestone',
        title: 'Completionist — Combat Achievements + all pets + music',
        detail: 'The true OSRS endgame. Combat Achievements (Easy → Grandmaster), all pets, music cape, all collection log entries.',
        wiki: WIKI('Combat Achievements'),
      });
    }

    return goals;
  }

  return { topRecommendations, comingUpRecommendations, lifetimeGoals,
           readyQuests, lockedQuests, readyBosses,
           readyMasterTasks, nearMasterTasks, nearQuests,
           currentTier, nextTier, gearForLevel, readyDiaryTasks,
           currentCombatLevel };
})();
