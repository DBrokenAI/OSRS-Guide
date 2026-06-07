/* ==========================================================
   Goals — custom user goals with ETA from xp/hr
   Storage: localStorage['bvels10_goals_v1']
   Each goal: { id, type:'skill'|'task', skill?, targetLevel?, taskText?, deadline?, createdAt, completed }
   ========================================================== */
const Goals = (() => {
  const KEY = 'bvels10_goals_v1';
  let goals = [];

  function load() {
    try { goals = JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { goals = []; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(goals)); }

  function all() { return goals.slice(); }
  function active() { return goals.filter(g => !g.completed); }

  function addSkillGoal(skill, targetLevel, deadline) {
    goals.push({
      id: 'goal_' + Date.now(),
      type: 'skill',
      skill, targetLevel: parseInt(targetLevel),
      deadline: deadline || null,
      createdAt: Date.now(),
      completed: false,
    });
    save();
  }

  function addTaskGoal(taskText, deadline) {
    if (!taskText) return;
    goals.push({
      id: 'goal_' + Date.now(),
      type: 'task',
      taskText: taskText.trim(),
      deadline: deadline || null,
      createdAt: Date.now(),
      completed: false,
    });
    save();
  }

  function toggle(id) {
    const g = goals.find(g => g.id === id);
    if (!g) return;
    g.completed = !g.completed;
    g.completedAt = g.completed ? Date.now() : null;
    save();
    if (g.completed) Journal.add('goal', `🎯 Goal completed: ${describe(g)}`, true);
  }

  function remove(id) {
    goals = goals.filter(g => g.id !== id);
    save();
  }

  function describe(g) {
    if (g.type === 'skill') {
      const m = SKILL_META.find(mm => mm.id === g.skill);
      return `${m?.icon || ''} ${m?.name || g.skill} → ${g.targetLevel}`;
    }
    return g.taskText;
  }

  // ETA calculation for skill goals based on weekly XP gain
  function eta(g, stats, weeklyXp) {
    if (g.type !== 'skill' || !stats) return null;
    const sk = stats.skills?.[g.skill];
    if (!sk) return null;
    const currentLevel = sk.level;
    if (currentLevel >= g.targetLevel) return { done: true };
    const xpNeeded = xpForLevel(g.targetLevel) - sk.xp;
    if (xpNeeded <= 0) return { done: true };
    const xpPerDay = (weeklyXp && weeklyXp[g.skill]) ? weeklyXp[g.skill] / 7 : 0;
    if (xpPerDay <= 0) return { xpNeeded, days: null };
    const days = Math.ceil(xpNeeded / xpPerDay);
    return { xpNeeded, days, xpPerDay };
  }

  function deadlineStatus(g) {
    if (!g.deadline) return null;
    const due = new Date(g.deadline);
    const now = new Date();
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return { days, dueDate: due.toLocaleDateString() };
  }

  load();
  return { all, active, addSkillGoal, addTaskGoal, toggle, remove, describe, eta, deadlineStatus };
})();
