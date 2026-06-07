/* ==========================================================
   AI Assistant — chat panel using Pollinations free LLM API
   (no signup, CORS-enabled, works on GitHub Pages).
   Storage: localStorage['bvels10_chat_v1']
   ========================================================== */
const AIChat = (() => {
  const KEY = 'bvels10_chat_v1';
  const CONFIG_KEY = 'bvels10_ai_config_v1';
  const MAX_HISTORY = 50;

  // Provider presets (OpenAI-compatible chat completions)
  const PROVIDERS = {
    openrouter: {
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'meta-llama/llama-3.2-3b-instruct:free',
      signupUrl: 'https://openrouter.ai/keys',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': location.origin,
        'X-Title': 'bvels10 OSRS Guide',
      }),
    },
    groq: {
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      defaultModel: 'llama-3.3-70b-versatile',
      signupUrl: 'https://console.groq.com/keys',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
    },
    openai: {
      name: 'OpenAI',
      url: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
      signupUrl: 'https://platform.openai.com/api-keys',
      headers: (key) => ({
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      }),
    },
    anthropic: {
      name: 'Anthropic',
      url: 'https://api.anthropic.com/v1/messages',
      defaultModel: 'claude-3-5-haiku-20241022',
      signupUrl: 'https://console.anthropic.com/settings/keys',
      headers: (key) => ({
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      }),
      isAnthropic: true,
    },
    // Fallback only — free public, rate-limited
    pollinations: {
      name: 'Pollinations (free, often overloaded)',
      url: 'https://text.pollinations.ai/openai',
      defaultModel: 'openai',
      signupUrl: null,
      headers: () => ({ 'Content-Type': 'application/json' }),
      noAuth: true,
    },
  };

  let messages = []; // [{ role:'user'|'assistant', content, ts }]

  function load() {
    try { messages = JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { messages = []; }
  }
  function save() {
    if (messages.length > MAX_HISTORY) messages = messages.slice(-MAX_HISTORY);
    localStorage.setItem(KEY, JSON.stringify(messages));
  }
  function all() { return messages.slice(); }
  function clear() { messages = []; save(); }

  // Build a fresh system prompt with her live context
  function buildSystemPrompt(stats, completedQuestIds) {
    const cb = stats ? combatLevel(Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, stats.skills[m.id]?.level || 1]))) : '?';
    const statLines = SKILL_META.map(m => `${m.name} ${stats?.skills?.[m.id]?.level || 1}`).join(', ');
    const recentJournal = Journal.all().slice(0, 5).map(e => `- ${e.text}`).join('\n');
    const questCount = completedQuestIds?.size || 0;

    return `You are a friendly, encouraging Old School RuneScape guide for a beginner player. Keep answers concise (2-4 short paragraphs max), accurate, and personalized to her stats. Use 💖 ✨ sparingly to keep the vibe fun. If unsure of an exact number/level, say so rather than guess.

PLAYER CONTEXT (live):
- Username: ${stats?.name || 'bvels10'}
- Combat level: ${cb}
- Total level: ${stats?.totalLevel || '?'}
- Quests marked complete: ${questCount}
- Stats: ${statLines}

RECENT ACTIVITY:
${recentJournal || '(nothing yet)'}

INSTRUCTIONS:
- Reference her specific stats when relevant ("at your Magic 1, the best thing to do is...").
- Suggest concrete next actions she can take in-game right now.
- If she asks about a quest/boss/item, give: requirements, location, and a 1-line tip.
- If she asks "what should I do next?" — pick ONE thing based on her stats and explain why.
- Don't bombard her with options. Beginner-friendly tone.
- Format with short paragraphs and bullet points; don't write walls of text.`;
  }

  // ---------- LOCAL KNOWLEDGE-BASE answers (instant, no rate limit) ----------
  // Tries to match common question patterns and answer from our own data.
  // Returns string if matched, null if not.
  function localAnswer(text, stats, completedQuestIds) {
    const q = text.toLowerCase().trim();
    const cb = stats ? combatLevel(Object.fromEntries(SKILL_META.filter(m => m.combat).map(m => [m.id, stats.skills[m.id]?.level || 1]))) : 1;

    // Greetings — match anywhere in short messages
    if (q.length < 20 && /\b(hi+|hello+|hey+|sup|yo+|hiya|wassup|what'?s? up|good morning|good evening|gm|ge)\b/i.test(q)) {
      return `Hi ${stats?.name || 'there'}! 💖\n\nI'm your OSRS guide. Ask me anything — try:\n• "what should I do next?"\n• "how do I make money?"\n• "where do I train mining?"\n• "tell me about vorkath"\n• "how do I do witch's house?"\n\nOr browse the tabs on the left ✨`;
    }

    // Help / what can you do
    if (/(what (can|do) you|help|how does this work|what (do|should) i (ask|say))/i.test(q)) {
      return `I can help with 💕\n\n• "what should I do next?" — personalized recommendations\n• "how do I make money?" — best gp/hr methods\n• "what gear should I wear?" — best items for your stats\n• "where do I train [skill]?" — current best method\n• "how do I get [skill] to [lvl]?" — XP needed + ETA\n• "tell me about [boss/quest/item]" — info lookup\n• "how do I do [quest]?" — walkthrough\n• "what's my combat level?" — stats check\n\nI also know about gear, slayer monsters, achievement diaries, daily routines, and pets. Just ask 💖`;
    }

    // Thanks
    if (/^(thanks|thank you|thx|ty|cool|awesome|nice|great|cute)[!.?]*$/i.test(q)) {
      return `You're welcome! 💖✨ ask me anything else whenever`;
    }

    // "What should I do next?"
    if (/(what.{0,15}(should|do).{0,15}(next|now)|next up|i'?m bored|what to do)/i.test(q)) {
      const recs = Recommender.topRecommendations(stats, completedQuestIds).slice(0, 4);
      if (!recs.length) return null;
      return `Here's what I'd focus on right now 💖\n\n` +
        recs.map((r, i) => `${i+1}. ${r.icon} ${stripHtml(r.title)}\n   ${stripHtml(r.detail).slice(0, 180)}`).join('\n\n') +
        `\n\nTap Next Up tab for more. ✨`;
    }

    // "How do I make money?"
    if (/(make money|gp\s*\/?\s*hr|money making|cash|gold)/i.test(q)) {
      const yours = MONEY_METHODS.filter(m => !m.reqs.match(/\d+/) || true).slice(0, 5);
      return `Best money methods for your level 💰\n\n` +
        yours.map(m => `• ${m.name} — ${m.gpHr}\n  ${m.summary}\n  Reqs: ${m.reqs}`).join('\n\n');
    }

    // "What gear should I wear?"
    if (/(what.{0,10}gear|best gear|gear.{0,10}wear|gear progression|what.{0,10}wear)/i.test(q)) {
      const melee = Recommender.gearForLevel('melee', stats);
      const lines = [];
      for (const slot of ['weapon','head','body','legs','boots','amulet','cape']) {
        const g = melee[slot];
        if (g) lines.push(`• ${slot}: ${g.item}${g.where ? ` (${g.where})` : ''}`);
      }
      return `Best melee gear you can wear right now ⚔️\n\n${lines.join('\n')}\n\nCheck the 🛡️ Gear tab for ranged + magic too.`;
    }

    // "How do I do X quest?" — look up walkthrough
    for (const [qid, walkthrough] of Object.entries(QUEST_WALKTHROUGHS)) {
      const quest = QUESTS.find(qq => qq.id === qid);
      if (!quest) continue;
      const nameLower = quest.name.toLowerCase();
      if (q.includes(nameLower) || q.includes(nameLower.replace("'", ""))) {
        return `Walkthrough for **${quest.name}** 📜\n\n` +
          walkthrough.map((step, i) => `${i+1}. ${step}`).join('\n');
      }
    }

    // "Tell me about X boss"
    for (const b of BOSSES) {
      if (q.includes(b.name.toLowerCase()) && (q.includes('boss') || q.includes('how') || q.includes('kill') || q.includes('fight'))) {
        return `${b.name} 👑\n\n• Location: ${b.location}\n• Requirements: ${b.suggestedStats}\n• Drops: ${b.loot}\n• Why: ${b.why}`;
      }
    }

    // "What's my combat level?" / stat question
    if (/combat level|my combat|how strong/i.test(q)) {
      return `You're combat level ${cb} ⚔️\n\nKey stats:\n• Attack ${stats.skills.attack?.level}\n• Strength ${stats.skills.strength?.level}\n• Defence ${stats.skills.defence?.level}\n• HP ${stats.skills.hitpoints?.level}\n• Ranged ${stats.skills.ranged?.level}\n• Magic ${stats.skills.magic?.level}\n• Prayer ${stats.skills.prayer?.level}`;
    }

    // "Where do I train X?"
    const trainMatch = q.match(/(?:where|how)\s+(?:do\s+i\s+)?train\s+(\w+)/i);
    if (trainMatch) {
      const skillName = trainMatch[1].toLowerCase();
      const meta = SKILL_META.find(m => m.name.toLowerCase() === skillName);
      if (meta) {
        const lvl = stats.skills[meta.id]?.level || 1;
        const tier = Recommender.currentTier(meta.id, lvl);
        if (tier) {
          return `${meta.icon} ${meta.name} training at your level ${lvl}:\n\n` +
            `📍 ${tier.name}\n• Where: ${tier.where}\n• XP/hr: ${tier.xpHr}\n• Switch at level ${tier.to} to next method\n\n${tier.why}`;
        }
      }
    }

    // "What slayer task is good?"
    if (/slayer.{0,10}task|good.{0,10}task/i.test(q)) {
      const slLvl = stats.skills.slayer?.level || 1;
      const tasks = SLAYER_MONSTERS.filter(m => m.reqs.slayer <= slLvl).slice(0, 3);
      if (tasks.length) {
        return `Slayer tasks you can do at level ${slLvl} 💀\n\n` +
          tasks.map(t => `• ${t.name} (req ${t.reqs.slayer}) — ${t.location}\n  ${t.tips}`).join('\n\n');
      }
    }

    // "How do I get to X level?" / XP question
    const levelMatch = q.match(/(?:get|train|push)\s+(\w+)\s+to\s+(\d+)/i);
    if (levelMatch) {
      const skillName = levelMatch[1].toLowerCase();
      const target = parseInt(levelMatch[2]);
      const meta = SKILL_META.find(m => m.name.toLowerCase() === skillName);
      if (meta && target > 0 && target <= 99) {
        const cur = stats.skills[meta.id];
        const xpNeeded = Math.max(0, xpForLevel(target) - (cur?.xp || 0));
        if (xpNeeded === 0) return `You're already at ${meta.name} ${target} or higher! ✨`;
        const tier = Recommender.currentTier(meta.id, cur?.level || 1);
        return `${meta.icon} ${meta.name} ${cur?.level || 1} → ${target}:\n\n• XP needed: ${xpNeeded.toLocaleString()}\n${tier ? `• Current best: ${tier.name} @ ${tier.where}\n• ${tier.xpHr} xp/hr` : ''}`;
      }
    }

    return null; // not matched
  }

  function stripHtml(s) {
    return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  async function send(userText, stats, completedQuestIds) {
    if (!userText || !userText.trim()) return null;
    const userMsg = { role: 'user', content: userText.trim(), ts: Date.now() };
    messages.push(userMsg);
    save();

    // 1. Try local knowledge base first (instant, no API)
    const local = localAnswer(userText, stats, completedQuestIds);
    if (local) {
      const aiMsg = { role: 'assistant', content: local, ts: Date.now(), source: 'local' };
      messages.push(aiMsg);
      save();
      return aiMsg;
    }

    // 2. Build prompt + call configured LLM
    const cfg = loadConfig();
    const provider = PROVIDERS[cfg.provider] || PROVIDERS.pollinations;
    const sysPrompt = buildSystemPrompt(stats, completedQuestIds);
    const recent = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

    let body;
    if (provider.isAnthropic) {
      body = {
        model: cfg.model || provider.defaultModel,
        max_tokens: 800,
        system: sysPrompt,
        messages: recent,
      };
    } else {
      body = {
        model: cfg.model || provider.defaultModel,
        messages: [{ role: 'system', content: sysPrompt }, ...recent],
        stream: false,
        temperature: 0.6,
      };
    }

    try {
      const r = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers(cfg.apiKey || ''),
        body: JSON.stringify(body),
      });
      if (r.status === 401 || r.status === 403) {
        throw new Error('Bad API key — check Settings ⚙️');
      }
      if (r.status === 429) {
        throw new Error('Rate limited');
      }
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(`LLM ${r.status}: ${txt.slice(0, 100)}`);
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content
                   || data?.content?.[0]?.text
                   || '(empty response)';
      const aiMsg = { role: 'assistant', content, ts: Date.now() };
      messages.push(aiMsg);
      save();
      return aiMsg;
    } catch (e) {
      // Graceful fallback using local data
      const recs = Recommender.topRecommendations(stats, completedQuestIds).slice(0, 3);
      let fallback;
      if (!cfg.apiKey) {
        fallback = `💖 I can't fully answer that yet — to unlock full AI, click the ⚙️ Settings button and add a free OpenRouter API key (takes 2 min).\n\nMeanwhile, here's what's most relevant to you right now:\n\n`;
      } else {
        fallback = `💭 Couldn't reach the AI (${e.message}). Here's what I know directly:\n\n`;
      }
      if (recs.length) {
        fallback += recs.map((r, i) => `${i+1}. ${r.icon} ${stripHtml(r.title)}\n   ${stripHtml(r.detail).slice(0, 140)}`).join('\n\n') + `\n\n`;
      }
      fallback += `Try asking about a specific quest, skill, or boss — I have detailed info on those 💕`;
      const aiMsg = { role: 'assistant', content: fallback, ts: Date.now() };
      messages.push(aiMsg);
      save();
      return aiMsg;
    }
  }

  // ---------- Config (provider + API key) ----------
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }
  function getProviders() { return PROVIDERS; }

  load();
  return { all, send, clear, loadConfig, saveConfig, getProviders };
})();
