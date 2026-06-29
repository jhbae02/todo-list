const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const tabs = document.querySelectorAll('.tab');
const selectAllBar = document.getElementById('select-all-bar');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const descToggleBtn = document.getElementById('desc-toggle-btn');
const todoDescInput = document.getElementById('todo-desc-input');

let todos = [];
let groups = [];
let nextGroupId = 1;
let currentFilter = 'all';
let currentGroupFilter = null;

const GROUP_COLORS = [
  { bg: '#dde5f7', text: '#2a4a9f', border: '#b0c2ee' },
  { bg: '#d3efed', text: '#1a6b68', border: '#96d0cc' },
  { bg: '#e8dff7', text: '#6530b0', border: '#c5b5eb' },
  { bg: '#d5f0de', text: '#1a6e40', border: '#96d5b0' },
  { bg: '#fde8d3', text: '#a84810', border: '#f5c09a' },
  { bg: '#fddce6', text: '#a81e4e', border: '#f5a6c0' },
  { bg: '#fdf2d0', text: '#7a5800', border: '#f0dc96' },
  { bg: '#dff0ff', text: '#1a5888', border: '#96c8e8' },
];

// ── Storage ───────────────────────────────────────────────────
function saveToStorage() {
  try {
    localStorage.setItem('tdl-todos', JSON.stringify(todos));
    localStorage.setItem('tdl-groups', JSON.stringify(groups));
    localStorage.setItem('tdl-nextGroupId', String(nextGroupId));
  } catch(e) {}
}

function loadFromStorage() {
  try {
    const t = localStorage.getItem('tdl-todos');
    const g = localStorage.getItem('tdl-groups');
    const n = localStorage.getItem('tdl-nextGroupId');
    if (t) todos = JSON.parse(t);
    if (g) groups = JSON.parse(g);
    if (n) nextGroupId = parseInt(n);
  } catch(e) {}
}

// ── Group management ──────────────────────────────────────────
function addGroup(name) {
  const trimmed = name.trim();
  if (!trimmed || groups.some(g => g.name === trimmed)) return;
  const colorIndex = groups.length % GROUP_COLORS.length;
  groups.push({ id: nextGroupId++, name: trimmed, colorIndex });
  updateGroupUI();
  saveToStorage();
}

function deleteGroup(id) {
  groups = groups.filter(g => g.id !== id);
  todos = todos.map(t => t.groupId === id ? { ...t, groupId: null } : t);
  if (currentGroupFilter === id) {
    currentGroupFilter = null;
    renderGroupFilter();
  }
  updateGroupUI();
  render();
}

function updateGroupUI() {
  renderGroupChips();
  renderGroupSelect();
  renderGroupFilter();
}

function renderGroupChips() {
  const chips = document.getElementById('group-chips');
  chips.innerHTML = '';
  if (groups.length === 0) {
    chips.innerHTML = '<span class="no-groups-hint">아직 그룹이 없습니다</span>';
    return;
  }
  groups.forEach(g => {
    const c = GROUP_COLORS[g.colorIndex];
    const chip = document.createElement('div');
    chip.className = 'group-chip';
    chip.style.background = c.bg;
    chip.style.color = c.text;
    chip.style.borderColor = c.border;
    const nameEl = document.createElement('span');
    nameEl.textContent = g.name;
    const delBtn = document.createElement('button');
    delBtn.className = 'group-chip-del';
    delBtn.style.color = c.text;
    delBtn.textContent = '×';
    delBtn.title = '그룹 삭제';
    delBtn.addEventListener('click', () => deleteGroup(g.id));
    chip.appendChild(nameEl);
    chip.appendChild(delBtn);
    chips.appendChild(chip);
  });
}

function renderGroupSelect() {
  const select = document.getElementById('todo-group-select');
  const cur = select.value;
  select.innerHTML = '<option value="">그룹 없음</option>';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    select.appendChild(opt);
  });
  select.value = cur;
}

function applyGroupBtnStyle(btn, c, isActive) {
  if (isActive) {
    btn.style.background = c.bg;
    btn.style.borderColor = c.border;
    btn.style.color = c.text;
    btn.style.boxShadow = `0 2px 8px ${c.border}`;
  } else {
    btn.style.background = '#fff';
    btn.style.borderColor = c.border;
    btn.style.color = c.text;
    btn.style.boxShadow = '';
  }
}

