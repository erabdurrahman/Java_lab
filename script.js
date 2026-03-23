// SaaS-level Todo Application (single-file, no backend)
// Features: priority, due, tags, notes, subtasks, recurring, search/filter/sort,
// bulk actions, import/export, dark mode, localStorage persistence.

const els = {
  form: document.getElementById('todo-form'),
  titleInput: document.getElementById('todo-input'),
  prioritySelect: document.getElementById('priority-select'),
  dueInput: document.getElementById('due-input'),
  tagsInput: document.getElementById('tags-input'),
  notesInput: document.getElementById('notes-input'),
  recurringEnabled: document.getElementById('recurring-enabled'),
  recurringSelect: document.getElementById('recurring-select'),

  list: document.getElementById('todo-list'),

  itemsLeft: document.getElementById('items-left'),
  summaryProgress: document.getElementById('summary-progress'),
  summaryCounts: document.getElementById('summary-counts'),

  clearCompleted: document.getElementById('clear-completed'),

  filterButtons: Array.from(document.querySelectorAll('.seg-btn')), 
  searchInput: document.getElementById('search-input'),
  sortSelect: document.getElementById('sort-select'),

  bulkbar: document.getElementById('bulkbar'),
  selectAll: document.getElementById('select-all'),
  bulkComplete: document.getElementById('bulk-complete'),
  bulkDelete: document.getElementById('bulk-delete'),
  selectedCount: document.getElementById('selected-count'),

  themeToggle: document.getElementById('theme-toggle'),
  exportBtn: document.getElementById('export-btn'),
  importFile: document.getElementById('import-file'),

  dialog: document.getElementById('task-dialog'),
  dialogForm: document.getElementById('task-dialog-form'),
  dialogId: document.getElementById('dialog-id'),
  dialogTitle: document.getElementById('dialog-title'),
  dialogPriority: document.getElementById('dialog-priority'),
  dialogDue: document.getElementById('dialog-due'),
  dialogTags: document.getElementById('dialog-tags'),
  dialogNotes: document.getElementById('dialog-notes'),
  dialogSubtasks: document.getElementById('dialog-subtasks'),
  dialogRecurringEnabled: document.getElementById('dialog-recurring-enabled'),
  dialogRecurringType: document.getElementById('dialog-recurring-type'),
};

const STORAGE_KEY = 'todos_v2';
const UI_KEY = 'todo_ui_v1';

const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };

