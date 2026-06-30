import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
)

// ── DOM refs ──────────────────────────────────────────────────
const todoInput        = document.getElementById('todo-input')
const addBtn           = document.getElementById('add-btn')
const todoList         = document.getElementById('todo-list')
const remainingCount   = document.getElementById('remaining-count')
const clearCompletedBtn = document.getElementById('clear-completed-btn')
const tabs             = document.querySelectorAll('.tab')
const selectAllBar     = document.getElementById('select-all-bar')
const selectAllCheckbox = document.getElementById('select-all-checkbox')
const descToggleBtn    = document.getElementById('desc-toggle-btn')
const todoDescInput    = document.getElementById('todo-desc-input')

// ── State ─────────────────────────────────────────────────────
let todos              = []
let groups             = []
let currentFilter      = 'all'
let currentGroupFilter = null
let searchQuery        = ''
let isLoading          = true
let currentUser        = null

const GROUP_COLORS = [
  { bg: '#dde5f7', text: '#2a4a9f', border: '#b0c2ee' },
  { bg: '#d3efed', text: '#1a6b68', border: '#96d0cc' },
  { bg: '#e8dff7', text: '#6530b0', border: '#c5b5eb' },
  { bg: '#d5f0de', text: '#1a6e40', border: '#96d5b0' },
  { bg: '#fde8d3', text: '#a84810', border: '#f5c09a' },
  { bg: '#fddce6', text: '#a81e4e', border: '#f5a6c0' },
  { bg: '#fdf2d0', text: '#7a5800', border: '#f0dc96' },
  { bg: '#dff0ff', text: '#1a5888', border: '#96c8e8' },
]

// ── DB ↔ local mapping ────────────────────────────────────────
function dbGroupToLocal(g) {
  return { id: g.id, name: g.name, colorIndex: g.color_index }
}

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 }

function dbTodoToLocal(t) {
  return {
    id:          t.id,
    text:        t.text,
    description: t.description || '',
    completed:   t.completed,
    createdAt:   t.created_at,
    completedAt: t.completed_at ?? null,
    groupId:     t.group_id ?? null,
    priority:    t.priority ?? null,
    dueDate:     t.due_date ?? null,
  }
}

// ── Migration: localStorage → Supabase (runs once) ───────────
async function migrateFromLocalStorage() {
  if (!currentUser) return
  if (localStorage.getItem('tdl-migrated')) return

  let oldGroups = []
  let oldTodos  = []
  try {
    const g = localStorage.getItem('tdl-groups')
    const t = localStorage.getItem('tdl-todos')
    if (g) oldGroups = JSON.parse(g)
    if (t) oldTodos  = JSON.parse(t)
  } catch (e) {}

  if (oldGroups.length === 0 && oldTodos.length === 0) {
    localStorage.setItem('tdl-migrated', '1')
    return
  }

  // 이 계정에 이미 데이터가 있으면 마이그레이션 건너뜀
  const { count } = await supabase
    .from('todos')
    .select('id', { count: 'exact', head: true })
  if (count > 0) {
    localStorage.setItem('tdl-migrated', '1')
    return
  }

  // 그룹 먼저 삽입 (old number ID → new UUID 매핑)
  const groupIdMap = {}
  for (const g of oldGroups) {
    const { data } = await supabase
      .from('groups')
      .insert({ name: g.name, color_index: g.colorIndex, user_id: currentUser.id })
      .select()
      .single()
    if (data) groupIdMap[g.id] = data.id
  }

  // 투두 삽입
  if (oldTodos.length > 0) {
    await supabase.from('todos').insert(
      oldTodos.map(t => ({
        text:         t.text,
        description:  t.description || '',
        completed:    t.completed,
        created_at:   new Date(t.createdAt).toISOString(),
        completed_at: t.completedAt ? new Date(t.completedAt).toISOString() : null,
        group_id:     t.groupId != null ? (groupIdMap[t.groupId] ?? null) : null,
        user_id:      currentUser.id,
      }))
    )
  }

  localStorage.setItem('tdl-migrated', '1')
  localStorage.removeItem('tdl-todos')
  localStorage.removeItem('tdl-groups')
  localStorage.removeItem('tdl-nextGroupId')
}

