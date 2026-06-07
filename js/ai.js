/* ==========================================================
   AI Assistant — chat panel using Pollinations free LLM API
   (no signup, CORS-enabled, works on GitHub Pages).
   Storage: localStorage['bvels10_chat_v1']
   ========================================================== */
const AIChat = (() => {
  const KEY = 'bvels10_chat_v1';
  const ENDPOINT = 'https://text.pollinations.ai/openai';
  const MAX_HISTORY = 50; // keep last 50 messages

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

  async function send(userText, stats, completedQuestIds) {
    if (!userText || !userText.trim()) return null;
    const userMsg = { role: 'user', content: userText.trim(), ts: Date.now() };
    messages.push(userMsg);
    save();

    const sysPrompt = buildSystemPrompt(stats, completedQuestIds);
    // Build payload: system + last ~12 turns
    const recent = messages.slice(-12).map(m => ({ role: m.role, content: m.content }));
    const payload = {
      model: 'openai',
      messages: [{ role: 'system', content: sysPrompt }, ...recent],
      stream: false,
    };

    try {
      const r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('LLM returned ' + r.status);
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content || '(no response)';
      const aiMsg = { role: 'assistant', content, ts: Date.now() };
      messages.push(aiMsg);
      save();
      return aiMsg;
    } catch (e) {
      const errMsg = { role: 'assistant', content: `💔 Couldn't reach the AI right now. (${e.message}) Try again in a moment, or ask me directly.`, ts: Date.now(), error: true };
      messages.push(errMsg);
      save();
      return errMsg;
    }
  }

  load();
  return { all, send, clear };
})();