let state = {
  todos: [],
  ui: {
    filter: 'all',
    search: '',
    sort: 'created_desc',
    theme: 'light',
    selected: {}, // id -> true
  }
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function nowISO() {
  return new Date().toISOString();
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

function load() {
  const rawTodos = localStorage.getItem(STORAGE_KEY);
  const rawUi = localStorage.getItem(UI_KEY);

  state.todos = safeParse(rawTodos, []);
  const ui = safeParse(rawUi, null);

  if (ui && typeof ui === 'object') {
    state.ui = {
      ...state.ui,
      ...ui,
      selected: {}, // never persist selection
    };
  }

  // migration: old format [{text, completed}] -> new format
  if (state.todos.length && state.todos[0] && state.todos[0].text && !state.todos[0].title) {
    state.todos = state.todos.map(t => ({
      id: uid(),
      title: t.text,
      completed: !!t.completed,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      priority: 'medium',
      dueAt: null,
      tags: [],
      notes: '',
      subtasks: [],
      recurring: null,
      completedAt: t.completed ? nowISO() : null,
    }));
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
  localStorage.setItem(UI_KEY, JSON.stringify({ ...state.ui, selected: {} }));
}

function setTheme(theme) {
  state.ui.theme = theme;
  document.documentElement.dataset.theme = theme;
  save();
}

function normalizeTags(str) {
  return (str || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseSubtasks(textAreaValue) {
  const lines = (textAreaValue || '').split('\n').map(l => l.trim()).filter(Boolean);
  return lines.slice(0, 30).map(line => {
    const clean = line.replace(/^-+\s*/, '');
    return { id: uid(), title: clean, done: false };
  });
}

function formatDue(dueAt) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(todo) {
  if (!todo.dueAt || todo.completed) return false;
  const t = new Date(todo.dueAt).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

function addTodoFromComposer() {
  const title = els.titleInput.value.trim();
  if (!title) return;

  const priority = els.prioritySelect.value;
  const dueAt = els.dueInput.value ? new Date(els.dueInput.value).toISOString() : null;
  const tags = normalizeTags(els.tagsInput.value);
  const notes = (els.notesInput.value || '').trim();

  const recurring = els.recurringEnabled.checked
    ? { enabled: true, type: els.recurringSelect.value }
    : null;

  state.todos.unshift({
    id: uid(),
    title,
    completed: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    priority,
    dueAt,
    tags,
    notes,
    subtasks: [],
    recurring,
    completedAt: null,
  });

  els.titleInput.value = '';
  els.tagsInput.value = '';
  els.notesInput.value = '';
  els.dueInput.value = '';
  els.prioritySelect.value = 'medium';
  els.recurringEnabled.checked = false;
  els.recurringSelect.disabled = true;

  save();
  render();
}

function createNextRecurring(todo) {
  const due = new Date(todo.dueAt);
  if (Number.isNaN(due.getTime())) return null;

  const nextDue = new Date(due);
  const type = todo.recurring.type;

  if (type === 'daily') nextDue.setDate(nextDue.getDate() + 1);
  else if (type === 'weekly') nextDue.setDate(nextDue.getDate() + 7);
  else if (type === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1);
  else return null;

  return {
    ...structuredClone(todo),
    id: uid(),
    completed: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
    completedAt: null,
    subtasks: (todo.subtasks || []).map(s => ({ ...s, id: uid(), done: false })),
    dueAt: nextDue.toISOString(),
  };
}

function toggleTodo(id) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.updatedAt = nowISO();
  t.completedAt = t.completed ? nowISO() : null;

  if (t.completed && t.recurring && t.recurring.enabled && t.dueAt) {
    const next = createNextRecurring(t);
    if (next) state.todos.unshift(next);
  }

  save();
  render();
}

function deleteTodo(id) {
  state.todos = state.todos.filter(t => t.id !== id);
  delete state.ui.selected[id];
  save();
  render();
}

function clearCompleted() {
  state.todos = state.todos.filter(t => !t.completed);
  state.ui.selected = {};
  save();
  render();
}

function setFilter(filter) {
  state.ui.filter = filter;
  save();
  render();
}

function setSearch(q) {
  state.ui.search = q;
  save();
  render();
}

function setSort(s) {
  state.ui.sort = s;
  save();
  render();
}

function toggleSelected(id, checked) {
  if (checked) state.ui.selected[id] = true;
  else delete state.ui.selected[id];
  renderBulkMeta();
}

function selectedIds() {
  return Object.keys(state.ui.selected);
}

function bulkSelectAll(checked, visibleTodos) {
  if (!checked) {
    state.ui.selected = {};
  } else {
    visibleTodos.forEach(t => { state.ui.selected[t.id] = true; });
  }
  render();
}

function bulkComplete() {
  const ids = selectedIds();
  if (!ids.length) return;
  state.todos.forEach(t => {
    if (ids.includes(t.id)) {
      if (!t.completed) {
        t.completed = true;
        t.completedAt = nowISO();
        t.updatedAt = nowISO();
        if (t.recurring && t.recurring.enabled && t.dueAt) {
          const next = createNextRecurring(t);
          if (next) state.todos.unshift(next);
        }
      }
    }
  });
  state.ui.selected = {};
  save();
  render();
}

function bulkDelete() {
  const ids = new Set(selectedIds());
  if (!ids.size) return;
  state.todos = state.todos.filter(t => !ids.has(t.id));
  state.ui.selected = {};
  save();
  render();
}

function openDialogFor(id) {
  const t = state.todos.find(x => x.id === id);
  if (!t) return;

  els.dialogId.value = t.id;
  els.dialogTitle.value = t.title;
  els.dialogPriority.value = t.priority || 'medium';
  els.dialogDue.value = t.dueAt ? toLocalDatetimeInputValue(t.dueAt) : '';
  els.dialogTags.value = (t.tags || []).join(', ');
  els.dialogNotes.value = t.notes || '';

  els.dialogRecurringEnabled.checked = !!(t.recurring && t.recurring.enabled);
  els.dialogRecurringType.disabled = !els.dialogRecurringEnabled.checked;
  els.dialogRecurringType.value = (t.recurring && t.recurring.type) ? t.recurring.type : 'daily';

  els.dialogSubtasks.value = (t.subtasks || []).map(s => `- ${s.title}`).join('\n');

  els.dialog.showModal();
}

function toLocalDatetimeInputValue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2,'0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function saveDialog() {
  const id = els.dialogId.value;
  const t = state.todos.find(x => x.id === id);
  if (!t) return;

  t.title = els.dialogTitle.value.trim();
  t.priority = els.dialogPriority.value;
  t.dueAt = els.dialogDue.value ? new Date(els.dialogDue.value).toISOString() : null;
  t.tags = normalizeTags(els.dialogTags.value);
  t.notes = (els.dialogNotes.value || '').trim();

  const recurring = els.dialogRecurringEnabled.checked
    ? { enabled: true, type: els.dialogRecurringType.value }
    : null;
  t.recurring = recurring;

  t.subtasks = parseSubtasks(els.dialogSubtasks.value);

  t.updatedAt = nowISO();

  save();
  render();
}

function applyQuery(todos) {
  const q = (state.ui.search || '').toLowerCase().trim();
  const filter = state.ui.filter;

  let out = [...todos];

  if (filter === 'active') out = out.filter(t => !t.completed);
  if (filter === 'completed') out = out.filter(t => t.completed);

  if (q) {
    out = out.filter(t => {
      const inTitle = (t.title || '').toLowerCase().includes(q);
      const inTags = (t.tags || []).join(' ').toLowerCase().includes(q);
      const inNotes = (t.notes || '').toLowerCase().includes(q);
      return inTitle || inTags || inNotes;
    });
  }

  out.sort((a, b) => sortFn(a, b, state.ui.sort));

  return out;
}

function sortFn(a, b, sortKey) {
  if (sortKey === 'created_desc') return new Date(b.createdAt) - new Date(a.createdAt);
  if (sortKey === 'created_asc') return new Date(a.createdAt) - new Date(b.createdAt);

  if (sortKey === 'due_asc') {
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return ad - bd;
  }
  if (sortKey === 'due_desc') {
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : -Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : -Infinity;
    return bd - ad;
  }

  if (sortKey === 'priority_desc') return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
  if (sortKey === 'priority_asc') return (PRIORITY_ORDER[a.priority] || 0) - (PRIORITY_ORDER[b.priority] || 0);

  return 0;
}

function renderStats() {
  const total = state.todos.length;
  const done = state.todos.filter(t => t.completed).length;
  const left = total - done;
  const pct = total ? Math.round((done / total) * 100) : 0;

  els.summaryProgress.textContent = `${pct}%`;
  els.summaryCounts.textContent = `${total} total • ${done} done`;
  els.itemsLeft.textContent = `${left} item${left !== 1 ? 's' : ''} left`;
}

function renderBulkMeta(visibleTodos = null) {
  const ids = selectedIds();
  els.selectedCount.textContent = `${ids.length} selected`;

  if (visibleTodos) {
    const allVisibleSelected = visibleTodos.length > 0 && visibleTodos.every(t => !!state.ui.selected[t.id]);
    els.selectAll.checked = allVisibleSelected;
  } else {
    els.selectAll.checked = false;
  }
}

function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.completed ? ' completed' : '');
  li.dataset.id = todo.id;

  const sel = document.createElement('input');
  sel.type = 'checkbox';
  sel.checked = !!state.ui.selected[todo.id];
  sel.addEventListener('change', (e) => toggleSelected(todo.id, e.target.checked));

  const done = document.createElement('input');
  done.type = 'checkbox';
  done.checked = !!todo.completed;
  done.addEventListener('change', () => toggleTodo(todo.id));

  const main = document.createElement('div');

  const title = document.createElement('div');
  title.className = 'todo-title';
  title.textContent = todo.title;
  title.addEventListener('dblclick', () => openDialogFor(todo.id));

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  const pr = document.createElement('span');
  pr.className = `chip ${todo.priority || 'medium'}`;
  pr.textContent = `Priority: ${todo.priority || 'medium'}`;
  meta.appendChild(pr);

  const dueTxt = formatDue(todo.dueAt);
  if (dueTxt) {
    const due = document.createElement('span');
    due.className = 'chip';
    due.textContent = isOverdue(todo) ? `Overdue: ${dueTxt}` : `Due: ${dueTxt}`;
    meta.appendChild(due);
  }

  if (todo.recurring && todo.recurring.enabled) {
    const rec = document.createElement('span');
    rec.className = 'chip';
    rec.textContent = `Recurring: ${todo.recurring.type}`;
    meta.appendChild(rec);
  }

  (todo.tags || []).forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = `#${tag}`;
    meta.appendChild(chip);
  });

  const desc = document.createElement('div');
  desc.className = 'todo-desc';
  desc.textContent = todo.notes || '';

  main.appendChild(title);
  main.appendChild(meta);
  if (todo.notes) main.appendChild(desc);

  if (todo.subtasks && todo.subtasks.length) {
    const ul = document.createElement('ul');
    ul.className = 'subtasks';

    todo.subtasks.forEach(st => {
      const stLi = document.createElement('li');
      const stCb = document.createElement('input');
      stCb.type = 'checkbox';
      stCb.checked = !!st.done;
      stCb.addEventListener('change', () => {
        st.done = !st.done;
        todo.updatedAt = nowISO();
        save();
      });

      const stSpan = document.createElement('span');
      stSpan.style.marginLeft = '8px';
      stSpan.textContent = st.title;

      stLi.appendChild(stCb);
      stLi.appendChild(stSpan);
      ul.appendChild(stLi);
    });

    main.appendChild(ul);
  }

  const actions = document.createElement('div');
  actions.className = 'todo-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.type = 'button';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => openDialogFor(todo.id));

  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.type = 'button';
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => deleteTodo(todo.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(sel);
  li.appendChild(done);
  li.appendChild(main);
  li.appendChild(actions);

  return li;
}

function render() {
  renderStats();

  const visible = applyQuery(state.todos);

  els.list.innerHTML = '';
  visible.forEach(todo => {
    els.list.appendChild(createTodoElement(todo));
  });

  renderBulkMeta(visible);

  els.searchInput.value = state.ui.search || '';
  els.sortSelect.value = state.ui.sort || 'created_desc';
  els.filterButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === state.ui.filter);
  });

  save();
}