// ── Supabase 데이터 로드 ───────────────────────────────────────
async function loadFromSupabase() {
  const [{ data: gData, error: gErr }, { data: tData, error: tErr }] = await Promise.all([
    supabase.from('groups').select('*').order('created_at'),
    supabase.from('todos').select('*').order('created_at'),
  ])
  if (gErr || tErr) {
    console.error('Supabase load error:', gErr || tErr)
    return
  }
  groups = (gData || []).map(dbGroupToLocal)
  todos  = (tData || []).map(dbTodoToLocal)
}

// ── Group management ──────────────────────────────────────────
async function addGroup(name) {
  const trimmed = name.trim()
  if (!trimmed || groups.some(g => g.name === trimmed)) return
  const colorIndex = groups.length % GROUP_COLORS.length
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: trimmed, color_index: colorIndex, user_id: currentUser.id })
    .select()
    .single()
  if (error) { console.error(error); return }
  groups.push(dbGroupToLocal(data))
  updateGroupUI()
}

async function deleteGroup(id) {
  const { error } = await supabase.from('groups').delete().eq('id', id)
  if (error) { console.error(error); return }
  groups = groups.filter(g => g.id !== id)
  // DB가 ON DELETE SET NULL로 처리하므로 로컬 상태도 맞춰 줌
  todos = todos.map(t => t.groupId === id ? { ...t, groupId: null } : t)
  if (currentGroupFilter === id) {
    currentGroupFilter = null
    renderGroupFilter()
  }
  updateGroupUI()
  render()
}

function updateGroupUI() {
  renderGroupChips()
  renderGroupSelect()
  renderGroupFilter()
}

function renderGroupChips() {
  const chips = document.getElementById('group-chips')
  chips.innerHTML = ''
  if (groups.length === 0) {
    chips.innerHTML = '<span class="no-groups-hint">아직 그룹이 없습니다</span>'
    return
  }
  groups.forEach(g => {
    const c = GROUP_COLORS[g.colorIndex]
    const chip = document.createElement('div')
    chip.className = 'group-chip'
    chip.style.background   = c.bg
    chip.style.color        = c.text
    chip.style.borderColor  = c.border
    const nameEl = document.createElement('span')
    nameEl.textContent = g.name
    const delBtn = document.createElement('button')
    delBtn.className   = 'group-chip-del'
    delBtn.style.color = c.text
    delBtn.textContent = '×'
    delBtn.title       = '그룹 삭제'
    delBtn.addEventListener('click', () => deleteGroup(g.id))
    chip.appendChild(nameEl)
    chip.appendChild(delBtn)
    chips.appendChild(chip)
  })
}

function renderGroupSelect() {
  const select = document.getElementById('todo-group-select')
  const cur = select.value
  select.innerHTML = '<option value="">그룹 없음</option>'
  groups.forEach(g => {
    const opt = document.createElement('option')
    opt.value       = g.id
    opt.textContent = g.name
    select.appendChild(opt)
  })
  select.value = cur
}

function applyGroupBtnStyle(btn, c, isActive) {
  if (isActive) {
    btn.style.background  = c.bg
    btn.style.borderColor = c.border
    btn.style.color       = c.text
    btn.style.boxShadow   = `0 2px 8px ${c.border}`
  } else {
    btn.style.background  = '#fff'
    btn.style.borderColor = c.border
    btn.style.color       = c.text
    btn.style.boxShadow   = ''
  }
}

