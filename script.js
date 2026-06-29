const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const remainingCount = document.getElementById('remaining-count');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const tabs = document.querySelectorAll('.tab');
const selectAllBar = document.getElementById('select-all-bar');
const selectAllCheckbox = document.getElementById('select-all-checkbox');

let todos = [];
let currentFilter = 'all';

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
    if (currentFilter === 'active') return !t.completed;
    if (currentFilter === 'completed') return t.completed;
    return true;
  });
}

function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  const now = Date.now();
  todos.push({ id: now, text, completed: false, createdAt: now });
  todoInput.value = '';
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
      const msg = {
        active: '진행 중인 항목이 없습니다',
        completed: '완료된 항목이 없습니다',
        all: '항목이 없습니다'
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

      const span = document.createElement('span');
      span.className = 'todo-text';
      span.textContent = todo.text;
      textWrap.appendChild(span);

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

render();