function renderGroupFilter() {
  const row = document.getElementById('group-filter-row');
  if (!row) return;
  row.innerHTML = '';
  row.style.display = groups.length > 0 ? 'flex' : 'none';

  const allBtn = document.createElement('button');
  allBtn.className = 'group-filter-btn';
  allBtn.textContent = '전체';
  const allActive = currentGroupFilter === null;
  allBtn.style.background = allActive ? '#1a3678' : '#fff';
  allBtn.style.borderColor = allActive ? '#1a3678' : '#c8d3ee';
  allBtn.style.color = allActive ? '#fff' : '#7a8db3';
  allBtn.style.boxShadow = allActive ? '0 2px 8px rgba(26,54,120,0.18)' : '';
  allBtn.addEventListener('click', () => { currentGroupFilter = null; renderGroupFilter(); render(); });
  row.appendChild(allBtn);

  groups.forEach(g => {
    const c = GROUP_COLORS[g.colorIndex];
    const btn = document.createElement('button');
    btn.className = 'group-filter-btn';
    applyGroupBtnStyle(btn, c, currentGroupFilter === g.id);
    btn.textContent = g.name;
    btn.addEventListener('click', () => { currentGroupFilter = g.id; renderGroupFilter(); render(); });
    row.appendChild(btn);
  });
}

// Group manager toggle
document.getElementById('group-manager-toggle').addEventListener('click', () => {
  const body = document.getElementById('group-manager-body');
  const icon = document.getElementById('group-manager-icon');
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  icon.textContent = isHidden ? '▴' : '▾';
});

// Group add
document.getElementById('group-add-btn').addEventListener('click', () => {
  const input = document.getElementById('group-input');
  addGroup(input.value);
  input.value = '';
});

document.getElementById('group-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addGroup(e.target.value);
    e.target.value = '';
  }
});

// ── Description toggle ────────────────────────────────────────
descToggleBtn.addEventListener('click', () => {
  const isHidden = todoDescInput.style.display === 'none';
  todoDescInput.style.display = isHidden ? 'block' : 'none';
  descToggleBtn.textContent = isHidden ? '－ 설명 접기' : '＋ 설명 추가';
  if (isHidden) todoDescInput.focus();
});