function exportJSON() {
  const payload = {
    exportedAt: nowISO(),
    version: 2,
    todos: state.todos,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `todos-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const data = safeParse(reader.result, null);
    if (!data) return alert('Invalid JSON');

    const incoming = Array.isArray(data) ? data : data.todos;
    if (!Array.isArray(incoming)) return alert('Invalid format');

    const sanitized = incoming
      .filter(x => x && (x.title || x.text))
      .map(x => ({
        id: x.id || uid(),
        title: (x.title || x.text || '').trim(),
        completed: !!x.completed,
        createdAt: x.createdAt || nowISO(),
        updatedAt: x.updatedAt || nowISO(),
        priority: x.priority || 'medium',
        dueAt: x.dueAt || null,
        tags: Array.isArray(x.tags) ? x.tags : normalizeTags(x.tags || ''),
        notes: x.notes || '',
        subtasks: Array.isArray(x.subtasks) ? x.subtasks : [],
        recurring: x.recurring || null,
        completedAt: x.completedAt || (x.completed ? nowISO() : null),
      }))
      .filter(x => x.title);

    state.todos = [...sanitized, ...state.todos];
    save();
    render();
  };
  reader.readAsText(file);
}

// Events
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  addTodoFromComposer();
});

els.recurringEnabled.addEventListener('change', () => {
  els.recurringSelect.disabled = !els.recurringEnabled.checked;
});

els.dialogRecurringEnabled.addEventListener('change', () => {
  els.dialogRecurringType.disabled = !els.dialogRecurringEnabled.checked;
});

els.clearCompleted.addEventListener('click', clearCompleted);

els.filterButtons.forEach(btn => {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter));
});

els.searchInput.addEventListener('input', (e) => setSearch(e.target.value));

els.sortSelect.addEventListener('change', (e) => setSort(e.target.value));

els.selectAll.addEventListener('change', (e) => {
  const visible = applyQuery(state.todos);
  bulkSelectAll(e.target.checked, visible);
});

els.bulkComplete.addEventListener('click', bulkComplete);
els.bulkDelete.addEventListener('click', bulkDelete);

els.themeToggle.addEventListener('click', () => {
  const next = (state.ui.theme === 'dark') ? 'light' : 'dark';
  setTheme(next);
});

els.exportBtn.addEventListener('click', exportJSON);

els.importFile.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) importJSON(file);
  e.target.value = '';
});

els.dialogForm.addEventListener('submit', (e) => {
  const submitter = e.submitter;
  if (submitter && submitter.id === 'dialog-save') {
    e.preventDefault();
    saveDialog();
    els.dialog.close();
  }
});

// Init
load();
setTheme(state.ui.theme || 'light');
render();