function renderGroupFilter() {
  const row = document.getElementById('group-filter-row')
  if (!row) return
  row.innerHTML = ''
  row.style.display = groups.length > 0 ? 'flex' : 'none'

  const allBtn = document.createElement('button')
  allBtn.className = 'group-filter-btn'
  allBtn.textContent = '전체'
  const allActive = currentGroupFilter === null
  allBtn.style.background  = allActive ? '#1a3678' : '#fff'
  allBtn.style.borderColor = allActive ? '#1a3678' : '#c8d3ee'
  allBtn.style.color       = allActive ? '#fff'    : '#7a8db3'
  allBtn.style.boxShadow   = allActive ? '0 2px 8px rgba(26,54,120,0.18)' : ''
  allBtn.addEventListener('click', () => {
    currentGroupFilter = null
    renderGroupFilter()
    render()
  })
  row.appendChild(allBtn)

  groups.forEach(g => {
    const c   = GROUP_COLORS[g.colorIndex]
    const btn = document.createElement('button')
    btn.className = 'group-filter-btn'
    applyGroupBtnStyle(btn, c, currentGroupFilter === g.id)
    btn.textContent = g.name
    btn.addEventListener('click', () => {
      currentGroupFilter = g.id
      renderGroupFilter()
      render()
    })
    row.appendChild(btn)
  })
}

// Group manager toggle
document.getElementById('group-manager-toggle').addEventListener('click', () => {
  const body   = document.getElementById('group-manager-body')
  const icon   = document.getElementById('group-manager-icon')
  const isHidden = body.style.display === 'none'
  body.style.display = isHidden ? 'block' : 'none'
  icon.textContent   = isHidden ? '▴' : '▾'
})

document.getElementById('group-add-btn').addEventListener('click', () => {
  const input = document.getElementById('group-input')
  addGroup(input.value)
  input.value = ''
})

document.getElementById('group-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addGroup(e.target.value)
    e.target.value = ''
  }
})

// ── Description toggle ────────────────────────────────────────
descToggleBtn.addEventListener('click', () => {
  const isHidden = todoDescInput.style.display === 'none'
  todoDescInput.style.display = isHidden ? 'block' : 'none'
  descToggleBtn.textContent   = isHidden ? '－ 설명 접기' : '＋ 설명 추가'
  if (isHidden) todoDescInput.focus()
})

// ── Filtering ─────────────────────────────────────────────────
function getFiltered() {
  const q = searchQuery.trim().toLowerCase()
  return todos
    .filter(t => {
      const statusMatch = currentFilter === 'active'    ? !t.completed
                        : currentFilter === 'completed' ?  t.completed
                        : true
      const groupMatch  = currentGroupFilter === null ? true : t.groupId === currentGroupFilter
      const searchMatch = !q
        || t.text.toLowerCase().includes(q)
        || (t.description && t.description.toLowerCase().includes(q))
      return statusMatch && groupMatch && searchMatch
    })
    .sort((a, b) => {
      const pa = a.priority != null ? (PRIORITY_ORDER[a.priority] ?? 99) : 99
      const pb = b.priority != null ? (PRIORITY_ORDER[b.priority] ?? 99) : 99
      return pa - pb
    })
}

function highlightText(text, query) {
  if (!query) return null
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  const frag = document.createDocumentFragment()
  frag.appendChild(document.createTextNode(text.slice(0, idx)))
  const mark = document.createElement('mark')
  mark.className   = 'search-highlight'
  mark.textContent = text.slice(idx, idx + query.length)
  frag.appendChild(mark)
  frag.appendChild(document.createTextNode(text.slice(idx + query.length)))
  return frag
}

// ── Todo CRUD ─────────────────────────────────────────────────
async function addTodo() {
  const text = todoInput.value.trim()
  if (!text) return
  const description = todoDescInput.value.trim()
  const groupIdVal  = document.getElementById('todo-group-select').value
  const groupId     = groupIdVal || null
  const prioritySel = document.getElementById('todo-priority')
  const priority    = prioritySel.value || null
  const dueDateEl   = document.getElementById('todo-due-date')
  const dueDate     = dueDateEl.value || null

  const { data, error } = await supabase
    .from('todos')
    .insert({ text, description, completed: false, group_id: groupId, priority, due_date: dueDate, user_id: currentUser.id })
    .select()
    .single()
  if (error) { console.error(error); return }

  todos.push(dbTodoToLocal(data))
  todoInput.value             = ''
  todoDescInput.value         = ''
  todoDescInput.style.display = 'none'
  descToggleBtn.textContent   = '＋ 설명 추가'
  prioritySel.value           = ''
  dueDateEl.value             = ''
  render()
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id)
  if (!todo) return
  const completed  = !todo.completed
  const completedAt = completed ? new Date().toISOString() : null
  const { error } = await supabase
    .from('todos')
    .update({ completed, completed_at: completedAt })
    .eq('id', id)
  if (error) { console.error(error); return }
  todos = todos.map(t => t.id === id ? { ...t, completed, completedAt } : t)
  render()
}