const EMPTY_SVG = `
<svg width="90" height="90" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="18" y="22" width="56" height="62" rx="8" fill="#e8edf8"/>
  <rect x="33" y="13" width="26" height="15" rx="7.5" fill="#c8d3ee"/>
  <rect x="38" y="13" width="16" height="10" rx="5" fill="#f4f6fb"/>
  <rect x="28" y="40" width="36" height="4" rx="2" fill="#c8d3ee"/>
  <rect x="28" y="52" width="26" height="4" rx="2" fill="#c8d3ee"/>
  <rect x="28" y="64" width="32" height="4" rx="2" fill="#c8d3ee"/>
  <circle cx="72" cy="72" r="16" fill="#1a3678"/>
  <path d="M65 72l4.5 4.5 9-9" stroke="white" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function getFiltered() {
  return todos.filter(t => {
    const statusMatch = currentFilter === 'active' ? !t.completed
      : currentFilter === 'completed' ? t.completed
      : true;
    const groupMatch = currentGroupFilter === null ? true : t.groupId === currentGroupFilter;
    return statusMatch && groupMatch;
  });
}

function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  const description = todoDescInput.value.trim();
  const groupIdVal = document.getElementById('todo-group-select').value;
  const groupId = groupIdVal ? parseInt(groupIdVal) : null;
  const now = Date.now();
  todos.push({ id: now, text, description, completed: false, createdAt: now, groupId });
  todoInput.value = '';
  todoDescInput.value = '';
  todoDescInput.style.display = 'none';
  descToggleBtn.textContent = '＋ 설명 추가';
  render();
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toggleTodo(id) {
  todos = todos.map(t => {
    if (t.id !== id) return t;
    const completed = !t.completed;
    return { ...t, completed, completedAt: completed ? Date.now() : null };
  });
  render();
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  render();
}

function clearCompleted() {
  todos = todos.filter(t => !t.completed);
  render();
}

function render() {
  todoList.innerHTML = '';
  const filtered = getFiltered();

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';

    if (todos.length === 0) {
      li.innerHTML = `
        ${EMPTY_SVG}
        <p class="empty-title">할 일을 추가해보세요!</p>
        <p class="empty-desc">위 입력창에 할 일을 입력하고<br>추가 버튼을 눌러보세요</p>`;
    } else {
      const groupName = currentGroupFilter !== null
        ? (groups.find(g => g.id === currentGroupFilter) || {}).name
        : null;
      const prefix = groupName ? `[${groupName}] ` : '';
      const msg = {
        active: `${prefix}진행 중인 항목이 없습니다`,
        completed: `${prefix}완료된 항목이 없습니다`,
        all: `${prefix}항목이 없습니다`
      };
      li.innerHTML = `<p class="empty-title">${msg[currentFilter]}</p>`;
    }

    todoList.appendChild(li);
  } else {
    filtered.forEach(todo => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.completed ? ' completed' : '');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = todo.completed;
      checkbox.addEventListener('change', () => toggleTodo(todo.id));

      const textWrap = document.createElement('div');
      textWrap.className = 'todo-text-wrap';

      const topRow = document.createElement('div');
      topRow.className = 'todo-top-row';

      const span = document.createElement('span');
      span.className = 'todo-text';
      span.textContent = todo.text;
      topRow.appendChild(span);

      if (todo.groupId && currentGroupFilter === null) {
        const group = groups.find(g => g.id === todo.groupId);
        if (group) {
          const c = GROUP_COLORS[group.colorIndex];
          const badge = document.createElement('span');
          badge.className = 'group-badge';
          badge.textContent = group.name;
          badge.style.background = c.bg;
          badge.style.color = c.text;
          badge.style.borderColor = c.border;
          topRow.appendChild(badge);
        }
      }

      if (todo.description) {
        const descBtn = document.createElement('button');
        descBtn.className = 'desc-expand-btn';
        descBtn.title = '설명 보기';
        descBtn.textContent = '▾';

        const descEl = document.createElement('p');
        descEl.className = 'todo-desc';
        descEl.textContent = todo.description;
        descEl.style.display = 'none';

        descBtn.addEventListener('click', () => {
          const hidden = descEl.style.display === 'none';
          descEl.style.display = hidden ? 'block' : 'none';
          descBtn.textContent = hidden ? '▴' : '▾';
        });

        topRow.appendChild(descBtn);
        textWrap.appendChild(topRow);
        textWrap.appendChild(descEl);
      } else {
        textWrap.appendChild(topRow);
      }

      const timeRow = document.createElement('div');
      timeRow.className = 'todo-time-row';

      if (todo.createdAt) {
        const created = document.createElement('span');
        created.className = 'todo-time-badge';
        created.textContent = '추가 ' + formatDate(todo.createdAt);
        timeRow.appendChild(created);
      }

      if (todo.completed && todo.completedAt) {
        const done = document.createElement('span');
        done.className = 'todo-time-badge todo-time-done';
        done.textContent = '완료 ' + formatDate(todo.completedAt);
        timeRow.appendChild(done);
      }

      textWrap.appendChild(timeRow);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '×';
      delBtn.title = '삭제';
      delBtn.addEventListener('click', () => deleteTodo(todo.id));

      li.appendChild(checkbox);
      li.appendChild(textWrap);
      li.appendChild(delBtn);
      todoList.appendChild(li);
    });
  }

  // Select-all bar: show only when there are active items visible
  const activeInView = filtered.filter(t => !t.completed);
  const showBar = currentFilter !== 'completed' && activeInView.length > 0;
  selectAllBar.style.display = showBar ? 'flex' : 'none';

  if (showBar) {
    const completedInView = filtered.filter(t => t.completed);
    if (completedInView.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (activeInView.length === 0) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    }
  }

  const activeCount = todos.filter(t => !t.completed).length;
  const completedCount = todos.filter(t => t.completed).length;
  remainingCount.textContent = `${activeCount}개 남음`;

  document.getElementById('count-all').textContent = todos.length;
  document.getElementById('count-active').textContent = activeCount;
  document.getElementById('count-completed').textContent = completedCount;

  saveToStorage();
}

selectAllCheckbox.addEventListener('change', () => {
  const filtered = getFiltered();
  const activeIds = filtered.filter(t => !t.completed).map(t => t.id);
  todos = todos.map(t =>
    activeIds.includes(t.id) ? { ...t, completed: true } : t
  );
  render();
});

addBtn.addEventListener('click', addTodo);

todoInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    render();
  });
});

clearCompletedBtn.addEventListener('click', clearCompleted);

loadFromStorage();
updateGroupUI();
render();
