// Level 1 Schedule — timetable, notes, checklists and assignment tracker.
// Plain ES module, no build step. Timetable data lives in /schedule.json;
// everything the user adds lives in `data` (localStorage + optional cloud sync).

/* ================================================================== */
/* Utilities                                                           */
/* ================================================================== */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = (p = 'i') => `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const D = {
  parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
  iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
  add(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; },
  addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); },
  sow(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return D.add(x, -x.getDay()); }, // Sunday
  mins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; },
  hm(min) { return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; },
  diffDays(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 864e5); },
  today() { return D.iso(new Date()); },
  nowMin() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); },
};
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY3 = DAY.map((d) => d.slice(0, 3));
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = MON.map((m) => m.slice(0, 3));

function fmtTime(t, withSuffix = true) {
  if (!t) return '';
  const m = D.mins(t);
  if (data.settings.clock === '24') return t;
  const h = Math.floor(m / 60), mm = m % 60, h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(mm)}${withSuffix ? (h < 12 ? ' am' : ' pm') : ''}`;
}
function fmtRange(a, b) {
  if (!a) return '';
  if (!b) return fmtTime(a);
  if (data.settings.clock === '24') return `${a}–${b}`;
  const same = D.mins(a) < 720 === D.mins(b) < 720;
  return `${fmtTime(a, !same)}–${fmtTime(b)}`;
}
function fmtDate(iso, opts = {}) {
  const d = D.parse(iso);
  const s = `${opts.long ? DAY[d.getDay()] : DAY3[d.getDay()]}, ${MON3[d.getMonth()]} ${d.getDate()}`;
  return opts.year ? `${s}, ${d.getFullYear()}` : s;
}
function relDay(iso) {
  const n = D.diffDays(D.today(), iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days ago`;
  if (n < 7) return `in ${n} days`;
  return fmtDate(iso);
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}
function download(name, text, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const ICON = {
  online: '<svg class="mode-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="8" rx="1"/><path d="M6 14h4M8 11v3"/></svg>',
  inperson: '<svg class="mode-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/></svg>',
  clip: '<svg class="mode-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 5 6 9.5a1.5 1.5 0 0 0 2.1 2.1l4.6-4.6a3 3 0 0 0-4.2-4.2L3.9 7.4a4.5 4.5 0 0 0 6.4 6.4L14 10"/></svg>',
  note: '<svg class="mode-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h7l3 3v9H3zM10 2v3h3M5.5 8h5M5.5 10.5h5"/></svg>',
  prev: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 5l-5 5 5 5"/></svg>',
  next: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5l5 5-5 5"/></svg>',
  plus: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>',
  x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>',
  trash: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/></svg>',
};

/* ================================================================== */
/* Timetable data                                                      */
/* ================================================================== */
let SCHED = { term: {}, courses: {}, sessions: [] };
const byDate = new Map();
const byId = new Map();

const COURSE_INSTR = {}; // code -> main instructors, most frequent first
const COURSE_SHORT = {
  DH101: 'Preclinical Practice I', DH102: 'Practice Env I', DH103: 'Dental Anatomy', DH104: 'Client Mgmt & Education',
  DH105: 'Anatomy, Path & Patho', DH106: 'Rad Theory', DH107: 'Comm Techniques', DH108: 'Micro & Infection Ctrl',
  DH109: 'Head & Neck Anatomy', DH110: 'Prof Issues I', DH111: 'Psych for the HP', DH112: 'Oral Histo & Embryo', DH113: 'Rad Lab',
  L1O: 'Level 1 Orientation',
};
const codeLabel = (c) => (c ? esc(c.replace(/^DH/, 'DH ')) : '');
const courseColor = (c) => (c && SCHED.courses[c] ? `var(--${c})` : 'var(--PROGRAM)');
const courseOptions = (sel) =>
  `<option value="">— None —</option>` +
  Object.entries(SCHED.courses).map(([c, n]) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${codeLabel(c)} · ${esc(n)}</option>`).join('');

async function loadSchedule() {
  const res = await fetch('/schedule.json', { cache: 'no-cache' });
  if (res.status === 401) { location.href = '/login'; return; }
  SCHED = await res.json();
  for (const s of SCHED.sessions) {
    s.src = 's';
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
    byId.set(s.id, s);
  }
  for (const code of Object.keys(SCHED.courses)) {
    const ses = SCHED.sessions.filter((s) => s.code === code);
    const count = new Map();
    for (const s of ses) for (const n of s.instructors || []) count.set(n, (count.get(n) || 0) + 1);
    // Skip people who only appear at a handful of special sessions.
    COURSE_INSTR[code] = [...count].filter(([, n]) => n >= Math.max(1, ses.length * 0.2)).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }
}

/* ================================================================== */
/* User data + sync                                                    */
/* ================================================================== */
const LS_KEY = 'l1s:data:v1';
const DEFAULT_SETTINGS = { preGroup: 'A', radGroup: 'A2', others: 'hide', theme: 'auto', clock: '12', density: 'normal', hiddenCourses: [] };
function blankData() {
  return { version: 1, items: [], notes: [], sessionMeta: {}, deleted: {}, settings: { ...DEFAULT_SETTINGS }, settingsUpdatedAt: 0, updatedAt: 0, revision: 0 };
}
let data = blankData();
const sync = { cloud: false, backend: '', state: 'local', pending: false, inflight: false, lastError: '' };

function normalizeData(d) {
  const b = blankData();
  const out = { ...b, ...(d || {}) };
  out.settings = { ...DEFAULT_SETTINGS, ...(d?.settings || {}) };
  out.items = Array.isArray(out.items) ? out.items : [];
  out.notes = Array.isArray(out.notes) ? out.notes : [];
  out.sessionMeta = out.sessionMeta && typeof out.sessionMeta === 'object' ? out.sessionMeta : {};
  out.deleted = out.deleted && typeof out.deleted === 'object' ? out.deleted : {};
  return out;
}
function loadLocal() {
  try { data = normalizeData(JSON.parse(localStorage.getItem(LS_KEY))); } catch { data = blankData(); }
}
function saveLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) { toast('Could not save on this device: storage is full'); }
}

// Merge two copies record-by-record; newest edit wins, deletions stick.
function mergeData(a, b) {
  const out = normalizeData(a);
  const other = normalizeData(b);
  const deleted = { ...out.deleted };
  for (const [k, v] of Object.entries(other.deleted)) deleted[k] = Math.max(deleted[k] || 0, v);
  const mergeList = (x, y) => {
    const map = new Map();
    for (const r of [...x, ...y]) {
      const cur = map.get(r.id);
      if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) map.set(r.id, r);
    }
    return [...map.values()].filter((r) => !(deleted[r.id] >= (r.updatedAt || 0)));
  };
  out.items = mergeList(out.items, other.items);
  out.notes = mergeList(out.notes, other.notes);
  const meta = { ...out.sessionMeta };
  for (const [k, v] of Object.entries(other.sessionMeta)) if (!meta[k] || (v.updatedAt || 0) > (meta[k].updatedAt || 0)) meta[k] = v;
  out.sessionMeta = meta;
  if ((other.settingsUpdatedAt || 0) > (out.settingsUpdatedAt || 0)) {
    out.settings = other.settings;
    out.settingsUpdatedAt = other.settingsUpdatedAt;
  }
  out.deleted = deleted;
  out.updatedAt = Math.max(out.updatedAt || 0, other.updatedAt || 0);
  return out;
}

function setSync(state, text) {
  sync.state = state;
  const el = $('#sync-status');
  el.className = 'sync ' + state;
  el.textContent = text;
}
function showSyncState() {
  if (!sync.cloud) setSync('local', 'Saved on this device');
  else if (sync.lastError) setSync('error', 'Sync error — saved on device');
  else setSync('cloud', 'Synced');
}

async function pullRemote() {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (res.status === 401) { location.href = '/login'; return; }
    const j = await res.json();
    sync.cloud = !!j.cloud;
    if (j.backend) sync.backend = j.backend;
    if (j.error) throw new Error(j.error);
    if (j.cloud && j.data) {
      const before = JSON.stringify([data.items, data.notes, data.sessionMeta, data.settings]);
      const merged = mergeData(data, j.data);
      merged.revision = j.data.revision || 0;
      const remoteSame = JSON.stringify([merged.items, merged.notes, merged.sessionMeta, merged.settings]) ===
        JSON.stringify([j.data.items || [], j.data.notes || [], j.data.sessionMeta || {}, { ...DEFAULT_SETTINGS, ...(j.data.settings || {}) }]);
      data = merged;
      saveLocal();
      if (!remoteSame) schedulePush();
      sync.lastError = '';
      return before !== JSON.stringify([data.items, data.notes, data.sessionMeta, data.settings]);
    }
    if (j.cloud && !j.data && (data.items.length || data.notes.length || Object.keys(data.sessionMeta).length)) schedulePush();
    sync.lastError = '';
  } catch (e) {
    sync.lastError = String(e.message || e);
  } finally {
    showSyncState();
  }
  return false;
}

const schedulePush = debounce(push, 900);
async function push() {
  if (!sync.cloud) return;
  if (sync.inflight) { sync.pending = true; return; }
  sync.inflight = true;
  setSync('saving', 'Saving…');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, baseRevision: data.revision }),
      });
      if (res.status === 401) { location.href = '/login'; return; }
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && j.data) {
        data = mergeData(data, j.data);
        data.revision = j.data.revision;
        saveLocal();
        continue;
      }
      if (!res.ok) throw new Error(j.error || `Save failed (${res.status})`);
      data.revision = j.revision;
      saveLocal();
      sync.lastError = '';
      break;
    }
  } catch (e) {
    sync.lastError = String(e.message || e);
  } finally {
    sync.inflight = false;
    showSyncState();
    if (sync.pending) { sync.pending = false; schedulePush(); }
  }
}

function commit({ rerender = true } = {}) {
  data.updatedAt = Date.now();
  saveLocal();
  if (sync.cloud) { setSync('saving', 'Saving…'); schedulePush(); }
  if (rerender) render();
}

function getMeta(id) { return data.sessionMeta[id] || {}; }
function setMeta(id, patch) {
  data.sessionMeta[id] = { ...getMeta(id), ...patch, updatedAt: Date.now() };
}
function upsert(list, rec) {
  rec.updatedAt = Date.now();
  const i = data[list].findIndex((r) => r.id === rec.id);
  if (i > -1) data[list][i] = rec; else data[list].push(rec);
}
function remove(list, id) {
  data[list] = data[list].filter((r) => r.id !== id);
  data.deleted[id] = Date.now();
}

/* ================================================================== */
/* Entries: schedule sessions + user items, filtered by group          */
/* ================================================================== */
function relevance(s) {
  const g = s.group;
  if (!g) return 'all';
  const st = data.settings;
  if (g.type === 'pre') return g.values.includes(st.preGroup) ? 'mine' : 'other';
  if (g.type === 'rad') return g.values.includes(st.radGroup) ? 'mine' : 'other';
  return 'mine'; // partner-care clinic: both groups attend
}
function groupLabel(s) {
  const g = s.group;
  if (!g) return '';
  if (g.type === 'pre') return `Group ${g.values.join('/')}`;
  if (g.type === 'rad') return `Rad ${g.values.join(', ')}`;
  const pg = data.settings.preGroup;
  return g.clinician === pg ? `Grp ${pg}: Clinician` : g.client === pg ? `Grp ${pg}: Client` : `A/B partner care`;
}
function groupChip(s) {
  if (!s.group) return '';
  const rel = relevance(s);
  return `<span class="chip ${rel === 'mine' ? 'mine' : ''}" title="${rel === 'mine' ? 'Your group' : 'Another group'}">${esc(groupLabel(s))}</span>`;
}
function itemToEntry(it) {
  return {
    src: 'i', id: it.id, date: it.date, start: it.start || null, end: it.end || null, allDay: !it.start,
    code: it.course || null, title: it.title, mode: it.mode || (it.kind === 'event' ? 'unspecified' : 'none'),
    kind: it.kind, done: !!it.done, item: it, rel: 'all',
  };
}
// Courses switched off in the sidebar are left out of the timetable views and printouts.
const courseShown = (code) => !code || !(data.settings.hiddenCourses || []).includes(code);
function sessionsOn(iso, { all = data.settings.others !== 'hide' } = {}) {
  return (byDate.get(iso) || []).filter((s) => (all || relevance(s) !== 'other') && courseShown(s.code));
}
function itemsOn(iso) { return data.items.filter((it) => it.date === iso && courseShown(it.course)); }
function entriesOn(iso, opts) {
  const ses = sessionsOn(iso, opts).map((s) => ({ ...s, rel: relevance(s) }));
  const its = itemsOn(iso).map(itemToEntry);
  return [...ses, ...its];
}
const isTimed = (e) => e.start && e.end && (e.src === 's' || e.kind === 'event' || e.kind === 'exam');
const isClosure = (e) => e.kind === 'closure';
function dayClosed(iso) { return (byDate.get(iso) || []).find(isClosure); }
function dayTag(iso) {
  const ses = sessionsOn(iso, { all: false }).filter((s) => !isClosure(s));
  if (dayClosed(iso)) return { cls: 'off', label: 'No classes' };
  if (!ses.length) return null;
  const modes = new Set(ses.map((s) => s.mode).filter((m) => m === 'online' || m === 'in-person'));
  if (modes.size === 2) return { cls: 'mixed', label: 'Campus + online' };
  if (modes.has('in-person')) return { cls: 'campus', label: 'On campus' };
  if (modes.has('online')) return { cls: 'online', label: 'Online' };
  return { cls: 'mixed', label: 'Scheduled' };
}
const modeClass = (m) => (m === 'in-person' ? 'inperson' : m === 'online' ? 'online' : m || 'none');
const modeLabel = (m) => (m === 'in-person' ? 'In person' : m === 'online' ? 'Online' : m === 'unspecified' ? 'Location TBA' : '');
const modeChip = (m) => (m === 'online' || m === 'in-person' ? `<span class="chip mode ${modeClass(m)}">${m === 'online' ? ICON.online : ICON.inperson}${modeLabel(m)}</span>` : '');
const kindChip = (e) =>
  e.kind === 'exam' ? '<span class="chip exam">EXAM</span>' : e.kind === 'test' ? '<span class="chip test">TEST</span>' : '';
