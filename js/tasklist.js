/* ==========================================================
   TaskList — persistent checklist of next actions
   Storage: localStorage['bvels10_tasks']
   Each task: { id, label, meta, done, source: 'auto'|'manual', ts }
   ========================================================== */
const TaskList = (() => {
  const KEY = 'bvels10_tasks_v1';
  let tasks = [];
  let listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      tasks = raw ? JSON.parse(raw) : [];
    } catch (e) { tasks = []; }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(tasks));
    for (const cb of listeners) cb(tasks);
  }

  function all() { return tasks.slice(); }
  function open() { return tasks.filter(t => !t.done); }
  function done() { return tasks.filter(t => t.done); }

  function add({ id, label, meta, source = 'manual' }) {
    if (id && tasks.some(t => t.id === id)) return; // dedupe
    tasks.push({
      id: id || ('task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
      label, meta: meta || '', done: false, source, ts: Date.now(),
    });
    save();
  }

  function addManual(label) {
    if (!label || !label.trim()) return;
    add({ label: label.trim(), source: 'manual' });
  }

  function toggle(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    t.done = !t.done;
    t.completedAt = t.done ? Date.now() : null;
    save();
    if (t.done && window.Journal) Journal.add('task', `✅ Completed: ${t.label}`);
  }

  function remove(id) {
    tasks = tasks.filter(t => t.id !== id);
    save();
  }

  function clearDone() {
    tasks = tasks.filter(t => !t.done);
    save();
  }

  function syncFromRecommendations(recs) {
    // Add any new auto-recommendations as tasks (if not already present, and not already completed)
    for (const r of recs) {
      const id = 'auto_' + (r.action?.id || r.title).replace(/\W+/g, '_').toLowerCase().slice(0, 40);
      if (!tasks.some(t => t.id === id)) {
        add({ id, label: r.title, meta: r.detail || '', source: 'auto' });
      }
    }
  }

  function markCompleteByQuest(questId) {
    const id = 'auto_' + questId;
    const t = tasks.find(t => t.id === id || t.id === 'auto_' + questId);
    if (t) { t.done = true; t.completedAt = Date.now(); save(); }
  }

  function on(cb) { listeners.push(cb); }

  load();
  return { all, open, done, add, addManual, toggle, remove, clearDone,
           syncFromRecommendations, markCompleteByQuest, on };
})();