async function deleteTodo(id) {
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) { console.error(error); return }
  todos = todos.filter(t => t.id !== id)
  render()
}

async function clearCompleted() {
  const ids = todos.filter(t => t.completed).map(t => t.id)
  if (ids.length === 0) return
  const { error } = await supabase.from('todos').delete().in('id', ids)
  if (error) { console.error(error); return }
  todos = todos.filter(t => !t.completed)
  render()
}

async function updateTodoText(id, newText) {
  const { error } = await supabase.from('todos').update({ text: newText }).eq('id', id)
  if (error) { console.error(error); return }
  todos = todos.map(t => t.id === id ? { ...t, text: newText } : t)
  render()
}

// ── Render ────────────────────────────────────────────────────
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
</svg>`

function calcDday(dueDateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dueDateStr.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const diff = Math.round((due - today) / 86400000)
  if (diff === 0) return { label: 'D-day', diff: 0 }
  if (diff > 0)  return { label: `D-${diff}`, diff }
  return { label: `D+${Math.abs(diff)}`, diff }
}

function formatDate(ts) {
  const d   = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function render() {
  todoList.innerHTML = ''

  if (isLoading) {
    const li = document.createElement('li')
    li.className = 'empty-state'
    li.innerHTML = '<p class="empty-title">불러오는 중...</p>'
    todoList.appendChild(li)
    return
  }

  const filtered = getFiltered()

  if (filtered.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty-state'

    if (todos.length === 0) {
      li.innerHTML = `
        ${EMPTY_SVG}
        <p class="empty-title">할 일을 추가해보세요!</p>
        <p class="empty-desc">위 입력창에 할 일을 입력하고<br>추가 버튼을 눌러보세요</p>`
    } else {
      const groupName = currentGroupFilter !== null
        ? (groups.find(g => g.id === currentGroupFilter) || {}).name
        : null
      const prefix = groupName ? `[${groupName}] ` : ''
      const msg = {
        active:    `${prefix}진행 중인 항목이 없습니다`,
        completed: `${prefix}완료된 항목이 없습니다`,
        all:       `${prefix}항목이 없습니다`,
      }
      li.innerHTML = `<p class="empty-title">${msg[currentFilter]}</p>`
    }

    todoList.appendChild(li)
  } else {
    filtered.forEach(todo => {
      const li = document.createElement('li')
      li.className = 'todo-item' + (todo.completed ? ' completed' : '')

      const checkbox   = document.createElement('input')
      checkbox.type    = 'checkbox'
      checkbox.checked = todo.completed
      checkbox.addEventListener('change', () => toggleTodo(todo.id))

      const textWrap = document.createElement('div')
      textWrap.className = 'todo-text-wrap'

      const topRow = document.createElement('div')
      topRow.className = 'todo-top-row'

      const span = document.createElement('span')
      span.className = 'todo-text'
      const highlighted = highlightText(todo.text, searchQuery.trim())
      if (highlighted) span.appendChild(highlighted)
      else span.textContent = todo.text
      if (!todo.completed) {
        span.addEventListener('dblclick', () => {
          const editInput = document.createElement('input')
          editInput.type = 'text'
          editInput.className = 'todo-inline-edit'
          editInput.value = todo.text
          let saved = false
          const save = async () => {
            if (saved) return
            saved = true
            const newText = editInput.value.trim()
            if (newText && newText !== todo.text) await updateTodoText(todo.id, newText)
            else render()
          }
          editInput.addEventListener('keydown', e => {
            if (e.key === 'Enter')  { e.preventDefault(); save() }
            if (e.key === 'Escape') { saved = true; render() }
          })
          editInput.addEventListener('blur', save)
          span.replaceWith(editInput)
          editInput.focus()
          editInput.select()
        })
      }
      topRow.appendChild(span)

      if (todo.priority) {
        const pLabel = { high: '높음', normal: '보통', low: '낮음' }[todo.priority]
        const pb = document.createElement('span')
        pb.className   = `priority-badge priority-${todo.priority}`
        pb.textContent = pLabel
        topRow.appendChild(pb)
      }

      if (todo.dueDate) {
        const { label, diff } = calcDday(todo.dueDate)
        const db = document.createElement('span')
        db.className = 'dday-badge' + (diff < 0 ? ' dday-overdue' : diff === 0 ? ' dday-today' : '')
        db.textContent = label
        topRow.appendChild(db)
      }

      if (todo.groupId && currentGroupFilter === null) {
        const group = groups.find(g => g.id === todo.groupId)
        if (group) {
          const c     = GROUP_COLORS[group.colorIndex]
          const badge = document.createElement('span')
          badge.className          = 'group-badge'
          badge.textContent        = group.name
          badge.style.background   = c.bg
          badge.style.color        = c.text
          badge.style.borderColor  = c.border
          topRow.appendChild(badge)
        }
      }

      if (todo.description) {
        const descBtn = document.createElement('button')
        descBtn.className   = 'desc-expand-btn'
        descBtn.title       = '설명 보기'
        descBtn.textContent = '▾'

        const descEl = document.createElement('p')
        descEl.className       = 'todo-desc'
        descEl.textContent     = todo.description
        descEl.style.display   = 'none'

        descBtn.addEventListener('click', () => {
          const hidden = descEl.style.display === 'none'
          descEl.style.display  = hidden ? 'block' : 'none'
          descBtn.textContent   = hidden ? '▴' : '▾'
        })

        topRow.appendChild(descBtn)
        textWrap.appendChild(topRow)
        textWrap.appendChild(descEl)
      } else {
        textWrap.appendChild(topRow)
      }

      const timeRow = document.createElement('div')
      timeRow.className = 'todo-time-row'

      if (todo.createdAt) {
        const created = document.createElement('span')
        created.className   = 'todo-time-badge'
        created.textContent = '추가 ' + formatDate(todo.createdAt)
        timeRow.appendChild(created)
      }

      if (todo.completed && todo.completedAt) {
        const done = document.createElement('span')
        done.className   = 'todo-time-badge todo-time-done'
        done.textContent = '완료 ' + formatDate(todo.completedAt)
        timeRow.appendChild(done)
      }

      textWrap.appendChild(timeRow)

      const delBtn = document.createElement('button')
      delBtn.className   = 'delete-btn'
      delBtn.textContent = '×'
      delBtn.title       = '삭제'
      delBtn.addEventListener('click', () => deleteTodo(todo.id))

      li.appendChild(checkbox)
      li.appendChild(textWrap)
      li.appendChild(delBtn)
      todoList.appendChild(li)
    })
  }

  // Select-all bar
  const activeInView = filtered.filter(t => !t.completed)
  const showBar      = currentFilter !== 'completed' && activeInView.length > 0
  selectAllBar.style.display = showBar ? 'flex' : 'none'

  if (showBar) {
    const completedInView = filtered.filter(t => t.completed)
    if (completedInView.length === 0) {
      selectAllCheckbox.checked       = false
      selectAllCheckbox.indeterminate = false
    } else if (activeInView.length === 0) {
      selectAllCheckbox.checked       = true
      selectAllCheckbox.indeterminate = false
    } else {
      selectAllCheckbox.checked       = false
      selectAllCheckbox.indeterminate = true
    }
  }

  const activeCount    = todos.filter(t => !t.completed).length
  const completedCount = todos.filter(t =>  t.completed).length
  remainingCount.textContent = `${activeCount}개 남음`

  document.getElementById('count-all').textContent       = todos.length
  document.getElementById('count-active').textContent    = activeCount
  document.getElementById('count-completed').textContent = completedCount
}

// ── Event listeners ───────────────────────────────────────────
selectAllCheckbox.addEventListener('change', async () => {
  const filtered  = getFiltered()
  const activeIds = filtered.filter(t => !t.completed).map(t => t.id)
  if (activeIds.length === 0) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('todos')
    .update({ completed: true, completed_at: now })
    .in('id', activeIds)
  if (error) { console.error(error); return }
  todos = todos.map(t => activeIds.includes(t.id) ? { ...t, completed: true, completedAt: now } : t)
  render()
})

addBtn.addEventListener('click', addTodo)

todoInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo()
})

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    currentFilter = tab.dataset.filter
    render()
  })
})

clearCompletedBtn.addEventListener('click', clearCompleted)

// ── Search ────────────────────────────────────────────────────
const searchInput    = document.getElementById('search-input')
const searchClearBtn = document.getElementById('search-clear-btn')

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value
  const hasVal = searchQuery.trim() !== ''
  searchClearBtn.style.display = hasVal ? 'inline-block' : 'none'
  searchInput.classList.toggle('has-value', hasVal)
  render()
})

searchClearBtn.addEventListener('click', () => {
  searchQuery = ''
  searchInput.value = ''
  searchInput.classList.remove('has-value')
  searchClearBtn.style.display = 'none'
  searchInput.focus()
  render()
})

// ── Theme ─────────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle')

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  themeToggle.textContent = theme === 'dark' ? '☀️ 라이트' : '🌙 다크'
  localStorage.setItem('tdl-theme', theme)
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  applyTheme(next)
})

const savedTheme = localStorage.getItem('tdl-theme')
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
applyTheme(savedTheme)

// ── Auth helpers ──────────────────────────────────────────────
async function showApp(user) {
  currentUser = user
  document.getElementById('auth-overlay').style.display = 'none'
  document.getElementById('app-container').style.display = 'block'
  document.getElementById('header-user').style.display = 'flex'
  document.getElementById('user-email').textContent = user.email

  isLoading = true
  render()
  await migrateFromLocalStorage()
  await loadFromSupabase()
  isLoading = false
  updateGroupUI()
  render()
}

function showAuthForm() {
  currentUser = null
  todos = []
  groups = []
  currentFilter = 'all'
  currentGroupFilter = null
  searchQuery = ''
  document.getElementById('app-container').style.display = 'none'
  document.getElementById('header-user').style.display = 'none'
  document.getElementById('auth-overlay').style.display = 'flex'
}

// ── Auth state change ─────────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
    if (session?.user) {
      await showApp(session.user)
    } else {
      showAuthForm()
    }
  } else if (event === 'SIGNED_OUT') {
    showAuthForm()
  }
})

// ── Auth form ─────────────────────────────────────────────────
let authMode = 'login'
const authTabs   = document.querySelectorAll('.auth-tab')
const authSubmit = document.getElementById('auth-submit')
const authMsg    = document.getElementById('auth-message')

authTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    authMode = tab.dataset.mode
    authTabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    authSubmit.textContent = authMode === 'login' ? '로그인' : '회원가입'
    authMsg.textContent = ''
    authMsg.className = 'auth-message'
  })
})

document.getElementById('auth-form').addEventListener('submit', async e => {
  e.preventDefault()
  const email    = document.getElementById('auth-email').value.trim()
  const password = document.getElementById('auth-password').value
  authSubmit.disabled = true
  authMsg.textContent = authMode === 'login' ? '로그인 중...' : '회원가입 중...'
  authMsg.className = 'auth-message'

  let error
  if (authMode === 'login') {
    const res = await supabase.auth.signInWithPassword({ email, password })
    error = res.error
  } else {
    const res = await supabase.auth.signUp({ email, password })
    error = res.error
    if (!error && !res.data?.session) {
      authMsg.textContent = '이메일을 확인해서 인증 링크를 클릭한 후 로그인하세요.'
      authMsg.className = 'auth-message success'
      authSubmit.disabled = false
      return
    }
  }

  if (error) {
    authMsg.textContent = error.message
    authMsg.className = 'auth-message error'
    authSubmit.disabled = false
  }
  // 성공 시 onAuthStateChange가 처리
})

document.getElementById('logout-btn').addEventListener('click', async () => {
  await supabase.auth.signOut()
})