const entryColor = (e) => (e.src === 'i' && !e.code ? 'var(--PERSONAL)' : courseColor(e.code));
const entryTitle = (e) => (e.src === 's' && e.code && e.title === SCHED.courses[e.code] ? COURSE_SHORT[e.code] : e.title);
function minutesOf(e) {
  return e.start && e.end ? D.mins(e.end) - D.mins(e.start) : 0;
}

/* ================================================================== */
/* App shell                                                           */
/* ================================================================== */
const ui = {
  view: 'week',
  cursor: new Date(),
  agendaDays: 21,
  agendaCourse: '',
  agendaQuery: '',
  agendaPast: false,
  taskFilter: 'all',
  taskTimetable: true,
  taskCourse: '',
  taskKind: '',
  taskQuery: '',
  noteCourse: '',
  noteQuery: '',
  noteActive: null,
  noteMode: 'notes',
};
const narrowMQ = matchMedia('(max-width: 760px)');

function applyTheme() {
  const r = document.documentElement;
  if (data.settings.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = data.settings.theme;
  r.dataset.density = data.settings.density;
}

function renderHeader() {
  const t = SCHED.term;
  $('#term-sub').textContent = `${t.program} · ${fmtDate(t.start, { year: true }).replace(/^\w+, /, '')} – ${fmtDate(t.end, { year: true }).replace(/^\w+, /, '')}`;
  const start = D.sow(D.parse(t.start)), end = D.parse(t.end);
  const totalWeeks = Math.ceil((D.add(end, 1) - start) / (7 * 864e5));
  const today = D.parse(D.today());
  let html;
  if (today < start) html = `Term starts ${relDay(t.start)}`;
  else if (today > end) html = 'Term complete 🎉';
  else {
    const wk = Math.floor((today - start) / (7 * 864e5)) + 1;
    const pct = clamp(((today - D.parse(t.start)) / (end - D.parse(t.start))) * 100, 0, 100);
    html = `Week <b>${wk}</b> of ${totalWeeks} · ${Math.round(pct)}% through the term<div class="bar"><i style="width:${pct}%"></i></div>`;
  }
  $('#term-progress').innerHTML = html;
  const open = data.items.filter((i) => statusOf(i) !== 'done' && i.kind !== 'event').length;
  $('#task-count').textContent = open ? String(open) : '';
  $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === ui.view)));
}

function render() {
  applyTheme();
  renderHeader();
  const v = $('#view');
  const scroll = window.scrollY;
  ({ week: renderWeek, month: renderMonth, agenda: renderAgenda, tasks: renderTasks, notes: renderNotes, courses: renderCourses })[ui.view](v);
  window.scrollTo(0, scroll);
}

function setView(view) {
  ui.view = view;
  try { localStorage.setItem('l1s:view', view); } catch {}
  render();
  window.scrollTo(0, 0);
}

/* ================================================================== */
/* Week view                                                           */
/* ================================================================== */
function legendHTML() {
  const hidden = data.settings.hiddenCourses || [];
  const codes = Object.keys(SCHED.courses);
  const rad = esc(data.settings.radGroup);
  return `<aside class="side-legend card" aria-label="Legend and course filter">
    <button class="lg-collapse" data-legend="close" title="Hide sidebar" aria-label="Hide sidebar" aria-expanded="true">Hide ›</button>
    <table class="lg-table">
      <thead><tr><th colspan="2">Key</th></tr></thead>
      <tbody>
        <tr><td><span class="key inperson"></span></td><td>In person</td></tr>
        <tr><td><span class="key online"></span></td><td>Online</td></tr>
        ${data.settings.others !== 'hide' ? '<tr><td><span class="key other"></span></td><td>Other group</td></tr>' : ''}
        <tr><td><span class="chip mine">${rad}</span></td><td>Your group</td></tr>
        <tr><td><span class="chip exam">EXAM</span></td><td>Exam / test</td></tr>
        <tr><td class="ico">${ICON.note}</td><td>Has class notes</td></tr>
        <tr><td class="ico" style="color:var(--ok);font-weight:800">✓</td><td>Attended</td></tr>
      </tbody>
    </table>
    <div class="lg-head"><h3>Current courses</h3>
      <button class="link-btn" data-courses-all="${hidden.length ? 'show' : 'hide'}">${hidden.length ? 'Show all' : 'Hide all'}</button></div>
    <table class="lg-table lg-courses">
      <thead><tr><th class="cb" title="Show on timetable">Show</th><th>Code</th><th>Name</th><th>Instructor</th></tr></thead>
      <tbody>${codes.map((c) => {
        const on = !hidden.includes(c);
        return `<tr class="${on ? '' : 'off'}" style="--c:${courseColor(c)}">
          <td class="cb"><input type="checkbox" data-course-toggle="${c}" ${on ? 'checked' : ''} aria-label="Show ${codeLabel(c)} on the timetable"></td>
          <td class="cd"><span class="sw"></span>${esc(c)}</td>
          <td>${esc(SCHED.courses[c])}</td>
          <td class="ins">${esc((COURSE_INSTR[c] || []).join(', ') || '—')}</td></tr>`;
      }).join('')}</tbody>
    </table>
  </aside>`;
}
// The sidebar can fold into a thin strip; remembered per device.
let legendCollapsed = false;
try { legendCollapsed = localStorage.getItem('l1s:legend') === 'collapsed'; } catch {}
const withLegend = (main) => `<div class="with-legend ${legendCollapsed ? 'collapsed' : ''}"><div class="wl-main">${main}</div>${legendCollapsed ? `
  <button class="legend-strip card" data-legend="open" title="Show legend & course filter" aria-label="Show legend and course filter" aria-expanded="false">
    <span class="ls-arrow">‹</span><span class="ls-label">Legend & courses</span>
    <span class="ls-dots">${Object.keys(SCHED.courses).filter(courseShown).map((c) => `<i style="--c:${courseColor(c)}"></i>`).join('')}</span>
  </button>` : legendHTML()}</div>`;

function weekSummary(days) {
  let campus = 0, online = 0, exams = 0;
  for (const iso of days) {
    for (const s of sessionsOn(iso, { all: false })) {
      if (s.mode === 'in-person') campus += minutesOf(s);
      if (s.mode === 'online') online += minutesOf(s);
      if (s.kind === 'exam' || s.kind === 'test') exams++;
    }
  }
  const due = data.items.filter((i) => days.includes(i.date) && i.kind !== 'event' && !i.done).length;
  const h = (m) => `${+(m / 60).toFixed(1)} h`;
  return `<span class="muted small">${h(campus)} on campus · ${h(online)} online${exams ? ` · <b style="color:var(--danger)">${exams} exam/test</b>` : ''}${due ? ` · ${due} due` : ''}</span>`;
}

function layoutColumns(evs) {
  // Assign side-by-side lanes to overlapping events.
  evs.sort((a, b) => D.mins(a.start) - D.mins(b.start) || D.mins(b.end) - D.mins(a.end));
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const e of cluster) {
      let lane = lanes.findIndex((end) => end <= D.mins(e.start));
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = D.mins(e.end);
      e._lane = lane;
    }
    for (const e of cluster) e._lanes = lanes.length;
    cluster = [];
  };
  for (const e of evs) {
    if (D.mins(e.start) >= clusterEnd && cluster.length) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, D.mins(e.end));
  }
  if (cluster.length) flush();
  return evs;
}

function evBlockHTML(e, top, height) {
  const meta = e.src === 's' ? getMeta(e.id) : {};
  const note = ((e.src === 's' ? meta.note : e.item?.notes) || '').trim();
  const cls = ['ev', modeClass(e.mode), e.rel === 'other' ? 'other' : '', e.kind === 'exam' || e.kind === 'test' ? e.kind : '',
    e.src === 'i' ? 'personal' : '', meta.attended ? 'done-check' : ''].join(' ');
  const w = 100 / (e._lanes || 1), l = (e._lane || 0) * w;
  const mid = height >= 34;
  const code = e.code ? codeLabel(e.code) : e.src === 'i' ? 'Personal' : '';
  const icon = e.mode === 'online' ? ICON.online : e.mode === 'in-person' ? ICON.inperson : '';
  const label = `${code} ${entryTitle(e)}, ${fmtRange(e.start, e.end)}, ${modeLabel(e.mode)} ${e.group ? groupLabel(e) : ''}`;
  // Fill the remaining height with chips, then the class notes.
  let room = height - 8 - 14 - 13 - (mid ? 28 : 0);
  const chips = room >= 18 && (e.group || e.detail);
  if (chips) room -= 18;
  const noteLines = note ? Math.floor(room / 12) : 0;
  return `<button class="${cls}" data-open="${e.src}:${esc(e.id)}" aria-label="${esc(label)}${note ? '. Notes: ' + esc(note.slice(0, 200)) : ''}"
      title="${note ? esc(note.slice(0, 400)) : ''}"
      style="--c:${entryColor(e)};top:${top}px;height:${height - 2}px;left:calc(${l}% + 2px);width:calc(${w}% - 4px)">
    <div class="t1">${code ? `<span class="code">${code}</span>` : ''}${icon}${kindChip(e)}${note && noteLines < 1 ? `<span class="note-ico">${ICON.note}</span>` : ''}</div>
    ${mid ? `<div class="t2">${esc(entryTitle(e))}</div>` : ''}
    <div class="t3">${fmtRange(e.start, e.end)}</div>
    ${chips ? `<div class="chips">${groupChip(e)}${e.detail && !e.group ? `<span class="t3">${esc(e.detail)}</span>` : ''}</div>` : ''}
    ${noteLines >= 1 ? `<div class="ev-note" style="-webkit-line-clamp:${noteLines}">${ICON.note} ${esc(note)}</div>` : ''}
  </button>`;
}

function pillHTML(e) {
  if (isClosure(e)) return `<div class="pill closure" title="${esc(e.title)}"><span class="tx">${esc(e.title)}</span></div>`;
  const it = e.item;
  const kindLbl = { assignment: 'Due', exam: 'Exam', reminder: '', event: '' }[it.kind] || '';
  return `<button class="pill ${it.done ? 'done' : ''} ${it.kind}" data-open="i:${esc(it.id)}" style="--c:${entryColor(e)}" title="${esc(it.title)}">
    <span class="box"></span><span class="tx">${kindLbl ? `<b>${kindLbl}:</b> ` : ''}${it.start ? fmtTime(it.start) + ' ' : ''}${esc(it.title)}</span></button>`;
}

function weekNav(title, extra = '') {
  return `<div class="toolbar">
    <button class="btn icon" data-nav="-1" aria-label="Previous">${ICON.prev}</button>
    <button class="btn icon" data-nav="1" aria-label="Next">${ICON.next}</button>
    <button class="btn" data-nav="0">Today</button>
    <h2>${title}</h2>
    ${extra}
    <span class="spacer"></span>
    <div class="seg" role="group" aria-label="Groups shown">
      <button data-others="hide" aria-pressed="${data.settings.others === 'hide'}" title="Only sessions for your groups">My groups</button>
      <button data-others="dim" aria-pressed="${data.settings.others !== 'hide'}" title="Show every group, others faded">All groups</button>
    </div>
  </div>`;
}

function renderWeek(v) {
  const start = D.sow(ui.cursor);
  const days = [...Array(7)].map((_, i) => D.iso(D.add(start, i)));
  const end = D.add(start, 6);
  const title = start.getMonth() === end.getMonth()
    ? `${MON[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
    : `${MON3[start.getMonth()]} ${start.getDate()} – ${MON3[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  const today = D.today();
  const header = weekNav(title, weekSummary(days));

  if (narrowMQ.matches) return renderWeekList(v, header, days, today);

  const perDay = days.map((iso) => entriesOn(iso));
  const timed = perDay.flat().filter(isTimed);
  let lo = Math.min(480, ...timed.map((e) => D.mins(e.start)));
  let hi = Math.max(1020, ...timed.map((e) => D.mins(e.end)));
  lo = Math.floor(lo / 60) * 60;
  hi = Math.ceil(hi / 60) * 60;
  const slot = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot')) || 22;
  const PAD = 10;
  const px = (m) => PAD + ((m - lo) / 30) * slot;
  const sundayEmpty = !perDay[0].length;
  const cols = days.map((_, i) => (i === 0 && sundayEmpty ? '0.45fr' : '1fr')).join(' ');

  const head = days.map((iso, i) => {
    const d = D.parse(iso), tag = dayTag(iso);
    return `<div class="dh ${iso === today ? 'today' : ''}">
      <div class="dn">${DAY3[i]}</div><div class="dd">${d.getDate()}</div>
      <div class="daytag">${tag ? `<span class="chip ${tag.cls}">${tag.label}</span>` : '&nbsp;'}</div></div>`;
  }).join('');

  const allday = perDay.map((list) => `<div class="cell">${list.filter((e) => !isTimed(e)).map(pillHTML).join('')}</div>`).join('');

  let times = '';
  for (let m = lo; m <= hi; m += 60) times += `<span style="top:${px(m)}px">${fmtTime(D.hm(m), m === lo || m === 720 || data.settings.clock === '24' ? true : false)}</span>`;

  const colsHTML = perDay.map((list, i) => {
    const iso = days[i];
    const closed = dayClosed(iso);
    const evs = layoutColumns(list.filter(isTimed));
    let now = '';
    if (iso === today) {
      const n = D.nowMin();
      if (n >= lo && n <= hi) now = `<div class="now-line" style="top:${px(n)}px"></div>`;
    }
    return `<div class="wk-col ${iso === today ? 'today' : ''} ${closed && !evs.length ? 'closed' : ''}" data-day="${iso}">
      ${now}${evs.map((e) => evBlockHTML(e, px(D.mins(e.start)), px(D.mins(e.end)) - px(D.mins(e.start)))).join('')}</div>`;
  }).join('');

  v.innerHTML = withLegend(`${header}
    <div class="card week"><div class="week-inner" style="--cols:${cols}">
      <div class="wk-head"><div></div>${head}</div>
      <div class="wk-allday"><div class="lbl">Due / all day</div>${allday}</div>
      <div class="wk-body" style="height:${px(hi) + PAD}px;--pad:${PAD}px"><div class="wk-times">${times}</div>${colsHTML}</div>
    </div></div>
    `);
}

function rowEvHTML(e) {
  if (isClosure(e)) return `<div class="row-ev none" style="--c:var(--PROGRAM)"><div class="tm">All day</div><div class="ti muted">${esc(e.title)}</div></div>`;
  if (e.src === 'i' && !isTimed(e)) {
    const it = e.item;
    return `<div class="row-ev none" data-open="i:${esc(it.id)}" style="--c:${entryColor(e)}">
      <div class="tm">${it.start ? fmtTime(it.start) : it.kind === 'assignment' ? 'Due' : 'All day'}</div>
      <div><div class="ti" style="${it.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(it.title)}</div>
      <div class="meta">${it.course ? `<span class="chip crs" style="--c:${entryColor(e)}">${codeLabel(it.course)}</span>` : ''}<span>${esc(kindName(it.kind))}</span>${it.done ? '<span>✓ done</span>' : ''}</div></div></div>`;
  }
  const meta = e.src === 's' ? getMeta(e.id) : {};
  return `<div class="row-ev ${modeClass(e.mode)} ${e.rel === 'other' ? 'other' : ''}" data-open="${e.src}:${esc(e.id)}" style="--c:${entryColor(e)}">
    <div class="tm">${fmtRange(e.start, e.end)}</div>
    <div><div class="ti">${e.code ? `<span style="color:${entryColor(e)}">${codeLabel(e.code)}</span> ` : ''}${esc(entryTitle(e))}</div>
    <div class="meta">${modeChip(e.mode)}${kindChip(e)}${groupChip(e)}${e.detail ? `<span>${esc(e.detail)}</span>` : ''}${meta.attended ? '<span style="color:var(--ok)">✓ attended</span>' : ''}</div>
    ${meta.note ? `<div class="row-note">${ICON.note} ${esc(meta.note)}</div>` : ''}</div>
  </div>`;
}

function renderWeekList(v, header, days, today) {
  v.innerHTML = withLegend(`${header}<div class="daylist">${days.map((iso) => {
    const list = entriesOn(iso).sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
    const tag = dayTag(iso);
    if (!list.length && D.parse(iso).getDay() === 0) return '';
    return `<section class="card daycard ${iso === today ? 'today' : ''}">
      <h3>${fmtDate(iso, { long: true })} ${tag ? `<span class="daytag"><span class="chip ${tag.cls}">${tag.label}</span></span>` : ''}</h3>
      ${list.length ? list.map(rowEvHTML).join('') : '<div class="muted small">Nothing scheduled</div>'}
    </section>`;
  }).join('')}</div>`);
}

/* ================================================================== */
/* Month view                                                          */
/* ================================================================== */
function renderMonth(v) {
  const first = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1);
  const gridStart = D.sow(first);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((D.diffDays(D.iso(gridStart), D.iso(last)) + 1) / 7);
  const today = D.today();
  let cells = DAY3.map((d) => `<div class="mh">${d}</div>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const d = D.add(gridStart, i), iso = D.iso(d);
    const list = entriesOn(iso).sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
    const closed = dayClosed(iso);
    const tag = dayTag(iso);
    const shown = list.filter((e) => !isClosure(e));
    const max = 5;
    const minis = shown.slice(0, max).map((e) => {
      if (e.src === 'i' && !isTimed(e)) {
        return `<div class="mini none" style="--c:${entryColor(e)}">${e.item.done ? '☑' : '☐'} <span class="tx">${esc(e.title)}</span></div>`;
      }
      return `<div class="mini ${modeClass(e.mode)} ${e.kind === 'exam' || e.kind === 'test' ? e.kind : ''}" style="--c:${entryColor(e)};${e.rel === 'other' ? 'opacity:.5' : ''}">
        <span class="tm">${fmtTime(e.start, false)}</span> <b>${e.code ? codeLabel(e.code).replace('DH ', '') : '•'}</b> <span class="tx">${esc(e.kind === 'exam' ? 'EXAM ' : e.kind === 'test' ? 'TEST ' : '')}${esc(entryTitle(e))}</span></div>`;
    }).join('');
    cells += `<div class="md ${d.getMonth() !== first.getMonth() ? 'out' : ''} ${iso === today ? 'today' : ''} ${closed ? 'closed' : ''}" data-goto="${iso}" title="Open week">
      <div class="top"><span class="num">${d.getDate()}</span>${tag ? `<span class="daytag"><span class="chip ${tag.cls}">${tag.label}</span></span>` : ''}</div>
      ${closed ? `<div class="mini muted"><i>${esc(closed.title)}</i></div>` : ''}${minis}
      ${shown.length > max ? `<div class="mini more">+${shown.length - max} more</div>` : ''}
    </div>`;
  }
  v.innerHTML = withLegend(`${weekNav(`${MON[first.getMonth()]} ${first.getFullYear()}`)}<div class="month">${cells}</div>`);
}

/* ================================================================== */
/* Agenda view                                                         */
/* ================================================================== */
function matchesQuery(e, q) {
  if (!q) return true;
  const hay = [e.title, e.code, codeLabel(e.code), e.detail, (e.instructors || []).join(' '), e.item?.notes, e.src === 's' ? getMeta(e.id).note : '']
    .join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}
function renderAgenda(v) {
  const today = D.today();
  const from = ui.agendaPast ? SCHED.term.start : today;
  const startD = D.parse(from);
  const total = ui.agendaPast ? D.diffDays(from, today) + ui.agendaDays : ui.agendaDays;
  let out = '';
  for (let i = 0; i < total; i++) {
    const iso = D.iso(D.add(startD, i));
    const list = entriesOn(iso)
      .filter((e) => !ui.agendaCourse || e.code === ui.agendaCourse)
      .filter((e) => matchesQuery(e, ui.agendaQuery))
      .sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
    if (!list.length) continue;
    out += `<section class="card day ${iso === today ? 'today' : ''}"><h3>${fmtDate(iso, { long: true })} <span class="muted small">${relDay(iso) !== fmtDate(iso) ? relDay(iso) : ''}</span></h3>
      ${list.map(rowEvHTML).join('')}</section>`;
  }
  v.innerHTML = `<div class="toolbar">
      <h2>Agenda</h2>
      <input type="search" id="ag-q" placeholder="Search classes, notes, instructors…" value="${esc(ui.agendaQuery)}" style="min-width:220px">
      <select id="ag-course" aria-label="Course"><option value="">All courses</option>${Object.keys(SCHED.courses).map((c) => `<option value="${c}" ${c === ui.agendaCourse ? 'selected' : ''}>${codeLabel(c)} · ${esc(COURSE_SHORT[c])}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" id="ag-past" ${ui.agendaPast ? 'checked' : ''}> Include past</label>
      <span class="spacer"></span>
      <div class="seg" role="group" aria-label="Groups shown">
        <button data-others="hide" aria-pressed="${data.settings.others === 'hide'}">My groups</button>
        <button data-others="dim" aria-pressed="${data.settings.others !== 'hide'}">All groups</button>
      </div>
    </div>
    <div class="agenda">${out || '<div class="card empty">Nothing matches.</div>'}</div>
    <div style="text-align:center;margin-top:14px"><button class="btn" id="ag-more">Show ${ui.agendaDays >= 200 ? 'all' : 'more'}</button></div>`;
  const q = $('#ag-q');
  q.addEventListener('input', debounce(() => { ui.agendaQuery = q.value; renderAgenda(v); const n = $('#ag-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
  $('#ag-course').onchange = (e) => { ui.agendaCourse = e.target.value; renderAgenda(v); };
  $('#ag-past').onchange = (e) => { ui.agendaPast = e.target.checked; renderAgenda(v); };
  $('#ag-more').onclick = () => { ui.agendaDays += 28; renderAgenda(v); };
}

/* ================================================================== */
/* Tasks view                                                          */
/* ================================================================== */
const KINDS = { assignment: 'Assignment / due date', exam: 'Exam / test', event: 'Event', reminder: 'Reminder' };
const kindName = (k) => ({ assignment: 'Assignment', exam: 'Exam / test', event: 'Event', reminder: 'Reminder' })[k] || k;

function dueClass(it) {
  if (it.done || !it.date) return '';
  const n = D.diffDays(D.today(), it.date);
  return n < 0 ? 'over' : n <= 2 ? 'soon' : '';
}
function taskRowHTML(it) {
  const c = it.course ? courseColor(it.course) : 'var(--PERSONAL)';
  const subs = it.subtasks || [];
  const subDone = subs.filter((s) => s.done).length;
  return `<div class="task ${it.done ? 'done' : ''}" data-open="i:${esc(it.id)}">
    <input type="checkbox" data-toggle="${esc(it.id)}" ${it.done ? 'checked' : ''} aria-label="Mark done">
    <div><div class="ttl">${it.priority === 'high' ? '<span class="prio-high" title="High priority">!</span> ' : ''}${esc(it.title)}</div>
      <div class="meta">${it.course ? `<span class="chip crs" style="--c:${c}">${codeLabel(it.course)}</span>` : ''}<span>${kindName(it.kind)}</span>
      ${subs.length ? `<span>☑ ${subDone}/${subs.length}</span>` : ''}${(it.attachments || []).length ? `<span>${ICON.clip} ${(it.attachments || []).length}</span>` : ''}
      ${it.notes ? `<span>${ICON.note}</span>` : ''}</div></div>
    <div class="due ${dueClass(it)}">${it.date ? relDay(it.date) : 'No date'}${it.start ? `<br>${fmtTime(it.start)}` : ''}</div>
  </div>`;
}
const STATUS = { 'not-started': 'Not started', 'in-progress': 'In progress', done: 'Done' };
const statusOf = (it) => it.status || (it.done ? 'done' : 'not-started');
function setStatus(it, st) {
  it.status = st;
  if (st === 'done' && !it.done) it.doneAt = Date.now();
  it.done = st === 'done';
}
// "85", "85%", "17/20", "A-"-style text is kept as typed; numbers become a percentage.
function gradePct(g) {
  const t = String(g ?? '').trim();
  let m = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m && +m[2] > 0) return (+m[1] / +m[2]) * 100;
  m = /^(\d+(?:\.\d+)?)\s*%?$/.exec(t);
  return m ? +m[1] : null;
}
// One list of every deadline: your items plus exams/tests from the timetable.
function deadlineRows() {
  const rows = data.items.filter((i) => i.kind !== 'event' || i.status || i.grade).map((it) => ({
    key: 'i:' + it.id, src: 'i', id: it.id, code: it.course, name: it.title, date: it.date, time: it.start, kind: it.kind,
    status: statusOf(it), grade: it.grade || '', weight: it.weight ?? '', item: it,
  }));
  if (ui.taskTimetable) {
    for (const s of SCHED.sessions) {
      if ((s.kind !== 'exam' && s.kind !== 'test') || relevance(s) === 'other') continue;
      const m = getMeta(s.id);
      rows.push({ key: 's:' + s.id, src: 's', id: s.id, code: s.code, name: s.code ? `${s.detail || 'Exam'} — ${COURSE_SHORT[s.code]}` : s.title,
        date: s.date, time: s.start, kind: s.kind, status: m.status || (s.date < D.today() ? 'done' : 'not-started'), grade: m.grade || '', weight: m.weight ?? '', session: s });
    }
  }
  return rows.sort((a, b) => ((a.date || '9999') + (a.time || '99')).localeCompare((b.date || '9999') + (b.time || '99')));
}
function updateRow(key, patch) {
  const [src, id] = [key.slice(0, 1), key.slice(2)];
  if (src === 's') { setMeta(id, patch); return; }
  const it = data.items.find((i) => i.id === id);
  if (!it) return;
  if ('status' in patch) setStatus(it, patch.status);
  if ('grade' in patch) it.grade = patch.grade;
  if ('weight' in patch) it.weight = patch.weight;
  upsert('items', it);
}

function renderTasks(v) {
  const today = D.today();
  const weekEnd = D.iso(D.add(D.sow(new Date()), 6));
  const q = ui.taskQuery.toLowerCase();
  const all = deadlineRows().filter((r) => (!ui.taskCourse || r.code === ui.taskCourse) && (!ui.taskKind || r.kind === ui.taskKind || (ui.taskKind === 'exam' && r.kind === 'test')))
    .filter((r) => !q || `${r.name} ${r.code || ''} ${r.item?.notes || ''}`.toLowerCase().includes(q));
  let rows = all;
  if (ui.taskFilter === 'open') rows = rows.filter((r) => r.status !== 'done');
  if (ui.taskFilter === 'done') rows = rows.filter((r) => r.status === 'done');
  const open = all.filter((r) => r.status !== 'done');
  const overdue = open.filter((r) => r.date && r.date < today).length;
  const weekDue = open.filter((r) => r.date >= today && r.date <= weekEnd).length;
  const doneCount = all.length - open.length;
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0;

  let todayMarked = false;
  const body = rows.map((r) => {
    let divider = '';
    if (!todayMarked && r.date && r.date >= today) {
      todayMarked = true;
      divider = `<tr class="today-row"><td colspan="6"><span>Today · ${fmtDate(today)}</span></td></tr>`;
    }
    const over = r.status !== 'done' && r.date && r.date < today;
    const c = r.code ? courseColor(r.code) : 'var(--PERSONAL)';
    const it = r.item;
    const subs = it?.subtasks || [];
    return `${divider}<tr class="${r.status === 'done' ? 'is-done' : ''} ${r.src === 's' ? 'from-tt' : ''}">
      <td class="cls">${r.code ? `<span class="chip crs" style="--c:${c}">${codeLabel(r.code)}</span><span class="cls-name">${esc(COURSE_SHORT[r.code] || '')}</span>` : '<span class="muted">—</span>'}</td>
      <td><div class="nm"><button class="link" data-open="${r.key}">${esc(r.name)}</button>
        ${r.kind === 'exam' || r.kind === 'test' ? kindChip({ kind: r.kind === 'test' ? 'test' : 'exam' }) : ''}
        ${r.src === 's' ? '<span class="muted small">timetable</span>' : ''}
        ${subs.length ? `<span class="muted small">☑ ${subs.filter((x) => x.done).length}/${subs.length}</span>` : ''}
        ${(it?.attachments || []).length ? `<span class="muted small">${ICON.clip}${it.attachments.length}</span>` : ''}
        ${it?.notes ? `<span class="muted small" title="${esc(it.notes.slice(0, 300))}">${ICON.note}</span>` : ''}</div></td>
      <td class="dt ${over ? 'over' : ''}">${r.date ? `${MON[D.parse(r.date).getMonth()]} ${D.parse(r.date).getDate()}, ${D.parse(r.date).getFullYear()}${r.time ? ' ' + fmtTime(r.time).toUpperCase() : ''}` : 'No date'}
        <div class="rel">${r.date ? (over ? 'Overdue · ' : '') + relDay(r.date) : ''}</div></td>
      <td><select class="status st-${r.status}" data-row="${r.key}" data-field="status" aria-label="Status">
        ${Object.entries(STATUS).map(([k, n]) => `<option value="${k}" ${k === r.status ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td><input class="cell" data-row="${r.key}" data-field="grade" value="${esc(r.grade)}" placeholder="—" aria-label="Grade"></td>
      <td><input class="cell" data-row="${r.key}" data-field="weight" value="${esc(r.weight)}" placeholder="—" inputmode="decimal" aria-label="Weight (%)"></td>
    </tr>`;
  }).join('');

  v.innerHTML = `<div class="toolbar">
      <h2>Deadlines</h2>
      <div class="seg" role="group" aria-label="Status">${[['all', 'All'], ['open', 'To do'], ['done', 'Done']].map(([f, n]) => `<button data-tf="${f}" aria-pressed="${ui.taskFilter === f}">${n}</button>`).join('')}</div>
      <select id="tk-course" aria-label="Course"><option value="">All courses</option>${Object.keys(SCHED.courses).map((c) => `<option value="${c}" ${c === ui.taskCourse ? 'selected' : ''}>${codeLabel(c)} · ${esc(COURSE_SHORT[c])}</option>`).join('')}</select>
      <select id="tk-kind" aria-label="Type"><option value="">All types</option>${Object.entries(KINDS).map(([k, n]) => `<option value="${k}" ${k === ui.taskKind ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" id="tk-tt" ${ui.taskTimetable ? 'checked' : ''}> Timetable exams</label>
      <input type="search" id="tk-q" placeholder="Search…" value="${esc(ui.taskQuery)}">
      <span class="spacer"></span>
      <button class="btn primary" data-action="new-item">${ICON.plus}<span>New</span></button>
    </div>
    <div class="stats">
      <div class="card stat"><div class="v">${open.length}</div><div class="l">To do</div></div>
      <div class="card stat ${overdue ? 'warn' : ''}"><div class="v">${overdue}</div><div class="l">Overdue</div></div>
      <div class="card stat"><div class="v">${weekDue}</div><div class="l">Due this week</div></div>
      <div class="card stat"><div class="v">${pct}%</div><div class="l">${doneCount} of ${all.length} done</div><div class="progress"><i style="width:${pct}%"></i></div></div>
    </div>
    <div class="card table-wrap">
      <table class="deadlines">
        <thead><tr><th>Class</th><th>Name</th><th>Due date</th><th>Status</th><th>Grade</th><th title="Weight (% of course)">Wt %</th></tr></thead>
        <tbody>${body || `<tr><td colspan="6" class="empty">${all.length ? 'Nothing matches these filters.' : 'No deadlines yet — add one below.'}</td></tr>`}</tbody>
        <tfoot><tr class="quick-add">
          <td><select id="qa-course" aria-label="Class"><option value="">—</option>${Object.keys(SCHED.courses).map((c) => `<option value="${c}" ${c === ui.taskCourse ? 'selected' : ''}>${codeLabel(c)} · ${esc(COURSE_SHORT[c])}</option>`).join('')}</select></td>
          <td><input type="text" id="qa-name" placeholder="+ Add a deadline…" aria-label="Name"></td>
          <td><div class="qa-when"><input type="date" id="qa-date" value="${today}" aria-label="Due date"><input type="time" id="qa-time" aria-label="Due time"></div></td>
          <td><select id="qa-status" class="status" aria-label="Status">${Object.entries(STATUS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></td>
          <td><input type="text" class="cell" id="qa-weight" placeholder="Wt %" inputmode="decimal" aria-label="Weight (% of course)"></td>
          <td><button class="btn primary sm" id="qa-add">Add</button></td>
        </tr></tfoot>
      </table>
    </div>
    <p class="muted small">Click a name for notes, checklist and attachments. Grades like <b>85</b>, <b>85%</b> or <b>17/20</b> feed the course averages on the Courses page.</p>`;

  $$('[data-tf]', v).forEach((b) => (b.onclick = () => { ui.taskFilter = b.dataset.tf; renderTasks(v); }));
  $('#tk-course').onchange = (e) => { ui.taskCourse = e.target.value; renderTasks(v); };
  $('#tk-kind').onchange = (e) => { ui.taskKind = e.target.value; renderTasks(v); };
  $('#tk-tt').onchange = (e) => { ui.taskTimetable = e.target.checked; renderTasks(v); };
  const qi = $('#tk-q');
  qi.addEventListener('input', debounce(() => { ui.taskQuery = qi.value; renderTasks(v); const n = $('#tk-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
  $$('[data-row]', v).forEach((el) => (el.onchange = () => {
    const f = el.dataset.field;
    updateRow(el.dataset.row, { [f]: el.value.trim() });
    commit({ rerender: f === 'status' });
    if (f === 'status' && el.value === 'done') toast('Nice — marked done ✓');
  }));
  const add = () => {
    const name = $('#qa-name').value.trim();
    if (!name) { $('#qa-name').focus(); return; }
    const it = { id: uid('t'), kind: 'assignment', title: name, course: $('#qa-course').value || null,
      date: $('#qa-date').value || '', start: $('#qa-time').value || '', end: '', mode: '', priority: 'normal', notes: '',
      subtasks: [], attachments: [], weight: $('#qa-weight').value.trim(), grade: '', createdAt: Date.now() };
    setStatus(it, $('#qa-status').value);
    upsert('items', it);
    const keep = { course: $('#qa-course').value, date: $('#qa-date').value };
    commit();
    $('#qa-course').value = keep.course;
    $('#qa-date').value = keep.date;
    $('#qa-name').focus();
    toast('Deadline added');
  };
  $('#qa-add').onclick = add;
  $$('.quick-add input', v).forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }));
}

/* ================================================================== */
/* Notes view                                                          */
/* ================================================================== */
function renderNotes(v) {
  const q = ui.noteQuery.toLowerCase();
  const isSession = ui.noteMode === 'session';
  let list;
  if (isSession) {
    list = Object.entries(data.sessionMeta).filter(([id, m]) => m.note && byId.has(id)).map(([id, m]) => {
      const s = byId.get(id);
      return { id, title: `${codeLabel(s.code)} ${entryTitle(s)} — ${fmtDate(s.date)}`, course: s.code, body: m.note, updatedAt: m.updatedAt, session: true };
    });
  } else list = data.notes.slice();
  list = list.filter((n) => (!ui.noteCourse || n.course === ui.noteCourse) && (!q || `${n.title} ${n.body}`.toLowerCase().includes(q)));
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const active = !isSession && data.notes.find((n) => n.id === ui.noteActive);

  v.innerHTML = `<div class="toolbar">
      <h2>Notes</h2>
      <div class="seg" role="group"><button data-nm="notes" aria-pressed="${!isSession}">My notes</button><button data-nm="session" aria-pressed="${isSession}">Class session notes</button></div>
      <select id="nt-course" aria-label="Course"><option value="">All courses</option>${Object.keys(SCHED.courses).map((c) => `<option value="${c}" ${c === ui.noteCourse ? 'selected' : ''}>${codeLabel(c)} · ${esc(COURSE_SHORT[c])}</option>`).join('')}</select>
      <input type="search" id="nt-q" placeholder="Search notes…" value="${esc(ui.noteQuery)}">
      <span class="spacer"></span>
      <button class="btn primary" id="nt-new">${ICON.plus}<span>New note</span></button>
    </div>
    <div class="notes">
      <div class="card note-list" id="nt-list">${list.length ? list.map((n) => `
        <div class="note-item ${n.id === ui.noteActive ? 'active' : ''}" data-note="${esc(n.id)}" data-session="${n.session ? 1 : ''}" style="--c:${n.course ? courseColor(n.course) : 'transparent'}">
          <div class="nt">${n.pinned ? '📌' : ''}${esc(n.title || 'Untitled')}</div>
          <div class="np">${n.course ? codeLabel(n.course) + ' · ' : ''}${esc((n.body || '').slice(0, 90)) || '<i>Empty</i>'}</div>
        </div>`).join('') : `<div class="empty">${isSession ? 'Notes you write on a class (click any class in the timetable) show up here.' : 'No notes yet.'}</div>`}</div>
      <div class="card" id="nt-editor">${active ? `
        <div class="note-editor">
          <input class="title-in" id="ne-title" value="${esc(active.title)}" placeholder="Title" aria-label="Title">
          <div class="toolbar" style="margin:0">
            <select id="ne-course" aria-label="Course" style="max-width:300px">${courseOptions(active.course)}</select>
            <label class="check small"><input type="checkbox" id="ne-pin" ${active.pinned ? 'checked' : ''}> Pin to top</label>
            <span class="spacer"></span>
            <span class="muted small" id="ne-saved">Saved</span>
            <button class="btn danger sm" id="ne-del">${ICON.trash}Delete</button>
          </div>
          <textarea id="ne-body" placeholder="Write anything — lecture notes, questions for the instructor, study plan…">${esc(active.body)}</textarea>
        </div>` : `<div class="empty">${isSession ? 'Choose a session note to open its class.' : 'Select a note or create a new one.'}</div>`}</div>
    </div>`;

  $$('[data-nm]', v).forEach((b) => (b.onclick = () => { ui.noteMode = b.dataset.nm; ui.noteActive = null; renderNotes(v); }));
  $('#nt-course').onchange = (e) => { ui.noteCourse = e.target.value; renderNotes(v); };
  const qi = $('#nt-q');
  qi.addEventListener('input', debounce(() => { ui.noteQuery = qi.value; renderNotes(v); const n = $('#nt-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
  $('#nt-new').onclick = () => newNote(ui.noteCourse);
  $$('.note-item', v).forEach((el) => (el.onclick = () => {
    if (el.dataset.session) return openSession(el.dataset.note);
    ui.noteActive = el.dataset.note;
    renderNotes(v);
    if (narrowMQ.matches) $('#nt-editor').scrollIntoView({ behavior: 'smooth' });
  }));
  if (active) {
    const persist = debounce(() => { commit({ rerender: false }); const el = $('#ne-saved'); if (el) el.textContent = 'Saved'; }, 400);
    const dirty = () => {
      Object.assign(active, { title: $('#ne-title').value, body: $('#ne-body').value, course: $('#ne-course').value || null, pinned: $('#ne-pin').checked });
      upsert('notes', active);
      $('#ne-saved').textContent = 'Saving…';
      persist();
      const li = $(`.note-item[data-note="${CSS.escape(active.id)}"]`);
      if (li) {
        li.querySelector('.nt').textContent = (active.pinned ? '📌' : '') + (active.title || 'Untitled');
        li.querySelector('.np').textContent = (active.course ? codeLabel(active.course) + ' · ' : '') + active.body.slice(0, 90);
        li.style.setProperty('--c', active.course ? courseColor(active.course) : 'transparent');
      }
    };
    ['#ne-title', '#ne-body'].forEach((s) => $(s).addEventListener('input', dirty));
    ['#ne-course', '#ne-pin'].forEach((s) => $(s).addEventListener('change', dirty));
    $('#ne-del').onclick = () => {
      if (!confirm('Delete this note?')) return;
      remove('notes', active.id);
      ui.noteActive = null;
      commit();
    };
  }
}
function newNote(course = '', title = '') {
  const n = { id: uid('n'), title: title || 'New note', course: course || null, body: '', pinned: false, createdAt: Date.now() };
  upsert('notes', n);
  ui.noteMode = 'notes';
  ui.noteActive = n.id;
  ui.view = 'notes';
  commit();
  setTimeout(() => { const t = $('#ne-title'); if (t) { t.focus(); t.select(); } }, 30);
}

/* ================================================================== */
/* Courses view                                                        */
/* ================================================================== */
function renderCourses(v) {
  const today = D.today(), now = D.nowMin();
  const cards = Object.entries(SCHED.courses).map(([code, name]) => {
    const ses = SCHED.sessions.filter((s) => s.code === code && relevance(s) !== 'other');
    const past = ses.filter((s) => s.date < today || (s.date === today && D.mins(s.end) <= now));
    const attended = past.filter((s) => getMeta(s.id).attended).length;
    const upcoming = ses.filter((s) => !past.includes(s));
    const next = upcoming[0];
    const nextExam = upcoming.find((s) => s.kind === 'exam' || s.kind === 'test') ||
      data.items.filter((i) => i.kind === 'exam' && i.course === code && i.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    const online = ses.filter((s) => s.mode === 'online').length, inp = ses.filter((s) => s.mode === 'in-person').length;
    const hrs = ses.reduce((a, s) => a + minutesOf(s), 0) / 60;
    const instr = COURSE_INSTR[code] || [];
    const open = data.items.filter((i) => i.course === code && statusOf(i) !== 'done').length;
    const notes = data.notes.filter((n) => n.course === code).length;
    const pct = past.length ? Math.round((attended / past.length) * 100) : 0;
    const prog = ses.length ? Math.round((past.length / ses.length) * 100) : 0;
    const graded = [
      ...data.items.filter((i) => i.course === code).map((i) => [i.grade, i.weight]),
      ...ses.filter((s) => s.kind === 'exam' || s.kind === 'test').map((s) => [getMeta(s.id).grade, getMeta(s.id).weight]),
    ].map(([g, w]) => [gradePct(g), parseFloat(w)]).filter(([g]) => g != null);
    const wSum = graded.reduce((a, [, w]) => a + (w > 0 ? w : 0), 0);
    const avg = graded.length ? (wSum ? graded.reduce((a, [g, w]) => a + (w > 0 ? g * w : 0), 0) / wSum : graded.reduce((a, [g]) => a + g, 0) / graded.length) : null;
    return `<div class="card course" style="--c:${courseColor(code)}">
      <div class="code">${codeLabel(code)}</div><h3>${esc(name)}</h3>
      <dl class="kv">
        <dt>Instructor${instr.length > 1 ? 's' : ''}</dt><dd>${esc(instr.join(', ') || '—')}</dd>
        <dt>Format</dt><dd>${inp ? `${ICON.inperson} ${inp} in person` : ''}${inp && online ? ' · ' : ''}${online ? `${ICON.online} ${online} online` : ''}</dd>
        <dt>Sessions</dt><dd>${past.length} of ${ses.length} done · ${+hrs.toFixed(1)} h total</dd>
        <dt>Attendance</dt><dd>${past.length ? `${attended}/${past.length} checked (${pct}%)` : '—'}</dd>
        <dt>Next class</dt><dd>${next ? `${fmtDate(next.date)} · ${fmtRange(next.start, next.end)}` : '—'}</dd>
        <dt>Grade so far</dt><dd>${avg != null ? `<b>${avg.toFixed(1)}%</b> <span class="muted">· ${wSum ? `${+wSum.toFixed(1)}% of course graded` : `${graded.length} graded`}</span>` : '—'}</dd>
        <dt>Next exam</dt><dd>${nextExam ? `<b style="color:var(--danger)">${fmtDate(nextExam.date)}</b> ${esc(nextExam.detail || nextExam.title || '')}` : '—'}</dd>
      </dl>
      <div class="progress" title="Course progress"><i style="width:${prog}%"></i></div>
      <div class="acts">
        <button class="btn sm" data-course-tasks="${code}">Tasks${open ? ` (${open})` : ''}</button>
        <button class="btn sm" data-course-notes="${code}">Notes${notes ? ` (${notes})` : ''}</button>
        <button class="btn sm" data-course-agenda="${code}">Sessions</button>
        <button class="btn sm" data-course-new="${code}">${ICON.plus}Add due date</button>
      </div>
    </div>`;
  }).join('');
  v.innerHTML = `<div class="toolbar"><h2>Courses</h2><span class="muted small">Counts reflect your groups (Pre-clinic ${esc(data.settings.preGroup)}, Rad lab ${esc(data.settings.radGroup)}). Tick “Attended” on a class to track attendance.</span></div>
    <div class="course-grid">${cards}</div>`;
  $$('[data-course-tasks]', v).forEach((b) => (b.onclick = () => { ui.taskCourse = b.dataset.courseTasks; ui.taskFilter = 'all'; setView('tasks'); }));
  $$('[data-course-notes]', v).forEach((b) => (b.onclick = () => { ui.noteCourse = b.dataset.courseNotes; ui.noteActive = null; setView('notes'); }));
  $$('[data-course-agenda]', v).forEach((b) => (b.onclick = () => { ui.agendaCourse = b.dataset.courseAgenda; setView('agenda'); }));
  $$('[data-course-new]', v).forEach((b) => (b.onclick = () => openItemEditor({ course: b.dataset.courseNew, kind: 'assignment' })));
}

/* ================================================================== */
/* Modals                                                              */
/* ================================================================== */
function openModal(html, { wide = false, color = '', onClose } = {}) {
  closeModal();
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" style="${color ? `--c:${color}` : ''}">${html}</div></div>`;
  const back = root.firstElementChild;
  back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
  $$('[data-close]', root).forEach((b) => (b.onclick = closeModal));
  closeModal.onClose = onClose;
  closeModal.lastFocus = document.activeElement;
  setTimeout(() => (root.querySelector('[autofocus]') || root.querySelector('.modal button, .modal input'))?.focus(), 20);
  return root.querySelector('.modal');
}
function closeModal() {
  const root = $('#modal-root');
  if (!root.innerHTML) return;
  root.innerHTML = '';
  const cb = closeModal.onClose;
  closeModal.onClose = null;
  if (cb) cb();
  closeModal.lastFocus?.focus?.();
}
const modalHead = (title, sub = '') => `<header><span class="bar"></span><div style="flex:1"><h2>${title}</h2>${sub ? `<div class="muted small">${sub}</div>` : ''}</div>
  <button class="icon-btn" data-close aria-label="Close">${ICON.x.replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"')}</button></header>`;

/* ---- Class session details ---- */
function openSession(id) {
  const s = byId.get(id);
  if (!s) return;
  const m = getMeta(id);
  const rel = relevance(s);
  const related = data.items.filter((i) => i.date === s.date && (i.course === s.code || !i.course));
  const sameCourseNext = SCHED.sessions.find((x) => x.code === s.code && x.date > s.date && relevance(x) !== 'other');
  let changed = false;
  const modal = openModal(`
    ${modalHead(`${s.code ? `<span style="color:${courseColor(s.code)}">${codeLabel(s.code)}</span> · ` : ''}${esc(s.title)}`, `${fmtDate(s.date, { long: true, year: true })}${s.start ? ` · ${fmtRange(s.start, s.end)}` : ''}`)}
    <div class="body">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${modeChip(s.mode)}${kindChip(s)}${groupChip(s)}
        ${s.type ? `<span class="chip mode">${{ lab: 'Lab', clinic: 'Clinic', lecture: 'Lecture', session: 'Session', program: 'Program' }[s.type] || s.type}</span>` : ''}
        ${rel === 'other' ? '<span class="chip" style="color:var(--warn)">Not your group</span>' : ''}</div>
      <dl class="kv-list">
        ${s.detail ? `<dt>Details</dt><dd>${esc(s.detail)}</dd>` : ''}
        ${s.instructors?.length ? `<dt>Instructor${s.instructors.length > 1 ? 's' : ''}</dt><dd>${esc(s.instructors.join(', '))}</dd>` : ''}
        ${s.group?.type === 'pair' ? `<dt>Roles</dt><dd>Group ${s.group.clinician} clinician · Group ${s.group.client} client</dd>` : ''}
        ${sameCourseNext ? `<dt>Next ${codeLabel(s.code)}</dt><dd>${fmtDate(sameCourseNext.date)} · ${fmtRange(sameCourseNext.start, sameCourseNext.end)}</dd>` : ''}
      </dl>
      <div class="checks">
        <label class="check"><input type="checkbox" data-m="prepared" ${m.prepared ? 'checked' : ''}> Prepared / pre-reading done</label>
        <label class="check"><input type="checkbox" data-m="attended" ${m.attended ? 'checked' : ''}> Attended</label>
        <label class="check"><input type="checkbox" data-m="reviewed" ${m.reviewed ? 'checked' : ''}> Notes reviewed</label>
      </div>
      <label class="field">Class notes
        <textarea id="ses-note" placeholder="Notes for this class — what was covered, homework mentioned, questions…">${esc(m.note || '')}</textarea></label>
      ${related.length ? `<div><div class="section-title" style="margin-top:0">Due this day</div><div class="card">${related.map(taskRowHTML).join('')}</div></div>` : ''}
    </div>
    <footer>
      <span class="left muted small" id="ses-saved"></span>
      ${s.code ? `<button class="btn" id="ses-cnote">${ICON.note} Course notes</button>` : ''}
      <button class="btn" id="ses-add">${ICON.plus} Add assignment / due date</button>
      <button class="btn primary" data-close>Done</button>
    </footer>`, { color: courseColor(s.code), onClose: () => changed && render() });
  const persist = debounce(() => { commit({ rerender: false }); const el = $('#ses-saved'); if (el) el.textContent = 'Saved'; }, 400);
  $('#ses-note').addEventListener('input', (e) => { setMeta(id, { note: e.target.value }); changed = true; $('#ses-saved').textContent = 'Saving…'; persist(); });
  $$('[data-m]', modal).forEach((cb) => (cb.onchange = () => { setMeta(id, { [cb.dataset.m]: cb.checked }); commit({ rerender: false }); changed = true; }));
  $$('[data-toggle]', modal).forEach((cb) => (cb.onchange = () => { changed = true; toggleItem(cb.dataset.toggle, cb.checked); }));
  $('#ses-add').onclick = () => openItemEditor({ course: s.code || null, date: s.date, kind: 'assignment' });
  if (s.code) $('#ses-cnote').onclick = () => { closeModal(); ui.noteCourse = s.code; ui.noteActive = null; ui.noteMode = 'notes'; setView('notes'); };
}

function toggleItem(id, done) {
  const it = data.items.find((i) => i.id === id);
  if (!it) return;
  setStatus(it, done ? 'done' : 'not-started');
  upsert('items', it);
  commit();
  if (done) toast('Nice — marked done ✓');
}

/* ---- Item editor (assignments, due dates, events, exams, reminders) ---- */
const MAX_LOCAL_FILE = 1_000_000, MAX_CLOUD_FILE = 2_500_000;
function openItemEditor(seed = {}) {
  const existing = seed.id && data.items.find((i) => i.id === seed.id);
  const it = existing ? structuredClone(existing) : {
    id: uid('t'), kind: seed.kind || 'assignment', title: seed.title || '', course: seed.course || null,
    date: seed.date || D.today(), start: seed.start || '', end: seed.end || '', mode: seed.mode || '', priority: 'normal',
    notes: '', subtasks: [], attachments: [], done: false, createdAt: Date.now(),
  };
  it.subtasks ||= [];
  it.attachments ||= [];
  const modal = openModal(`
    ${modalHead(existing ? 'Edit' : 'New', 'Assignments, due dates, events, exams and reminders show up on the timetable.')}
    <form class="body" id="it-form" autocomplete="off">
      <div class="seg" role="group" aria-label="Type" style="justify-self:start">${Object.keys(KINDS).map((k) => `<button type="button" data-kind="${k}" aria-pressed="${it.kind === k}">${kindName(k)}</button>`).join('')}</div>
      <label class="field">Title<input type="text" id="it-title" required value="${esc(it.title)}" placeholder="e.g. Case study write-up" autofocus></label>
      <div class="grid-2">
        <label class="field">Course<select id="it-course">${courseOptions(it.course)}</select></label>
        <label class="field">Priority<select id="it-prio"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
      </div>
      <div class="grid-3">
        <label class="field"><span id="it-date-lbl">Date</span><input type="date" id="it-date" value="${esc(it.date || '')}"></label>
        <label class="field"><span id="it-start-lbl">Time (optional)</span><input type="time" id="it-start" value="${esc(it.start || '')}"></label>
        <label class="field" id="it-end-wrap">End time<input type="time" id="it-end" value="${esc(it.end || '')}"></label>
      </div>
      <label class="field" id="it-mode-wrap">Where<select id="it-mode"><option value="">Not specified</option><option value="in-person">In person</option><option value="online">Online</option></select></label>
      <label class="field">Notes<textarea id="it-notes" placeholder="Instructions, links, page numbers…">${esc(it.notes || '')}</textarea></label>
      <div class="form-section"><div class="form-label">Checklist</div>
        <div class="subtasks" id="it-subs"></div>
        <button type="button" class="btn sm" id="it-sub-add" style="justify-self:start;margin-top:6px">${ICON.plus} Add step</button></div>
      <div class="form-section"><div class="form-label">Attachments</div>
        <div class="attach-list" id="it-files"></div>
        <label class="dropzone" id="it-drop">Drop files here or <u>browse</u><input type="file" id="it-file" multiple hidden></label>
        <div class="muted small">${sync.cloud ? 'Files up to 2.5 MB, saved to the cloud.' : 'Cloud sync is off: files up to 1 MB are kept on this device only.'}</div></div>
      <div class="grid-3">
        <label class="field">Status<select id="it-status">${Object.entries(STATUS).map(([k, n]) => `<option value="${k}" ${k === statusOf(it) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field">Grade<input type="text" id="it-grade" value="${esc(it.grade || '')}" placeholder="e.g. 85% or 17/20"></label>
        <label class="field">Weight (% of course)<input type="text" id="it-weight" inputmode="decimal" value="${esc(it.weight ?? '')}" placeholder="e.g. 10"></label>
      </div>
    </form>
    <footer>
      ${existing ? `<button class="btn danger left" id="it-del">${ICON.trash} Delete</button>` : ''}
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="it-save">Save</button>
    </footer>`, { color: it.course ? courseColor(it.course) : 'var(--PERSONAL)' });

  $('#it-prio').value = it.priority || 'normal';
  $('#it-mode').value = it.mode || '';
  const syncKind = () => {
    $$('[data-kind]', modal).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === it.kind)));
    const ev = it.kind === 'event' || it.kind === 'exam';
    $('#it-end-wrap').classList.toggle('hidden', !ev);
    $('#it-mode-wrap').classList.toggle('hidden', !ev);
    $('#it-date-lbl').textContent = it.kind === 'assignment' ? 'Due date' : 'Date';
    $('#it-start-lbl').textContent = it.kind === 'assignment' ? 'Due time (optional)' : ev ? 'Start time' : 'Time (optional)';
  };
  $$('[data-kind]', modal).forEach((b) => (b.onclick = () => { it.kind = b.dataset.kind; syncKind(); }));
  syncKind();
  $('#it-course').onchange = (e) => modal.style.setProperty('--c', e.target.value ? courseColor(e.target.value) : 'var(--PERSONAL)');

  const drawSubs = () => {
    $('#it-subs').innerHTML = it.subtasks.map((s, i) => `<div class="subtask">
      <input type="checkbox" data-si="${i}" ${s.done ? 'checked' : ''} aria-label="Done">
      <input type="text" data-st="${i}" value="${esc(s.text)}" placeholder="Step">
      <button type="button" class="icon-btn" data-sd="${i}" aria-label="Remove">${ICON.x.replace('<svg', '<svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2"')}</button></div>`).join('');
    $$('[data-si]', modal).forEach((c) => (c.onchange = () => (it.subtasks[c.dataset.si].done = c.checked)));
    $$('[data-st]', modal).forEach((c) => (c.oninput = () => (it.subtasks[c.dataset.st].text = c.value)));
    $$('[data-sd]', modal).forEach((c) => (c.onclick = () => { it.subtasks.splice(+c.dataset.sd, 1); drawSubs(); }));
  };
  drawSubs();
  $('#it-sub-add').onclick = () => { it.subtasks.push({ id: uid('s'), text: '', done: false }); drawSubs(); $$('[data-st]', modal).at(-1).focus(); };

  const drawFiles = () => {
    $('#it-files').innerHTML = it.attachments.map((f, i) => `<div class="attach">${ICON.clip}<a href="#" data-fo="${i}" title="${esc(f.name)}">${esc(f.name)}</a>
      <span class="muted small">${(f.size / 1024).toFixed(0)} KB</span><button type="button" class="icon-btn" data-fd="${i}" aria-label="Remove">${ICON.trash.replace('<svg', '<svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2"')}</button></div>`).join('');
    $$('[data-fo]', modal).forEach((a) => (a.onclick = (e) => { e.preventDefault(); openAttachment(it.attachments[a.dataset.fo]); }));
    $$('[data-fd]', modal).forEach((b) => (b.onclick = () => {
      const [f] = it.attachments.splice(+b.dataset.fd, 1);
      if (f.cloud) fetch(`/api/files?id=${encodeURIComponent(f.id)}`, { method: 'DELETE' }).catch(() => {});
      drawFiles();
    }));
  };
  drawFiles();
  const addFiles = async (files) => {
    for (const file of files) {
      const limit = sync.cloud ? MAX_CLOUD_FILE : MAX_LOCAL_FILE;
      if (file.size > limit) { toast(`${file.name} is too large (max ${(limit / 1e6).toFixed(1)} MB)`); continue; }
      const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      const att = { id: uid('f'), name: file.name, size: file.size, type: file.type };
      if (sync.cloud) {
        toast(`Uploading ${file.name}…`);
        const res = await fetch('/api/files', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...att, dataUrl }) });
        if (!res.ok) { toast(`Upload failed: ${(await res.json().catch(() => ({}))).error || res.status}`); continue; }
        att.cloud = true;
      } else att.dataUrl = dataUrl;
      it.attachments.push(att);
      drawFiles();
    }
  };
  $('#it-file').onchange = (e) => addFiles([...e.target.files]);
  const dz = $('#it-drop');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); addFiles([...e.dataTransfer.files]); };

  const save = () => {
    it.title = $('#it-title').value.trim();
    if (!it.title) { $('#it-title').focus(); toast('Add a title'); return; }
    it.course = $('#it-course').value || null;
    it.priority = $('#it-prio').value;
    it.date = $('#it-date').value || '';
    it.start = $('#it-start').value || '';
    const ev = it.kind === 'event' || it.kind === 'exam';
    it.end = ev ? $('#it-end').value || '' : '';
    if (ev && it.start && (!it.end || it.end <= it.start)) it.end = D.hm(Math.min(D.mins(it.start) + 60, 1439));
    it.mode = ev ? $('#it-mode').value : '';
    it.notes = $('#it-notes').value;
    it.subtasks = it.subtasks.filter((s) => s.text.trim());
    setStatus(it, $('#it-status').value);
    it.grade = $('#it-grade').value.trim();
    it.weight = $('#it-weight').value.trim();
    upsert('items', it);
    closeModal();
    commit();
    toast(existing ? 'Saved' : `${kindName(it.kind)} added`);
  };
  $('#it-save').onclick = save;
  $('#it-form').onsubmit = (e) => { e.preventDefault(); save(); };
  if (existing) $('#it-del').onclick = () => {
    if (!confirm('Delete this item?')) return;
    for (const f of it.attachments) if (f.cloud) fetch(`/api/files?id=${encodeURIComponent(f.id)}`, { method: 'DELETE' }).catch(() => {});
    remove('items', it.id);
    closeModal();
    commit();
  };
}
async function openAttachment(f) {
  if (f.cloud) return window.open(`/api/files?id=${encodeURIComponent(f.id)}`, '_blank', 'noopener');
  const blob = await (await fetch(f.dataUrl)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---- Settings ---- */
function openSettings() {
  const st = data.settings;
  const rads = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
  const modal = openModal(`
    ${modalHead('Settings')}
    <div class="body">
      <div class="section-title" style="margin:0">Your groups</div>
      <div class="grid-2">
        <label class="field">Pre-clinic (DH 101) group<select id="st-pre">${['A', 'B'].map((g) => `<option ${g === st.preGroup ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <label class="field">Rad lab (DH 113) group<select id="st-rad">${rads.map((g) => `<option ${g === st.radGroup ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      </div>
      <label class="field">Other groups' sessions<select id="st-others"><option value="hide">Hide them</option><option value="dim">Show them faded</option></select></label>
      <div class="section-title" style="margin:6px 0 0">Display</div>
      <div class="grid-3">
        <label class="field">Theme<select id="st-theme"><option value="auto">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label class="field">Clock<select id="st-clock"><option value="12">12-hour</option><option value="24">24-hour</option></select></label>
        <label class="field">Density<select id="st-density"><option value="normal">Comfortable</option><option value="compact">Compact</option></select></label>
      </div>
      <div class="section-title" style="margin:6px 0 0">Your data</div>
      <div class="note-hint">${sync.cloud ? `✅ Cloud sync is on${sync.backend === 'turso' ? ' (Turso database)' : ''} — notes, deadlines, checks and settings are saved online and shared by every device you sign in on. A backup is kept for each of the last 30 days.`
        : '💾 Saved in this browser only. To sync across devices, connect a Turso database in your Vercel project (Storage tab) and redeploy — see README.'}</div>
      ${sync.cloud ? '<div id="st-backups" class="backups muted small">Loading backups…</div>' : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="st-backup">Download backup (.json)</button>
        <button class="btn" id="st-ics">Export calendar (.ics)</button>
        <button class="btn" data-action="import">Import / restore…</button>
      </div>
    </div>
    <footer><button class="btn primary" data-close>Done</button></footer>`);
  $('#st-others').value = st.others === 'hide' ? 'hide' : 'dim';
  $('#st-theme').value = st.theme;
  $('#st-clock').value = st.clock;
  $('#st-density').value = st.density;
  const upd = () => {
    Object.assign(data.settings, { preGroup: $('#st-pre').value, radGroup: $('#st-rad').value, others: $('#st-others').value,
      theme: $('#st-theme').value, clock: $('#st-clock').value, density: $('#st-density').value });
    data.settingsUpdatedAt = Date.now();
    commit();
  };
  $$('select', modal).forEach((s) => (s.onchange = upd));
  $('#st-backup').onclick = () => download(`level1-backup-${D.today()}.json`, JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 1), 'application/json');
  $('#st-ics').onclick = () => download('level1-schedule.ics', buildICS(), 'text/calendar');
  if (sync.cloud) loadBackups();
}

async function loadBackups() {
  const box = $('#st-backups');
  try {
    const res = await fetch('/api/data?backups', { cache: 'no-store' });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(j.error || res.status);
    if (!$('#st-backups')) return;
    box.innerHTML = j.backups.length ? `<div class="section-title" style="margin:2px 0 6px">Cloud backups</div>
      <div class="backup-list">${j.backups.map((b) => `<div class="backup"><span><b>${fmtDate(b.day, { year: true })}</b> · ${b.items} deadlines/events · ${b.notes} notes</span>
        <button class="btn sm" data-bk-dl="${esc(b.day)}">Download</button><button class="btn sm" data-bk-restore="${esc(b.day)}">Restore</button></div>`).join('')}</div>`
      : 'No cloud backups yet — one is made automatically the first time something is saved each day.';
    const fetchBackup = async (day) => {
      const r = await fetch(`/api/data?backup=${encodeURIComponent(day)}`, { cache: 'no-store' });
      const b = await r.json();
      if (!r.ok || !b.data) throw new Error(b.error || 'Backup not found');
      return b.data;
    };
    $$('[data-bk-dl]', box).forEach((btn) => (btn.onclick = async () => {
      const d = await fetchBackup(btn.dataset.bkDl);
      download(`level1-backup-${btn.dataset.bkDl}.json`, JSON.stringify(d, null, 1), 'application/json');
    }));
    $$('[data-bk-restore]', box).forEach((btn) => (btn.onclick = async () => {
      if (!confirm(`Replace everything with the backup from ${fmtDate(btn.dataset.bkRestore, { year: true })}? Changes made since then will be lost on every device (today's state is still kept in today's backup).`)) return;
      restoreSnapshot(await fetchBackup(btn.dataset.bkRestore));
      closeModal();
      toast('Backup restored');
    }));
  } catch (e) {
    if (box) box.textContent = `Couldn't load backups: ${e.message}`;
  }
}
// Make a snapshot the current state everywhere: its records win any merge, and
// anything newer than it is deleted.
function restoreSnapshot(snap) {
  const now = Date.now();
  const next = normalizeData(snap);
  const keep = new Set([...next.items, ...next.notes].map((r) => r.id));
  const deleted = { ...data.deleted };
  for (const r of [...data.items, ...data.notes]) if (!keep.has(r.id)) deleted[r.id] = now;
  for (const id of keep) delete deleted[id];
  for (const r of [...next.items, ...next.notes]) r.updatedAt = now;
  for (const m of Object.values(next.sessionMeta)) m.updatedAt = now;
  // Session check-ins have no tombstones, so clear ones the snapshot doesn't have.
  for (const id of Object.keys(data.sessionMeta)) if (!next.sessionMeta[id]) next.sessionMeta[id] = { updatedAt: now };
  next.deleted = deleted;
  next.settingsUpdatedAt = now;
  next.revision = data.revision;
  data = next;
  commit();
}

/* ================================================================== */
/* Import / export                                                     */
/* ================================================================== */
function guessCourse(s) {
  if (/\bL1O\b|level 1 orientation/i.test(s || '')) return 'L1O';
  const m = /DH\s?-?(1\d\d)/i.exec(s || '');
  return m && SCHED.courses['DH' + m[1]] ? 'DH' + m[1] : null;
}
function guessKind(s) {
  if (/\b(exam|test|quiz|midterm|final)\b/i.test(s)) return 'exam';
  if (/\b(due|assignment|submit|submission|essay|report|homework|project|reflection|case study)\b/i.test(s)) return 'assignment';
  return 'event';
}
function parseICS(text) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out = [];
  let cur = null;
  const unesc = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
  const toLocal = (v, params) => {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
    if (!m) return null;
    if (!m[4] || /VALUE=DATE(?!-)/.test(params)) return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '' };
    let d = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    if (m[7]) d = new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]));
    return { date: D.iso(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  };
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT' || line === 'BEGIN:VTODO') { cur = {}; continue; }
    if ((line === 'END:VEVENT' || line === 'END:VTODO') && cur) {
      const st = cur.DTSTART || cur.DUE;
      if (cur.SUMMARY && st) {
        const en = cur.DTEND;
        const kind = cur.DUE && !cur.DTSTART ? 'assignment' : guessKind(cur.SUMMARY);
        out.push({ title: cur.SUMMARY, date: st.date, start: st.time, end: en && en.date === st.date ? en.time : '', kind,
          course: guessCourse(cur.SUMMARY + ' ' + (cur.DESCRIPTION || '')), notes: [cur.DESCRIPTION, cur.LOCATION && `Location: ${cur.LOCATION}`].filter(Boolean).join('\n'),
          mode: /zoom|teams|online|meet\.google/i.test(`${cur.LOCATION} ${cur.DESCRIPTION}`) ? 'online' : cur.LOCATION ? 'in-person' : '' });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    const val = line.slice(i + 1);
    if (['DTSTART', 'DTEND', 'DUE'].includes(name)) cur[name] = toLocal(val, params.join(';'));
    else if (['SUMMARY', 'DESCRIPTION', 'LOCATION'].includes(name)) cur[name] = unesc(val);
  }
  return out;
}
function parseCSV(text) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const clean = rows.filter((r) => r.some((x) => x.trim()));
  if (!clean.length) return [];
  const head = clean[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => head.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const ci = { title: col('title', 'name', 'summary', 'subject', 'assignment'), date: col('due date', 'date', 'due'), start: col('start', 'time'), end: col('end'),
    kind: col('type', 'kind', 'category'), course: col('course', 'class'), notes: col('notes', 'description', 'details') };
  if (ci.title < 0 || ci.date < 0) throw new Error('CSV needs at least “title” and “date” columns');
  const normDate = (s) => {
    s = (s || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[1])}-${pad(m[2])}`;
    const d = new Date(s);
    return isNaN(d) ? '' : D.iso(d);
  };
  const normTime = (s) => {
    const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/i.exec((s || '').trim());
    if (!m) return '';
    let h = +m[1];
    if (m[3]) { const pm = m[3][0].toLowerCase() === 'p'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return `${pad(h)}:${m[2] || '00'}`;
  };
  return clean.slice(1).map((r) => {
    const title = (r[ci.title] || '').trim();
    const kindRaw = ci.kind > -1 ? (r[ci.kind] || '').toLowerCase() : '';
    const kind = /exam|test|quiz/.test(kindRaw) ? 'exam' : /assign|due|homework/.test(kindRaw) ? 'assignment' : /remind/.test(kindRaw) ? 'reminder' : /event/.test(kindRaw) ? 'event' : guessKind(title);
    return { title, date: normDate(r[ci.date]), start: ci.start > -1 ? normTime(r[ci.start]) : '', end: ci.end > -1 ? normTime(r[ci.end]) : '', kind,
      course: guessCourse(ci.course > -1 ? r[ci.course] : '') || guessCourse(title), notes: ci.notes > -1 ? r[ci.notes] || '' : '' };
  }).filter((r) => r.title && r.date);
}
function openImport() {
  const modal = openModal(`
    ${modalHead('Import events & due dates', 'Upload a calendar (.ics from Brightspace, D2L, Google, Outlook…), a spreadsheet (.csv) or a backup (.json).')}
    <div class="body">
      <label class="dropzone" id="im-drop">Drop a file here or <u>browse</u><input type="file" id="im-file" accept=".ics,.ical,.csv,.json,text/calendar,text/csv,application/json" hidden></label>
      <div class="note-hint">CSV columns: <b>title</b>, <b>date</b> (2026-11-02 or 11/2/2026), optional <b>time</b>, <b>end</b>, <b>type</b> (assignment / exam / event / reminder), <b>course</b> (e.g. DH 105), <b>notes</b>.
        <a href="#" id="im-tpl">Download a template</a>.</div>
      <div id="im-preview"></div>
    </div>
    <footer><button class="btn" data-close>Cancel</button><button class="btn primary" id="im-go" disabled>Import</button></footer>`, { wide: true });
  let rows = [], backup = null;
  $('#im-tpl').onclick = (e) => {
    e.preventDefault();
    download('level1-import-template.csv', 'title,date,time,end,type,course,notes\nCase study draft,2026-11-20,23:59,,assignment,DH 104,Submit on Brightspace\nStudy group,2026-11-14,10:00,12:00,event,DH 105,Library room 2\n', 'text/csv');
  };
  const handle = async (file) => {
    if (!file) return;
    const text = await file.text();
    backup = null;
    try {
      if (/\.json$/i.test(file.name) || text.trim().startsWith('{')) {
        const j = JSON.parse(text);
        if (j.items || j.notes || j.sessionMeta) {
          backup = j;
          $('#im-preview').innerHTML = `<div class="note-hint">Backup from ${esc(j.exportedAt || 'unknown date')}: ${(j.items || []).length} tasks/events, ${(j.notes || []).length} notes, ${Object.keys(j.sessionMeta || {}).length} class check-ins. It will be <b>merged</b> with what you have (newest edits win).</div>`;
          $('#im-go').disabled = false;
          return;
        }
        rows = (Array.isArray(j) ? j : j.events || []).map((r) => ({ title: r.title || r.name, date: r.date, start: r.start || r.time || '', end: r.end || '', kind: KINDS[r.kind || r.type] ? r.kind || r.type : guessKind(r.title || ''), course: guessCourse(r.course || r.title), notes: r.notes || r.description || '' }))
          .filter((r) => r.title && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
      } else if (/BEGIN:VCALENDAR/.test(text)) rows = parseICS(text);
      else rows = parseCSV(text);
    } catch (e) {
      $('#im-preview').innerHTML = `<div class="note-hint" style="color:var(--danger)">${esc(e.message)}</div>`;
      return;
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    $('#im-preview').innerHTML = rows.length ? `<div class="toolbar" style="margin:0"><b>${rows.length} found</b><span class="spacer"></span><label class="check small"><input type="checkbox" id="im-all" checked> Select all</label></div>
      <div class="preview-list">${rows.map((r, i) => `<label><input type="checkbox" data-ri="${i}" checked>
        <span style="min-width:96px" class="muted">${fmtDate(r.date)}${r.start ? ' ' + fmtTime(r.start) : ''}</span>
        <select data-rk="${i}" style="width:auto;min-height:26px;padding:2px 6px">${Object.keys(KINDS).map((k) => `<option value="${k}" ${k === r.kind ? 'selected' : ''}>${kindName(k)}</option>`).join('')}</select>
        ${r.course ? `<span class="chip crs" style="--c:${courseColor(r.course)}">${codeLabel(r.course)}</span>` : ''}<span>${esc(r.title)}</span></label>`).join('')}</div>`
      : '<div class="note-hint">No events with a title and date were found in that file.</div>';
    $('#im-go').disabled = !rows.length;
    $('#im-all')?.addEventListener('change', (e) => $$('[data-ri]', modal).forEach((c) => (c.checked = e.target.checked)));
    $$('[data-rk]', modal).forEach((s) => (s.onchange = () => (rows[s.dataset.rk].kind = s.value)));
  };
  $('#im-file').onchange = (e) => handle(e.target.files[0]);
  const dz = $('#im-drop');
  dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('over'); handle(e.dataTransfer.files[0]); };
  $('#im-go').onclick = () => {
    if (backup) {
      const rev = data.revision;
      data = mergeData(data, backup);
      data.revision = rev;
      closeModal();
      commit();
      toast('Backup restored');
      return;
    }
    const picked = $$('[data-ri]', modal).filter((c) => c.checked).map((c) => rows[c.dataset.ri]);
    for (const r of picked) {
      const timed = (r.kind === 'event' || r.kind === 'exam') && r.start;
      const end = timed ? (r.end > r.start ? r.end : D.hm(Math.min(D.mins(r.start) + 60, 1439))) : '';
      upsert('items', { id: uid('t'), kind: r.kind, title: r.title.slice(0, 300), course: r.course || null, date: r.date, start: r.start || '',
        end, mode: r.mode || '', priority: 'normal', notes: r.notes || '', subtasks: [], attachments: [], done: false, createdAt: Date.now() });
    }
    closeModal();
    commit();
    toast(`Imported ${picked.length} item${picked.length === 1 ? '' : 's'}`);
  };
}
function buildICS() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  const dt = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');
  const ev = [];
  for (const s of SCHED.sessions) {
    if (relevance(s) === 'other') continue;
    const summary = `${s.code ? codeLabel(s.code) + ' ' : ''}${s.title}${s.kind === 'exam' ? ' — EXAM' : s.kind === 'test' ? ' — TEST' : ''}`;
    const desc = [modeLabel(s.mode), s.detail, s.group && groupLabel(s), s.instructors?.join(', ')].filter(Boolean).join('\n');
    ev.push(s.allDay
      ? ['BEGIN:VEVENT', `UID:${s.id}@level1`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dt(s.date)}`, `DTEND;VALUE=DATE:${dt(D.iso(D.add(D.parse(s.date), 1)))}`, `SUMMARY:${icsEsc(s.title)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT']
      : ['BEGIN:VEVENT', `UID:${s.id}@level1`, `DTSTAMP:${stamp}`, `DTSTART:${dt(s.date, s.start)}`, `DTEND:${dt(s.date, s.end)}`, `SUMMARY:${icsEsc(summary)}`,
        `DESCRIPTION:${icsEsc(desc)}`, `LOCATION:${icsEsc(modeLabel(s.mode))}`, 'END:VEVENT']);
  }
  for (const it of data.items) {
    if (!it.date) continue;
    const timed = it.start;
    const end = it.end || (timed ? D.hm(Math.min(D.mins(it.start) + 30, 1439)) : '');
    ev.push(['BEGIN:VEVENT', `UID:${it.id}@level1`, `DTSTAMP:${stamp}`,
      timed ? `DTSTART:${dt(it.date, it.start)}` : `DTSTART;VALUE=DATE:${dt(it.date)}`,
      timed ? `DTEND:${dt(it.date, end)}` : `DTEND;VALUE=DATE:${dt(D.iso(D.add(D.parse(it.date), 1)))}`,
      `SUMMARY:${icsEsc((it.kind === 'assignment' ? 'DUE: ' : '') + (it.course ? codeLabel(it.course) + ' ' : '') + it.title)}`,
      `DESCRIPTION:${icsEsc(it.notes)}`, 'END:VEVENT']);
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Level 1 Schedule//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Level 1 Schedule', ...ev.flat(), 'END:VCALENDAR'].join('\r\n');
}

/* ================================================================== */
/* Print                                                               */
/* ================================================================== */
function openPrint() {
  const termStart = D.iso(D.sow(D.parse(SCHED.term.start)));
  const modal = openModal(`
    ${modalHead('Print timetable', 'Landscape, colour-coded, sized to keep the page count low.')}
    <div class="body">
      <label class="field">What to print<select id="pr-range">
        <option value="week">This week</option><option value="next4">This week + next 3</option><option value="month">This month</option>
        <option value="rest">Rest of the term</option><option value="term">Whole term</option><option value="custom">Custom range…</option></select></label>
      <div class="grid-2 hidden" id="pr-custom">
        <label class="field">From<input type="date" id="pr-from" value="${D.iso(D.sow(ui.cursor))}"></label>
        <label class="field">To<input type="date" id="pr-to" value="${D.iso(D.add(D.sow(ui.cursor), 27))}"></label>
      </div>
      <div class="grid-2">
        <label class="field">Layout<select id="pr-layout">
          <option value="list">Compact list (fewest pages)</option><option value="grid">Time grid</option></select></label>
        <label class="field" id="pr-per-wrap">Weeks per page<select id="pr-per"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
      </div>
      <div class="checks">
        <label class="check"><input type="checkbox" id="pr-mine" checked> Only my groups</label>
        <label class="check"><input type="checkbox" id="pr-items" checked> Include my due dates & events</label>
        <label class="check"><input type="checkbox" id="pr-legend" checked> Legend & instructors in margin</label>
      </div>
      <div class="muted small" id="pr-est"></div>
    </div>
    <footer><button class="btn" data-close>Cancel</button><button class="btn primary" id="pr-go">Print</button></footer>`);
  const getRange = () => {
    const r = $('#pr-range').value, cur = D.sow(ui.cursor);
    if (r === 'week') return [cur, D.add(cur, 6)];
    if (r === 'next4') return [cur, D.add(cur, 27)];
    if (r === 'month') { const f = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1); return [D.sow(f), D.add(new Date(f.getFullYear(), f.getMonth() + 1, 0), 0)]; }
    if (r === 'rest') return [D.sow(new Date()), D.parse(SCHED.term.end)];
    if (r === 'term') return [D.parse(termStart), D.parse(SCHED.term.end)];
    return [D.sow(D.parse($('#pr-from').value || D.today())), D.parse($('#pr-to').value || D.today())];
  };
  const est = () => {
    $('#pr-custom').classList.toggle('hidden', $('#pr-range').value !== 'custom');
    const [a, b] = getRange();
    const weeks = Math.max(1, Math.ceil((D.diffDays(D.iso(a), D.iso(b)) + 1) / 7));
    const list = $('#pr-layout').value === 'list';
    $('#pr-per-wrap').classList.toggle('hidden', list);
    const pages = Math.ceil(weeks / (list ? 2.7 : +$('#pr-per').value));
    $('#pr-est').textContent = `${weeks} week${weeks > 1 ? 's' : ''} → ${list ? 'roughly ' : ''}${pages} page${pages > 1 ? 's' : ''}${list ? ' (weeks fill each page)' : ''}`;
  };
  const syncPer = () => { $('#pr-per').value = '2'; est(); };
  syncPer();
  $('#pr-layout').onchange = syncPer;
  $$('select, input', modal).forEach((el) => el.addEventListener('change', est));
  $('#pr-go').onclick = () => {
    const [a, b] = getRange();
    const opts = { layout: $('#pr-layout').value, per: +$('#pr-per').value, mine: $('#pr-mine').checked, items: $('#pr-items').checked, legend: $('#pr-legend').checked };
    closeModal();
    buildPrint(a, b, opts);
    setTimeout(() => window.print(), 60);
  };
}

function buildPrint(from, to, opts) {
  const weeks = [];
  for (let w = D.sow(from); w <= to; w = D.add(w, 7)) weeks.push([...Array(7)].map((_, i) => D.iso(D.add(w, i))));
  const entries = (iso) => {
    const ses = sessionsOn(iso, { all: !opts.mine }).map((s) => ({ ...s, rel: relevance(s) }));
    const its = opts.items ? itemsOn(iso).map(itemToEntry) : [];
    return [...ses, ...its].sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
  };
  const all = weeks.flat().map(entries);
  const sundayEmpty = weeks.every((w) => !entries(w[0]).length);
  const cols = [...Array(7)].map((_, i) => (i === 0 && sundayEmpty ? '.42fr' : '1fr')).join(' ');
  const timed = all.flat().filter(isTimed);
  const lo = Math.floor(Math.min(480, ...timed.map((e) => D.mins(e.start))) / 60) * 60;
  const hi = Math.ceil(Math.max(1020, ...timed.map((e) => D.mins(e.end))) / 60) * 60;
  const nrows = (hi - lo) / 30;
  // Landscape letter leaves ~199mm between margins; reserve room for the page and week headings.
  const rowMM = Math.max(2.2, Math.min(7, (184 - 16 - opts.per * 13) / opts.per / nrows));
  const short = (e) => (e.code ? `${codeLabel(e.code)} ` : '') + entryTitle(e);
  const noteOf = (e) => ((e.src === 's' ? getMeta(e.id).note : e.item?.notes) || '').trim();
  const noteHTML = (e, max = 160) => { const n = noteOf(e); return n ? `<div class="pn">✎ ${esc(n.length > max ? n.slice(0, max) + '…' : n)}</div>` : ''; };
  const extra = (e) => [modeLabel(e.mode), e.group ? groupLabel(e) : '', e.kind === 'exam' ? 'EXAM' : e.kind === 'test' ? 'TEST' : '', e.detail && e.kind !== 'exam' && e.kind !== 'test' ? e.detail : ''].filter(Boolean).join(' · ');

  const weekHTML = (days, idx) => {
    const a = D.parse(days[0]), b = D.parse(days[6]);
    const title = `${MON3[a.getMonth()]} ${a.getDate()} – ${MON3[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
    const brk = opts.layout === 'grid' && (idx + 1) % opts.per === 0 && idx < weeks.length - 1 ? 'break' : '';
    const heads = days.map((iso, i) => {
      const d = D.parse(iso), tag = dayTag(iso);
      return `<div class="ph ${tag?.cls === 'off' ? 'off' : ''}">${DAY3[i]} ${d.getDate()}${tag && tag.cls !== 'off' ? ` <span style="font-weight:400;color:#555">· ${tag.label}</span>` : ''}</div>`;
    }).join('');
    if (opts.layout === 'list') {
      const cells = days.map((iso) => {
        const list = entries(iso);
        return `<div>${list.map((e) => {
          if (isClosure(e)) return `<div class="closedcell">${esc(e.title)}</div>`;
          if (e.src === 'i' && !isTimed(e)) return `<div class="pe none" style="--c:${entryColor(e)}">☐ <b>${esc(e.item.kind === 'assignment' ? 'Due: ' : '')}${esc(e.title)}</b>${e.start ? ` <span class="pt">${fmtTime(e.start)}</span>` : ''}</div>`;
          return `<div class="pe ${modeClass(e.mode)} ${e.kind === 'exam' || e.kind === 'test' ? e.kind : ''}" style="--c:${entryColor(e)};${e.rel === 'other' ? 'opacity:.55' : ''}">
            <span class="pt">${fmtRange(e.start, e.end)}</span> <b>${esc(short(e))}</b><div class="pm">${esc(extra(e))}</div>${noteHTML(e)}</div>`;
        }).join('')}</div>`;
      }).join('');
      return `<section class="p-week ${brk}"><h4>${title}</h4><div class="p-list" style="--pcols:${cols}">${heads}${cells}</div></section>`;
    }
    const px = (m) => ((m - lo) / 30) * rowMM;
    let times = '';
    for (let m = lo; m <= hi; m += 60) times += `<span style="top:${px(m)}mm">${fmtTime(D.hm(m), false)}</span>`;
    const pcols = days.map((iso) => {
      const list = entries(iso);
      const evs = layoutColumns(list.filter(isTimed));
      const closed = dayClosed(iso);
      const pills = list.filter((e) => !isTimed(e) && !isClosure(e)).map((e) => `☐ ${esc(e.title)}`).join('<br>');
      return `<div class="pcol ${closed ? 'closed' : ''}">${closed ? `<div style="padding:1mm;color:#777;font-style:italic">${esc(closed.title)}</div>` : ''}
        ${pills ? `<div style="position:absolute;bottom:.5mm;left:.5mm;right:.5mm;font-size:5.5pt">${pills}</div>` : ''}
        ${evs.map((e) => {
          const w = 100 / (e._lanes || 1), l = (e._lane || 0) * w, h = px(D.mins(e.end)) - px(D.mins(e.start));
          return `<div class="pev ${modeClass(e.mode)} ${e.kind === 'exam' || e.kind === 'test' ? e.kind : ''}" style="--c:${entryColor(e)};top:${px(D.mins(e.start))}mm;height:${h - 0.3}mm;left:${l}%;width:calc(${w}% - .4mm);${e.rel === 'other' ? 'opacity:.55' : ''}">
            <b>${esc(short(e))}</b>${h > rowMM * 2.2 ? `<span class="pm">${fmtRange(e.start, e.end)}</span>` : ''}${h > rowMM * 3.2 ? `<div class="pm">${esc(extra(e))}</div>` : ''}${h > rowMM * 4.5 ? noteHTML(e, 120) : ''}</div>`;
        }).join('')}</div>`;
    }).join('');
    return `<section class="p-week ${brk}"><h4>${title}</h4>
      <div class="p-grid" style="--pcols:${cols};--prow:${rowMM}mm;--nrows:${nrows}"><div class="ph"></div>${heads}<div class="ptimes">${times}</div>${pcols}</div></section>`;
  };

  const legend = opts.legend ? `<aside class="p-legend">
      <div class="pl-h">Legend</div>
      <div class="pl-key"><span class="key inperson"></span>In person</div>
      <div class="pl-key"><span class="key online"></span>Online</div>
      <div class="pl-key"><span class="pl-exam"></span>Exam / test</div>
      <div class="pl-key">✎ Your class notes</div>
      <div class="pl-h">Courses & instructors</div>
      ${Object.keys(SCHED.courses).filter(courseShown).map((c) => `<div class="pl-c" style="--c:${courseColor(c)}"><b>${codeLabel(c)}</b> ${esc(SCHED.courses[c])}
        <div class="pl-i">${esc((COURSE_INSTR[c] || []).join(', '))}</div></div>`).join('')}
    </aside>` : '';
  const st = data.settings;
  const head = `<div class="p-head"><h3>Level 1 Schedule</h3><div>${esc(SCHED.term.program)} · ${opts.mine ? `Pre-clinic group ${esc(st.preGroup)} · Rad lab group ${esc(st.radGroup)}` : 'All groups'} · printed ${fmtDate(D.today(), { year: true })}</div></div>`;
  // The legend is position:fixed, which Chrome/Edge/Safari repeat in the margin of every printed page.
  $('#print-root').innerHTML = `${legend}<div class="p-main ${opts.legend ? 'has-legend' : ''}">${head}${weeks.map(weekHTML).join('')}</div>`;
}
window.addEventListener('afterprint', () => { $('#print-root').innerHTML = ''; });

/* ================================================================== */
/* Events / navigation                                                 */
/* ================================================================== */
function navigate(dir) {
  if (dir === 0) ui.cursor = new Date();
  else if (ui.view === 'month') ui.cursor = D.addMonths(ui.cursor, dir);
  else ui.cursor = D.add(ui.cursor, 7 * dir);
  render();
}

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-toggle]')) return;
  const t = e.target.closest('[data-action],[data-nav],[data-open],[data-goto],[data-view],[data-others],[data-courses-all],[data-legend]');
  if (!t) return;
  if (t.dataset.view) return setView(t.dataset.view);
  if (t.dataset.nav !== undefined) return navigate(+t.dataset.nav);
  if (t.dataset.legend) {
    legendCollapsed = t.dataset.legend === 'close';
    try { localStorage.setItem('l1s:legend', legendCollapsed ? 'collapsed' : 'open'); } catch {}
    return render();
  }
  if (t.dataset.coursesAll) return setHiddenCourses(t.dataset.coursesAll === 'hide' ? Object.keys(SCHED.courses) : []);
  if (t.dataset.others) { data.settings.others = t.dataset.others; data.settingsUpdatedAt = Date.now(); return commit(); }
  if (t.dataset.goto) { ui.cursor = D.parse(t.dataset.goto); return setView('week'); }
  if (t.dataset.open) {
    const [src, id] = [t.dataset.open.slice(0, 1), t.dataset.open.slice(2)];
    if (src === 's') return openSession(id);
    const it = data.items.find((i) => i.id === id);
    if (it) openItemEditor(it);
    return;
  }
  const a = t.dataset.action;
  if (a === 'new-item') openItemEditor({ date: ui.view === 'week' || ui.view === 'month' ? pickDefaultDate() : D.today(), course: ui.view === 'tasks' ? ui.taskCourse || null : null });
  else if (a === 'print') openPrint();
  else if (a === 'settings') openSettings();
  else if (a === 'import') openImport();
  else if (a === 'logout') fetch('/api/logout', { method: 'POST' }).finally(() => location.replace('/login'));
});
document.addEventListener('change', (e) => {
  if (e.target.matches('#view [data-toggle]')) toggleItem(e.target.dataset.toggle, e.target.checked);
  if (e.target.matches('[data-course-toggle]')) {
    const code = e.target.dataset.courseToggle;
    const hidden = new Set(data.settings.hiddenCourses || []);
    if (e.target.checked) hidden.delete(code); else hidden.add(code);
    setHiddenCourses([...hidden]);
  }
});
function setHiddenCourses(list) {
  data.settings.hiddenCourses = list;
  data.settingsUpdatedAt = Date.now();
  commit();
}

function pickDefaultDate() {
  const today = D.today();
  const start = D.iso(D.sow(ui.cursor)), end = D.iso(D.add(D.sow(ui.cursor), 6));
  return today >= start && today <= end ? today : start;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return closeModal();
  if ($('#modal-root').innerHTML || e.target.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'j') navigate(-1);
  else if (k === 'arrowright' || k === 'k') navigate(1);
  else if (k === 't') navigate(0);
  else if (k === 'n') { e.preventDefault(); openItemEditor({ date: pickDefaultDate() }); }
  else if (k === 'p') openPrint();
  else if ('123456'.includes(k)) setView(['week', 'month', 'agenda', 'tasks', 'notes', 'courses'][+k - 1]);
});
narrowMQ.addEventListener('change', () => ui.view === 'week' && render());
// Pick up edits made on another device when coming back to the tab.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && sync.cloud && !sync.inflight && !$('#modal-root').innerHTML && ui.view !== 'notes') {
    if (await pullRemote()) render();
  }
});
// Keep the "now" line and relative dates fresh.
setInterval(() => { if (!$('#modal-root').innerHTML && ui.view === 'week' && !document.hidden) render(); }, 5 * 60 * 1000);

// Deadlines copied from the "CADH L1 - Deadline Tracker" Notion page. Fixed ids and an
// ancient updatedAt mean they are added once, and any edit or deletion always wins.
const STARTER_DEADLINES = [
  ['DH103', 'Lesson 1 Discussion', '2026-10-06', '23:59', 'done'],
  ['DH103', '1.2 - Lesson 1 Pre-Quiz', '2026-10-07', '07:30', 'done'],
  ['DH103', '2A.2 - Lesson 2A Pre-Quiz', '2026-10-08', '08:00', 'done'],
  ['DH107', '1.3 Introduction Assignment', '2026-10-08', '23:59', 'in-progress'],
  ['DH106', 'RAD Theory Ch.3/4 Quiz', '2026-10-09', '09:00', 'not-started'],
  ['L1O', 'WHMIS', '2026-10-12', '', 'not-started'],
  ['L1O', 'Health and Safety in 4 Steps', '2026-10-12', '', 'not-started'],
  ['L1O', 'Student Handbook Acknowledgement Form', '2026-10-12', '', 'not-started'],
  ['L1O', 'Student Handbook Quiz', '2026-10-12', '', 'not-started'],
  ['DH107', 'Indiana Plagiarism Test', '2026-10-16', '', 'not-started'],
];
function seedDeadlines() {
  let added = 0;
  STARTER_DEADLINES.forEach(([course, title, date, start, status], i) => {
    const id = `t_seed_${String(i + 1).padStart(2, '0')}`;
    if (data.deleted[id] || data.items.some((x) => x.id === id)) return;
    data.items.push({ id, kind: 'assignment', title, course, date, start, end: '', mode: '', priority: 'normal', notes: '', subtasks: [],
      attachments: [], status, done: status === 'done', grade: '', weight: '', createdAt: 1, updatedAt: 1 });
    added++;
  });
  if (added) commit({ rerender: false });
}

/* ================================================================== */
/* Boot                                                                */
/* ================================================================== */
(async function boot() {
  loadLocal();
  applyTheme();
  try { ui.view = localStorage.getItem('l1s:view') || 'week'; } catch {}
  if (!['week', 'month', 'agenda', 'tasks', 'notes', 'courses'].includes(ui.view)) ui.view = 'week';
  showSyncState();
  await loadSchedule();
  const today = D.today();
  if (today < SCHED.term.start || today > SCHED.term.end) ui.cursor = D.parse(today < SCHED.term.start ? SCHED.term.start : SCHED.term.end);
  render();
  await pullRemote();
  seedDeadlines();
  render();
})();
