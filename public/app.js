// Pookie's Dental Hygiene Program — timetable, notes, checklists and assignment tracker (Level 1 of 4).
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
const codeLabel = (c) => (c ? esc(c.replace(/^DH(?=\d)/, 'DH ')) : '');
// Level 1 courses have CSS colour variables; courses added for later levels carry their own colour.
const L1_SHORT = { ...COURSE_SHORT };
const CUSTOM_COLORS = {};
let BASE_L1 = null;
const courseColor = (c) => (!c ? 'var(--PROGRAM)' : CUSTOM_COLORS[c] || (L1_SHORT[c] ? `var(--${c})` : 'var(--PROGRAM)'));
const courseOptions = (sel) =>
  `<option value="">— None —</option>` +
  Object.entries(SCHED.courses).map(([c, n]) => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${codeLabel(c)} · ${esc(n)}</option>`).join('') +
  (sel && !SCHED.courses[sel] ? `<option value="${esc(sel)}" selected>${codeLabel(sel)}${COURSE_SHORT[sel] ? ' · ' + esc(COURSE_SHORT[sel]) : ''}</option>` : '');

const MAX_LEVEL = 4;
const PERIOD_TYPES = { lecture: 'Lecture', lab: 'Lab', clinic: 'Clinic', seminar: 'Seminar', other: 'Other' };
const PALETTE = ['#1971c2', '#e8590c', '#2f9e44', '#6741d9', '#d6336c', '#0c8599', '#b08900', '#a61e4d', '#364fc7', '#66a80f', '#8d5524', '#ae3ec9', '#087f5b', '#495057'];
const currentLevel = () => clamp(+data.settings.currentLevel || 1, 1, MAX_LEVEL);
const levelAvailable = (n) => n === 1 || !!data.levels?.[n];

async function loadSchedule() {
  const res = await fetch('/schedule.json', { cache: 'no-cache' });
  if (res.status === 401) { location.href = '/login'; return; }
  BASE_L1 = await res.json();
  for (const s of BASE_L1.sessions) s.src = 's';
}

// Turn a level's courses + weekly periods into dated sessions, like the Level 1 timetable.
function buildLevelSchedule(n, L, skip = new Set()) {
  const courses = Object.fromEntries((L.courses || []).map((c) => [c.code, c.name]));
  const sessions = [];
  const off = new Map();
  for (const b of L.breaks || []) {
    if (!b.from) continue;
    for (let d = D.parse(b.from); D.iso(d) <= (b.to || b.from); d = D.add(d, 1)) off.set(D.iso(d), b.label || 'No classes');
  }
  for (const [iso, label] of off) sessions.push({ id: `b_${n}_${iso}`, date: iso, allDay: true, kind: 'closure', title: label, mode: 'none', src: 's' });
  for (const p of L.periods || []) {
    const c = (L.courses || []).find((x) => x.code === p.code) ||
      (n === 1 && BASE_L1.courses[p.code] ? { code: p.code, name: BASE_L1.courses[p.code], instructor: '' } : null);
    if (!c || !p.start || !p.end || !(p.days || []).length) continue;
    const from = p.from && p.from > L.start ? p.from : L.start;
    const until = p.until && p.until < L.end ? p.until : L.end;
    const week0 = D.sow(D.parse(from));
    for (let d = D.parse(from); D.iso(d) <= until; d = D.add(d, 1)) {
      const iso = D.iso(d);
      if (!p.days.includes(d.getDay()) || off.has(iso) || skip.has(iso)) continue;
      if ((p.every || 1) > 1 && Math.round((D.sow(d) - week0) / (7 * 864e5)) % p.every) continue;
      sessions.push({
        id: `p_${p.id}_${iso}`, src: 's', date: iso, start: p.start, end: p.end, code: c.code, course: c.name, title: c.name,
        mode: p.mode || 'in-person', type: p.type || 'lecture', kind: 'class', periodId: p.id, level: n,
        detail: [p.type && p.type !== 'lecture' ? PERIOD_TYPES[p.type] : '', p.location].filter(Boolean).join(' · ') || undefined,
        instructors: c.instructor ? [c.instructor] : [],
      });
    }
  }
  sessions.sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')));
  return { term: { name: `Level ${n}`, program: BASE_L1.term.program, level: n, levels: MAX_LEVEL, start: L.start, end: L.end }, courses, sessions };
}

let levelSig = '';
// (Re)build SCHED and its indexes for the level being viewed; cheap no-op if nothing changed.
function ensureLevel() {
  let n = currentLevel();
  if (!levelAvailable(n)) n = 1;
  const L = data.levels?.[n] || null;
  const sig = n + ':' + (L ? L.updatedAt : 0) + ':' + Object.values(data.levels || {}).map((x) => x.updatedAt).join(',');
  if (sig === levelSig) return false;
  const changedLevel = !levelSig.startsWith(n + ':');
  levelSig = sig;
  if (n === 1) {
    // Official timetable plus any extra courses/periods added for Level 1.
    const closed = new Set(BASE_L1.sessions.filter((x) => x.kind === 'closure').map((x) => x.date));
    const extra = L ? buildLevelSchedule(1, { ...L, start: BASE_L1.term.start, end: BASE_L1.term.end }, closed) : null;
    SCHED = !extra ? BASE_L1 : {
      term: BASE_L1.term,
      courses: { ...BASE_L1.courses, ...extra.courses },
      sessions: [...BASE_L1.sessions, ...extra.sessions].sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || ''))),
    };
  } else SCHED = buildLevelSchedule(n, L);
  byDate.clear();
  byId.clear();
  for (const s of SCHED.sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
    byId.set(s.id, s);
  }
  for (const k of Object.keys(CUSTOM_COLORS)) delete CUSTOM_COLORS[k];
  for (const k of Object.keys(COURSE_INSTR)) delete COURSE_INSTR[k];
  for (const [lv, def] of Object.entries(data.levels || {}).sort((a, b) => (+a[0] === n) - (+b[0] === n))) {
    for (const c of def.courses || []) {
      CUSTOM_COLORS[c.code] = c.color || PALETTE[0];
      COURSE_SHORT[c.code] = c.short || c.name;
      if (+lv === n) COURSE_INSTR[c.code] = c.instructor ? [c.instructor] : [];
    }
  }
  if (n === 1) for (const c of Object.keys(L1_SHORT)) { COURSE_SHORT[c] = L1_SHORT[c]; delete CUSTOM_COLORS[c]; }
  if (n === 1) for (const c of L?.courses || []) COURSE_INSTR[c.code] = c.instructor ? [c.instructor] : [];
  for (const code of Object.keys(SCHED.courses)) {
    if (n > 1 || !L1_SHORT[code]) continue;
    const ses = SCHED.sessions.filter((s) => s.code === code);
    const count = new Map();
    for (const s of ses) for (const nm of s.instructors || []) count.set(nm, (count.get(nm) || 0) + 1);
    // Skip people who only appear at a handful of special sessions.
    COURSE_INSTR[code] = [...count].filter(([, c]) => c >= Math.max(1, ses.length * 0.2)).sort((a, b) => b[1] - a[1]).map(([nm]) => nm);
  }
  if (changedLevel) {
    const today = D.today();
    ui.cursor = D.parse(today < SCHED.term.start ? SCHED.term.start : today > SCHED.term.end ? SCHED.term.end : today);
  }
  return true;
}

/* ================================================================== */
/* User data + sync                                                    */
/* ================================================================== */
const LS_KEY = 'l1s:data:v1';
const DEFAULT_SETTINGS = { preGroup: 'A', radGroup: 'A2', others: 'hide', theme: 'auto', clock: '12', density: 'normal', hiddenCourses: [], currentLevel: 1, fun: true, completedCourses: [], types: null };
function blankData() {
  return { version: 1, items: [], notes: [], sessionMeta: {}, levels: {}, deleted: {}, settings: { ...DEFAULT_SETTINGS }, settingsUpdatedAt: 0, updatedAt: 0, revision: 0 };
}
let data = blankData();
const sync = { cloud: false, backend: '', state: 'local', pending: false, inflight: false, lastError: '' };

/* ---- Entry types: a user-managed list (name, icon, colour, default behaviours) ---- */
const DEFAULT_TYPES = [
  { id: 'assignment', name: 'Assignment', icon: '📝', color: '#e8590c', task: true, range: false },
  { id: 'exam', name: 'Exam / test', icon: '🧪', color: '#c92a2a', exam: true, range: true },
  { id: 'event', name: 'Event', icon: '📅', color: '#1098ad', range: true },
  { id: 'reminder', name: 'Reminder', icon: '🔔', color: '#f59f00', task: true, range: false },
  { id: 'class', name: 'Class', icon: '🎓', color: '#0c8599', track: true, range: true },
  { id: 'meeting', name: 'Meeting', icon: '👥', color: '#364fc7', range: true },
  { id: 'study', name: 'Study', icon: '📚', color: '#1971c2', range: true },
  { id: 'prep', name: 'Prep', icon: '✏️', color: '#6741d9', range: true },
  { id: 'commute', name: 'Commute', icon: '🚌', color: '#868e96', range: true },
  { id: 'work', name: 'Work', icon: '💼', color: '#8d5524', range: true },
  { id: 'exercise', name: 'Exercise', icon: '🏃', color: '#2f9e44', range: true },
  { id: 'appt', name: 'Appointment', icon: '🩺', color: '#d6336c', range: true },
  { id: 'social', name: 'Social', icon: '🎉', color: '#f76707', range: true },
  { id: 'other', name: 'Other', icon: '⭐', color: '#1098ad', range: true },
];
const typesList = () => (Array.isArray(data.settings.types) && data.settings.types.length ? data.settings.types : DEFAULT_TYPES);
function typeOf(it) {
  return typesList().find((t) => t.id === it?.type) || { id: it?.type || '', name: it?.type ? 'Entry' : 'Entry', icon: '•', color: '#1098ad' };
}
// Old entries had fixed kinds; give them a type and behaviour flags. `kind` is kept as a
// derived summary (exam / task / event) for code that only needs the broad category.
const deriveKind = (it) => (it.exam ? 'exam' : it.task ? 'assignment' : 'event');
function migrateItem(it) {
  if (!it.type) it.type = it.cat || { assignment: 'assignment', exam: 'exam', event: 'event', reminder: 'reminder' }[it.kind] || 'event';
  if (it.task === undefined) it.task = it.kind === 'assignment' || it.kind === 'reminder';
  if (it.exam === undefined) it.exam = it.kind === 'exam';
  it.kind = deriveKind(it);
  return it;
}

function normalizeData(d) {
  const b = blankData();
  const out = { ...b, ...(d || {}) };
  out.settings = { ...DEFAULT_SETTINGS, ...(d?.settings || {}) };
  out.items = (Array.isArray(out.items) ? out.items : []).map(migrateItem);
  out.notes = Array.isArray(out.notes) ? out.notes : [];
  out.sessionMeta = out.sessionMeta && typeof out.sessionMeta === 'object' ? out.sessionMeta : {};
  out.deleted = out.deleted && typeof out.deleted === 'object' ? out.deleted : {};
  out.levels = out.levels && typeof out.levels === 'object' && !Array.isArray(out.levels) ? out.levels : {};
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
  const levels = { ...out.levels };
  for (const [k, v] of Object.entries(other.levels)) if (!levels[k] || (v.updatedAt || 0) > (levels[k].updatedAt || 0)) levels[k] = v;
  out.levels = levels;
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
      const before = JSON.stringify([data.items, data.notes, data.sessionMeta, data.settings, data.levels]);
      const merged = mergeData(data, j.data);
      merged.revision = j.data.revision || 0;
      const remoteSame = JSON.stringify([merged.items, merged.notes, merged.sessionMeta, merged.settings, merged.levels]) ===
        JSON.stringify([j.data.items || [], j.data.notes || [], j.data.sessionMeta || {}, { ...DEFAULT_SETTINGS, ...(j.data.settings || {}) }, j.data.levels || {}]);
      data = merged;
      saveLocal();
      if (!remoteSame) schedulePush();
      sync.lastError = '';
      return before !== JSON.stringify([data.items, data.notes, data.sessionMeta, data.settings, data.levels]);
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
// Tick-box shown on class blocks/rows so attendance can be checked without opening the class.
const tracksAttendance = (e) => (e.src === 's' ? !isClosure(e) && !!e.start : !!e.item?.track);
const attendBox = (e) => {
  if (!tracksAttendance(e)) return '';
  const k = metaKey(e), on = !!getMeta(k).attended;
  return `<span class="att-box ${on ? 'on' : ''}" role="checkbox" tabindex="0" aria-checked="${on}" data-attend="${esc(k)}" title="${on ? 'Attended — click to undo' : 'Mark attended'}"><span class="att-tick">✓</span><span class="att-lbl">Attended</span></span>`;
};
// Carpool status on in-person classes: one tap flips between two user-chosen labels/colours.
const DEFAULT_CARPOOL = { onText: 'Carpool', offText: 'No carpool', onColor: '#2f9e44', offColor: '#adb5bd' };
const carpoolCfg = () => ({ ...DEFAULT_CARPOOL, ...(data.settings.carpool || {}) });
// In-person classes and in-person calendar events; repeating events keep a status per occurrence.
const hasCarpool = (e) => e.mode === 'in-person' && !isClosure(e) && !!e.start && (e.src === 's' || isTimed(e));
const carpoolKey = (e) => metaKey(e);
function carpoolChip(e) {
  if (!hasCarpool(e)) return '';
  const on = !!getMeta(carpoolKey(e)).carpool, cp = carpoolCfg();
  return `<span class="cp-chip ${on ? 'on' : ''}" role="switch" tabindex="0" aria-checked="${on}" data-carpool="${esc(carpoolKey(e))}" style="--cp:${esc(on ? cp.onColor : cp.offColor)}"
    title="${esc(on ? cp.onText : cp.offText)} — click to switch to “${esc(on ? cp.offText : cp.onText)}”"><span class="cp-car">🚗</span><span class="cp-mark" aria-label="${esc(on ? cp.onText : cp.offText)}">${on ? '✓' : '✕'}</span></span>`;
}
const carpoolText = (e) => (hasCarpool(e) ? (getMeta(carpoolKey(e)).carpool ? carpoolCfg().onText : carpoolCfg().offText) : '');
function toggleCarpool(id) {
  const on = !getMeta(id).carpool;
  setMeta(id, { carpool: on });
  commit();
  toast(`🚗 ${on ? carpoolCfg().onText : carpoolCfg().offText}`);
}
function toggleAttended(id) {
  const on = !getMeta(id).attended;
  setMeta(id, { attended: on });
  commit();
  if (on) toast('Marked attended ✓');
}
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
function itemToEntry(it, iso = it.date) {
  return {
    src: 'i', id: it.id, occ: iso, date: iso, start: it.start || null, end: it.end || null, allDay: !it.start,
    code: it.course || null, title: it.title, mode: it.mode || (it.start && it.end ? 'unspecified' : 'none'),
    kind: it.kind, done: itemDoneOn(it, iso), item: it, rel: 'all', recurring: isRecurring(it),
  };
}
// Per-occurrence key for checks on repeating entries (done, attended, carpool…).
const metaKey = (e) => (e.src === 's' ? e.id : `${e.id}@${e.occ || e.date}`);
function itemDoneOn(it, iso = it.date) {
  return isRecurring(it) ? !!getMeta(`${it.id}@${iso}`).done : statusOf(it) === 'done';
}
// Quick-complete box shown wherever a task appears.
const doneBox = (e) => (e.src === 'i' && e.item.task
  ? `<span class="att-box done-box ${e.done ? 'on' : ''}" role="checkbox" tabindex="0" aria-checked="${e.done}" data-done="${esc(e.id)}|${esc(e.occ || e.date)}" title="${e.done ? 'Done — click to undo' : 'Mark done'}"><span class="att-tick">✓</span><span class="att-lbl">Done</span></span>`
  : '');
function toggleEntryDone(key) {
  const [id, occ] = key.split('|');
  const it = data.items.find((i) => i.id === id);
  if (!it) return;
  if (isRecurring(it)) {
    const on = !getMeta(`${id}@${occ}`).done;
    setMeta(`${id}@${occ}`, { done: on });
    commit();
    if (on) toast('Nice — marked done ✓');
  } else toggleItem(id, statusOf(it) !== 'done');
}
// data-open key: sessions by id; items by id plus the occurrence date (repeating events).
const openKey = (e) => (e.src === 'i' ? `i:${e.id}|${e.occ || e.date}` : `s:${e.id}`);

/* ---- Repeating events (Google Calendar-style rules) ---- */
const isRecurring = (it) => !!it.recur && it.recur.freq && it.recur.freq !== 'none';
function occursOn(it, iso) {
  if (!isRecurring(it)) return it.date === iso;
  if (!it.date || iso < it.date) return false;
  const r = it.recur;
  if (r.until && iso > r.until) return false;
  if ((it.exdates || []).includes(iso)) return false;
  const d0 = D.parse(it.date), d = D.parse(iso), n = Math.max(1, +r.interval || 1);
  if (r.freq === 'daily') return D.diffDays(it.date, iso) % n === 0;
  if (r.freq === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5;
  if (r.freq === 'weekly') {
    const days = r.byDay?.length ? r.byDay : [d0.getDay()];
    return days.includes(d.getDay()) && Math.round((D.sow(d) - D.sow(d0)) / (7 * 864e5)) % n === 0;
  }
  if (r.freq === 'monthly') return d.getDate() === d0.getDate() && ((d.getFullYear() - d0.getFullYear()) * 12 + d.getMonth() - d0.getMonth()) % n === 0;
  return false;
}
function recurText(it) {
  if (!isRecurring(it)) return '';
  const r = it.recur, n = +r.interval || 1;
  const days = (r.byDay?.length ? r.byDay : [D.parse(it.date).getDay()]).slice().sort().map((d) => DAY3[d]).join(', ');
  const base = { daily: n > 1 ? `Every ${n} days` : 'Daily', weekdays: 'Every weekday (Mon–Fri)',
    weekly: `${n > 1 ? `Every ${n} weeks` : 'Weekly'} on ${days}`, monthly: `${n > 1 ? `Every ${n} months` : 'Monthly'} on day ${D.parse(it.date).getDate()}` }[r.freq];
  return base + (r.until ? `, until ${fmtDate(r.until, { year: true })}` : '');
}
// Courses switched off in the sidebar are left out of the timetable views and printouts.
const courseShown = (code) => !code || !(data.settings.hiddenCourses || []).includes(code);
function sessionsOn(iso, { all = data.settings.others !== 'hide' } = {}) {
  return (byDate.get(iso) || []).filter((s) => (all || relevance(s) !== 'other') && courseShown(s.code));
}
function itemsOn(iso) { return data.items.filter((it) => courseShown(it.course) && occursOn(it, iso)); }
function entriesOn(iso, opts) {
  const ses = sessionsOn(iso, opts).map((s) => ({ ...s, rel: relevance(s) }));
  const its = itemsOn(iso).map((it) => itemToEntry(it, iso));
  return [...ses, ...its];
}
const isTimed = (e) => !!(e.start && e.end && (e.src === 's' || e.item));
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
  e.kind === 'exam' || e.item?.exam ? '<span class="chip exam">EXAM</span>' : e.kind === 'test' ? '<span class="chip test">TEST</span>' : '';
const entryColor = (e) => (e.src === 'i' && !e.code ? e.item?.color || typeOf(e.item).color || 'var(--PERSONAL)' : courseColor(e.code));
const itemIcon = (it) => it.icon || typeOf(it).icon;
const entryTitle = (e) => (e.src === 's' && e.code && e.title === SCHED.courses[e.code] ? COURSE_SHORT[e.code] : e.src === 'i' ? `${itemIcon(e.item)} ${e.title}` : e.title);
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
  const level = t.level || 1, levels = t.levels || 4;
  document.title = `${t.program} — Level ${level}`;
  $('#levels').innerHTML = [...Array(levels)].map((_, i) => {
    const n = i + 1, ok = levelAvailable(n);
    return `<button type="button" class="lv ${n === level ? 'on' : ok ? 'done' : ''}" ${ok && n !== level ? `data-level="${n}"` : 'tabindex="-1"'}
      title="Level ${n}${n === level ? ' (viewing)' : ok ? ' — click to view' : ' — not set up yet (use LEVEL UP!)'}">${n}</button>`;
  }).join('');
  const prog = levelProgress(), btn = $('#levelup-btn');
  btn.classList.toggle('hidden', level >= MAX_LEVEL);
  btn.classList.toggle('locked', prog.remaining.length > 0);
  btn.classList.toggle('ready', !prog.remaining.length);
  $('#levelup-ico').textContent = prog.remaining.length ? '🔒' : '★';
  $('#levelup-count').textContent = prog.remaining.length ? `${prog.total - prog.remaining.length}/${prog.total}` : '';
  btn.title = prog.remaining.length ? `Locked: finish your Level ${level} courses to unlock (${prog.remaining.length} left)` : `Go to Level ${level + 1}!`;
  $('#term-sub').textContent = `Level ${level} of ${levels} · ${fmtDate(t.start, { year: true }).replace(/^\w+, /, '')} – ${fmtDate(t.end, { year: true }).replace(/^\w+, /, '')}`;
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
  const open = data.items.filter((i) => i.task && statusOf(i) !== 'done').length;
  $('#task-count').textContent = open ? String(open) : '';
  $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === ui.view)));
  document.body.classList.toggle('has-sidebar', ui.view === 'week' || ui.view === 'month');
}

function render() {
  if (BASE_L1) ensureLevel();
  applyTheme();
  renderHeader();
  const v = $('#view');
  const scroll = window.scrollY;
  ({ week: renderWeek, month: renderMonth, agenda: renderAgenda, tasks: renderTasks, notes: renderNotes, courses: renderCourses })[ui.view](v);
  // Animate only on tab switches and week/month navigation, never on ordinary re-renders.
  if (ui.anim) {
    const target = $('.week, .month, .daylist', v) || v;
    for (const el of [v, target]) el.classList.remove('view-enter', 'nav-next', 'nav-prev');
    void target.offsetWidth;
    target.classList.add(target === v ? 'view-enter' : ui.anim);
    if (target !== v) $('.toolbar h2', v)?.classList.add('view-enter');
    ui.anim = null;
  }
  window.scrollTo(0, scroll);
}

function setView(view) {
  if (view !== ui.view) ui.anim = 'view-enter';
  if (view !== 'notes') document.body.classList.remove('note-editing');
  else if (view === ui.view && narrowMQ.matches) ui.noteActive = null; // tapping Notes again goes back to the list
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
        <tr><td><span class="cp-chip on" style="--cp:${esc(carpoolCfg().onColor)}"><span class="cp-car">🚗</span><span class="cp-mark">✓</span></span><span class="cp-chip" style="--cp:${esc(carpoolCfg().offColor)}"><span class="cp-car">🚗</span><span class="cp-mark">✕</span></span></td><td>${esc(carpoolCfg().onText)} / ${esc(carpoolCfg().offText)} (in-person classes — tap to flip)</td></tr>
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
const SMILEY = '<svg class="smiley" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="smiley-mouth"><path d="M6.6 13h10.8c0 3.4-2.5 5.5-5.4 5.5S6.6 16.4 6.6 13z"/></clipPath></defs><circle cx="12" cy="12" r="10" fill="#ffd43b" stroke="#e8a400" stroke-width="1"/><circle cx="8.6" cy="10" r="1.4" fill="#5c3b00"/><circle cx="15.4" cy="10" r="1.4" fill="#5c3b00"/><circle cx="6.6" cy="13.4" r="1.2" fill="#ff8fab" opacity=".7"/><circle cx="17.4" cy="13.4" r="1.2" fill="#ff8fab" opacity=".7"/><path class="smile" d="M7.6 14c1 2 2.6 3 4.4 3s3.4-1 4.4-3" fill="none" stroke="#5c3b00" stroke-width="1.7" stroke-linecap="round"/><g class="grin"><path d="M6.6 13h10.8c0 3.4-2.5 5.5-5.4 5.5S6.6 16.4 6.6 13z" fill="#5c3b00"/><g clip-path="url(#smiley-mouth)"><ellipse cx="12" cy="18" rx="3.2" ry="1.6" fill="#ff8fab"/><rect x="6.4" y="12.8" width="11.2" height="2.7" rx=".6" fill="#fff"/><path d="M9.3 13v2.5M12 13v2.5M14.7 13v2.5" stroke="#d9cfc0" stroke-width=".45"/><rect class="gleam" x="5" y="11.5" width="1.3" height="5.5" fill="#fff" opacity=".95" transform="skewX(-20)"/></g><g class="glints" fill="#fff" stroke="#f2c200" stroke-width=".25"><path class="glint g1" d="M17.9 10.3Q17.9 12.0 19.599999999999998 12.0Q17.9 12.0 17.9 13.7Q17.9 12.0 16.2 12.0Q17.9 12.0 17.9 10.3Z"/><path class="glint g2" d="M5.9 15.299999999999999Q5.9 16.4 7.0 16.4Q5.9 16.4 5.9 17.5Q5.9 16.4 4.800000000000001 16.4Q5.9 16.4 5.9 15.299999999999999Z"/><path class="glint g3" d="M13.4 10.5Q13.4 11.3 14.200000000000001 11.3Q13.4 11.3 13.4 12.100000000000001Q13.4 11.3 12.6 11.3Q13.4 11.3 13.4 10.5Z"/></g></g></svg>';
// The main "add" button lives at the top of the sidebar, above the legend.
const newEntryBtn = (compact) => compact
  ? `<button class="new-entry compact" data-action="new-item" title="New calendar entry (N)" aria-label="New calendar entry" aria-keyshortcuts="N">${SMILEY}<span class="ne-plus">+</span></button>`
  : `<button class="new-entry" data-action="new-item" title="Add an event, due date, exam or reminder (N)" aria-keyshortcuts="N">${SMILEY}<span>New calendar entry</span><kbd>N</kbd></button>`;
const withLegend = (main) => `<div class="with-legend ${legendCollapsed ? 'collapsed' : ''}"><div class="wl-main">${main}</div>${legendCollapsed ? `
  <div class="side-col">${newEntryBtn(true)}<button class="legend-strip card" data-legend="open" title="Show legend & course filter" aria-label="Show legend and course filter" aria-expanded="false">
    <span class="ls-arrow">‹</span><span class="ls-label">Legend & courses</span>
    <span class="ls-dots">${Object.keys(SCHED.courses).filter(courseShown).map((c) => `<i style="--c:${courseColor(c)}"></i>`).join('')}</span>
  </button></div>` : `<div class="side-col">${newEntryBtn(false)}${legendHTML()}</div>`}</div>`;

function weekSummary(days) {
  let campus = 0, online = 0, exams = 0;
  for (const iso of days) {
    for (const s of sessionsOn(iso, { all: false })) {
      if (s.mode === 'in-person') campus += minutesOf(s);
      if (s.mode === 'online') online += minutesOf(s);
      if (s.kind === 'exam' || s.kind === 'test') exams++;
    }
  }
  const due = days.reduce((a, iso) => a + itemsOn(iso).filter((i) => i.task && !itemDoneOn(i, iso)).length, 0);
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
  const cls = ['ev', modeClass(e.mode), e.rel === 'other' ? 'other' : '', e.kind === 'exam' || e.kind === 'test' ? e.kind : '', e.src === 'i' && e.done ? 'is-done' : '',
    e.src === 'i' ? 'personal' : '', meta.attended ? 'attended' : ''].join(' ');
  const w = 100 / (e._lanes || 1), l = (e._lane || 0) * w;
  const mid = height >= 34;
  const code = e.code ? codeLabel(e.code) : e.src === 'i' ? esc(typeOf(e.item).name) : '';
  const icon = e.mode === 'online' ? ICON.online : e.mode === 'in-person' ? ICON.inperson : '';
  const label = `${code} ${entryTitle(e)}, ${fmtRange(e.start, e.end)}, ${modeLabel(e.mode)} ${e.group ? groupLabel(e) : ''}`;
  // Fill the remaining height: group chip, then the detail line (wrapped), then the class notes.
  let room = height - 8 - 14 - 13 - (mid ? 28 : 0);
  const chips = room >= 18 && e.group;
  if (chips) room -= 18;
  const detail = e.group ? '' : e.detail || '';
  const detailLines = detail ? Math.max(0, Math.min(note ? 2 : 4, Math.floor((room - 2) / 12))) : 0;
  room -= detailLines ? detailLines * 12 + 2 : 0;
  const noteLines = note ? Math.floor(room / 12) : 0;
  const draggable = e.src === 'i' && isTimed(e);
  return `<button class="${cls}" data-open="${esc(openKey(e))}" ${draggable ? 'data-drag="1"' : ''} aria-label="${esc(label)}${note ? '. Notes: ' + esc(note.slice(0, 200)) : ''}"
      title="${note ? esc(note.slice(0, 400)) : ''}"
      style="--c:${entryColor(e)};top:${top}px;height:${height - 2}px;left:calc(${l}% + 2px);width:calc(${w}% - 4px)">
    <div class="t1">${code ? `<span class="code">${code}</span>` : ''}${icon}${kindChip(e)}${note && noteLines < 1 ? `<span class="note-ico">${ICON.note}</span>` : ''}</div>
    ${mid ? `<div class="t2">${esc(entryTitle(e))}</div>` : ''}
    <div class="t3">${fmtRange(e.start, e.end)}</div>
    ${chips ? `<div class="chips">${groupChip(e)}</div>` : ''}
    ${detailLines ? `<div class="ev-detail" style="-webkit-line-clamp:${detailLines}">${esc(detail)}</div>` : ''}
    ${noteLines >= 1 ? `<div class="ev-note" style="-webkit-line-clamp:${noteLines}">${ICON.note} ${esc(note)}</div>` : ''}
    ${e.recurring ? '<span class="ev-rep" title="Repeating event">🔁</span>' : ''}${draggable ? '<span class="ev-resize" aria-hidden="true"></span>' : ''}${height >= 30 ? attendBox(e) || doneBox(e) : ''}${height >= 44 ? carpoolChip(e) : ''}
  </button>`;
}

function pillHTML(e) {
  if (isClosure(e)) return `<div class="pill closure" title="${esc(e.title)}"><span class="tx">${esc(e.title)}</span></div>`;
  const it = e.item;
  const kindLbl = it.exam ? 'Exam' : it.task ? 'Due' : '';
  const box = it.task ? `<span class="box" role="checkbox" tabindex="0" aria-checked="${e.done}" aria-label="Mark done" data-done="${esc(e.id)}|${esc(e.occ || e.date)}"></span>` : `<span class="pill-ico">${itemIcon(it)}</span>`;
  return `<button class="pill ${e.done ? 'done' : ''} ${it.kind}" data-open="${esc(openKey(e))}" style="--c:${entryColor(e)}" title="${esc(it.title)}">
    ${box}<span class="tx">${kindLbl ? `<b>${kindLbl}:</b> ` : ''}${it.start ? itemTime(it) + ' ' : ''}${esc(it.title)}</span></button>`;
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
    <div class="muted small grid-hint">Tip: drag on an empty part of the grid to add an event · drag your own events to move them, or their bottom edge to change the length.</div>
    `);
  bindWeekGrid(v, { lo, hi, slot, PAD });
}

/* ---- Google Calendar-style grid interactions ---- */
let suppressClickUntil = 0;
function bindWeekGrid(root, g) {
  const body = $('.wk-body', root);
  if (!body) return;
  const px = (m) => g.PAD + ((m - g.lo) / 30) * g.slot;
  const snap = (m) => Math.round(m / 15) * 15;
  const yToMin = (col, y) => clamp(snap(g.lo + ((y - col.getBoundingClientRect().top - g.PAD) / g.slot) * 30), g.lo, g.hi);
  const colAt = (x, y) => document.elementsFromPoint(x, y).find((el) => el.classList?.contains('wk-col'));

  body.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return; // touch: tap handled by click below
    const evEl = e.target.closest('.ev');
    if (evEl) { if (evEl.dataset.drag) dragEvent(e, evEl, !!e.target.closest('.ev-resize')); return; }
    const col = e.target.closest('.wk-col');
    if (col) dragCreate(e, col);
  });
  body.addEventListener('click', (e) => {
    if (e.pointerType !== 'touch' && !(e.detail === 0 || e.sourceCapabilities?.firesTouchEvents)) return;
    const col = e.target.closest('.wk-col');
    if (!col || e.target.closest('.ev')) return;
    const m = yToMin(col, e.clientY);
    const start = Math.min(m, g.hi - 60);
    quickCreate({ date: col.dataset.day, start, end: start + 60, col, px });
  });

  function dragCreate(e, col) {
    e.preventDefault();
    const m0 = yToMin(col, e.clientY);
    const ghost = document.createElement('div');
    ghost.className = 'ev-ghost';
    col.appendChild(ghost);
    let a = m0, b = m0 + 30, moved = false;
    const draw = () => { ghost.style.top = px(a) + 'px'; ghost.style.height = Math.max(8, px(b) - px(a) - 2) + 'px'; ghost.textContent = fmtRange(D.hm(a), D.hm(b)); };
    draw();
    const move = (ev) => {
      const m = yToMin(col, ev.clientY);
      if (Math.abs(ev.clientY - e.clientY) > 4) moved = true;
      a = Math.min(m0, m); b = Math.max(m0, m);
      if (b - a < 15) b = a + 15;
      draw();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) { a = m0; b = Math.min(m0 + 60, 24 * 60 - 1); draw(); }
      quickCreate({ date: col.dataset.day, start: a, end: b, ghost, col, px });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function dragEvent(e, el, resize) {
    const [id, occ] = el.dataset.open.slice(2).split('|');
    const it = data.items.find((i) => i.id === id);
    if (!it || !it.start || !it.end) return;
    e.preventDefault();
    const s0 = D.mins(it.start), e0 = D.mins(it.end), dur = e0 - s0;
    let col = el.closest('.wk-col'), ns = s0, ne = e0, moved = false;
    const startY = e.clientY, startX = e.clientX;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      if (!moved) { moved = true; el.classList.add('dragging'); el.style.left = '2px'; el.style.width = 'calc(100% - 4px)'; }
      const delta = snap(((ev.clientY - startY) / g.slot) * 30);
      if (resize) {
        ne = clamp(e0 + delta, s0 + 15, 24 * 60 - 1);
      } else {
        ns = clamp(s0 + delta, 0, 24 * 60 - 1 - dur);
        ne = ns + dur;
        const over = colAt(ev.clientX, ev.clientY);
        if (over && over !== col) { col = over; col.appendChild(el); }
      }
      el.style.top = px(ns) + 'px';
      el.style.height = Math.max(10, px(ne) - px(ns) - 2) + 'px';
      const t3 = el.querySelector('.t3');
      if (t3) t3.textContent = fmtRange(D.hm(ns), D.hm(ne));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) return; // plain click: opens the editor
      suppressClickUntil = Date.now() + 400;
      const date = col.dataset.day;
      if (date === occ && ns === s0 && ne === e0) return render();
      moveItem(it, occ, date, D.hm(ns), D.hm(ne));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
}

// Small "quick add" card next to the new slot, like Google Calendar's.
function quickCreate({ date, start, end, ghost, col, px }) {
  $('.qc-pop')?.remove();
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.className = 'ev-ghost';
    col.appendChild(ghost);
    ghost.style.top = px(start) + 'px';
    ghost.style.height = px(end) - px(start) - 2 + 'px';
    ghost.textContent = fmtRange(D.hm(start), D.hm(end));
  }
  let type = typesList().find((t) => t.id === 'event') || typesList()[0];
  const pop = document.createElement('div');
  pop.className = 'qc-pop card';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div><input type="text" class="qc-title" placeholder="Add title" aria-label="Title">
    <div class="qc-cats" role="group" aria-label="Type">${typesList().map((t) => `<button type="button" class="qc-cat" data-qtype="${esc(t.id)}" style="--c:${esc(t.color)}" aria-pressed="${t.id === type.id}">${t.icon} ${esc(t.name)}</button>`).join('')}</div>
    <div class="qc-when"><input type="date" class="qc-date" value="${date}" aria-label="Date">
      <input type="time" class="qc-start" aria-label="Start time"><span class="qc-dash">–</span><input type="time" class="qc-end" aria-label="End time"></div>
    <div class="qc-row"><select class="qc-course" aria-label="Course">${courseOptions(null)}</select>
      <select class="qc-mode" aria-label="Where"><option value="">Where?</option><option value="in-person">In person</option><option value="online">Online</option></select></div>
    <label class="check small qc-task"><input type="checkbox" class="qc-taskbox"> Task — show a tick-off box and list it under Deadlines</label>
    <div class="qc-acts"><button type="button" class="btn sm" data-qa="more">More options</button><button type="button" class="btn primary sm" data-qa="save">Save</button></div>`;
  document.body.appendChild(pop);
  const r = ghost.getBoundingClientRect(), w = pop.offsetWidth || 420;
  const left = r.right + 10 + w < innerWidth ? r.right + 10 : Math.max(8, r.left - w - 10);
  pop.style.left = left + 'px';
  pop.style.top = clamp(r.top, 8, innerHeight - pop.offsetHeight - 8) + 'px';
  const title = $('.qc-title', pop);
  const toMin = (v) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
  $('.qc-start', pop).value = D.hm(start);
  $('.qc-end', pop).value = D.hm(end);
  const redrawGhost = () => {
    ghost.style.top = px(start) + 'px';
    ghost.style.height = Math.max(8, px(type.range ? end : start + 30) - px(start) - 2) + 'px';
    ghost.textContent = type.range ? fmtRange(D.hm(start), D.hm(end)) : fmtTime(D.hm(start));
  };
  $('.qc-start', pop).onchange = (e) => {
    if (!e.target.value) return;
    const len = end - start;
    start = toMin(e.target.value);
    end = Math.min(start + len, 24 * 60 - 1);
    $('.qc-end', pop).value = D.hm(end);
    redrawGhost();
  };
  $('.qc-end', pop).onchange = (e) => {
    if (!e.target.value) return;
    end = Math.max(toMin(e.target.value), start + 5);
    e.target.value = D.hm(end);
    redrawGhost();
  };
  const showTime = () => {
    pop.classList.toggle('no-end', !type.range);
    $('.qc-taskbox', pop).checked = !!type.task;
    redrawGhost();
    ghost.style.setProperty('--accent', type.color);
    title.placeholder = `${type.name} (or type a title)`;
  };
  showTime();
  title.focus();
  const close = () => { pop.remove(); ghost.remove(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', onKey, true); };
  const outside = (e) => { if (!pop.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  document.addEventListener('keydown', onKey, true);
  swipeToClose($('.sheet-grip', pop), pop, close);
  // The chosen type only supplies defaults; "More options" opens every setting.
  const fields = () => ({
    type: type.id, task: $('.qc-taskbox', pop).checked, exam: !!type.exam, track: !!type.track,
    title: title.value.trim() || type.name, course: $('.qc-course', pop).value || null, date: $('.qc-date', pop).value || date,
    start: D.hm(start), end: type.range ? D.hm(end) : '', mode: $('.qc-mode', pop).value,
  });
  $$('[data-qtype]', pop).forEach((b) => (b.onclick = () => {
    type = typesList().find((t) => t.id === b.dataset.qtype) || type;
    $$('[data-qtype]', pop).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    showTime();
    title.focus();
  }));
  const save = () => {
    const f = fields();
    close();
    const it = migrateItem({ id: uid('t'), ...f, priority: 'normal', notes: '', subtasks: [], attachments: [], done: false, createdAt: Date.now(), location: '', color: '', recur: null, exdates: [] });
    setStatus(it, 'not-started');
    upsert('items', it);
    commit();
    toast(`${type.icon} ${type.name} added`);
  };
  $('[data-qa="save"]', pop).onclick = save;
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  $('[data-qa="more"]', pop).onclick = () => { const f = fields(); if (!title.value.trim()) f.title = ''; close(); openItemEditor(f); };
}

function rowEvHTML(e) {
  if (isClosure(e)) return `<div class="row-ev none" style="--c:var(--PROGRAM)"><div class="tm">All day</div><div class="ti muted">${esc(e.title)}</div></div>`;
  if (e.src === 'i' && !isTimed(e)) {
    const it = e.item;
    return `<div class="row-ev none ${it.task ? 'has-att' : ''}" data-open="${esc(openKey(e))}" style="--c:${entryColor(e)}">
      <div class="tm">${it.start ? itemTime(it) : it.task ? 'Due' : 'All day'}</div>
      <div><div class="ti" style="${e.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${itemIcon(it)} ${esc(it.title)}</div>
      <div class="meta">${it.course ? `<span class="chip crs" style="--c:${entryColor(e)}">${codeLabel(it.course)}</span>` : ''}<span>${esc(typeOf(it).name)}</span>${kindChip(e)}</div></div>${doneBox(e)}</div>`;
  }
  const meta = e.src === 's' ? getMeta(e.id) : {};
  return `<div class="row-ev ${modeClass(e.mode)} ${e.rel === 'other' ? 'other' : ''} ${tracksAttendance(e) || e.item?.task ? 'has-att' : ''}" data-open="${esc(openKey(e))}" style="--c:${entryColor(e)}">${attendBox(e) || doneBox(e)}
    <div class="tm">${fmtRange(e.start, e.end)}</div>
    <div><div class="ti">${e.code ? `<span style="color:${entryColor(e)}">${codeLabel(e.code)}</span> ` : ''}${esc(entryTitle(e))}</div>
    <div class="meta">${modeChip(e.mode)}${carpoolChip(e)}${kindChip(e)}${groupChip(e)}${e.detail ? `<span>${esc(e.detail)}</span>` : ''}</div>
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
function renderMonthMobile(v) {
  const first = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1);
  const gridStart = D.sow(first);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeks = Math.ceil((D.diffDays(D.iso(gridStart), D.iso(last)) + 1) / 7);
  const today = D.today();
  const inMonth = (iso) => D.parse(iso).getMonth() === first.getMonth();
  if (!ui.monthSel || !inMonth(ui.monthSel)) ui.monthSel = inMonth(today) ? today : D.iso(first);
  let cells = DAY3.map((d) => `<div class="mm-h">${d[0]}</div>`).join('');
  for (let i = 0; i < weeks * 7; i++) {
    const d = D.add(gridStart, i), iso = D.iso(d);
    const list = entriesOn(iso).filter((e) => !isClosure(e));
    const dots = list.slice(0, 4).map((e) => `<i class="${e.src === 'i' && e.done ? 'off' : ''} ${modeClass(e.mode)}" style="--c:${entryColor(e)}"></i>`).join('');
    cells += `<button type="button" class="mm-d ${inMonth(iso) ? '' : 'out'} ${iso === today ? 'today' : ''} ${iso === ui.monthSel ? 'sel' : ''} ${dayClosed(iso) ? 'closed' : ''}" data-msel="${iso}" aria-label="${esc(fmtDate(iso, { long: true }))}, ${list.length} item${list.length === 1 ? '' : 's'}">
      <span class="n">${d.getDate()}</span><span class="dots">${dots}${list.length > 4 ? '<b>+</b>' : ''}</span></button>`;
  }
  const sel = ui.monthSel;
  const list = entriesOn(sel).sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
  const tag = dayTag(sel);
  v.innerHTML = `${weekNav(`${MON[first.getMonth()]} ${first.getFullYear()}`)}
    <div class="card mm">${cells}</div>
    <section class="card daycard mm-day">
      <h3>${fmtDate(sel, { long: true })} ${tag ? `<span class="daytag"><span class="chip ${tag.cls}">${tag.label}</span></span>` : ''}
        <button class="btn sm" data-goto="${sel}">Week</button><button class="btn sm primary" data-add-date="${sel}">${ICON.plus} Add</button></h3>
      ${list.length ? list.map(rowEvHTML).join('') : '<div class="muted small">Nothing scheduled</div>'}
    </section>`;
}

function renderMonth(v) {
  if (narrowMQ.matches) return renderMonthMobile(v);
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
        return `<div class="mini none ${e.done ? 'mdone' : ''}" style="--c:${entryColor(e)}">${e.item.task ? `<span class="mbox" role="checkbox" tabindex="0" aria-checked="${e.done}" data-done="${esc(e.id)}|${esc(e.occ || e.date)}">${e.done ? '☑' : '☐'}</span>` : itemIcon(e.item)} <span class="tx">${esc(e.title)}</span></div>`;
      }
      return `<div class="mini ${modeClass(e.mode)} ${e.kind === 'exam' || e.kind === 'test' ? e.kind : ''}" style="--c:${entryColor(e)};${e.rel === 'other' ? 'opacity:.5' : ''}">
        <span class="tm">${fmtTime(e.start, false)}</span> <b>${e.code ? codeLabel(e.code).replace('DH ', '') : '•'}</b> <span class="tx">${esc(e.kind === 'exam' ? 'EXAM ' : e.kind === 'test' ? 'TEST ' : '')}${esc(entryTitle(e))}</span></div>`;
    }).join('');
    cells += `<div class="md ${d.getMonth() !== first.getMonth() ? 'out' : ''} ${iso === today ? 'today' : ''} ${closed ? 'closed' : ''}" data-goto="${iso}" title="Open week">
      <div class="top"><span class="num">${d.getDate()}</span><button type="button" class="md-add" data-add-date="${iso}" title="Add an event on ${esc(fmtDate(iso))}" aria-label="Add event">+</button>${tag ? `<span class="daytag"><span class="chip ${tag.cls}">${tag.label}</span></span>` : ''}</div>
      ${closed ? `<div class="mini muted"><span class="tx"><i>${esc(closed.title)}</i></span></div>` : ''}${minis}
      ${shown.length > max ? `<div class="mini more">+${shown.length - max} more</div>` : ''}
    </div>`;
  }
  v.innerHTML = withLegend(`${weekNav(`${MON[first.getMonth()]} ${first.getFullYear()}`)}<div class="month">${cells}</div>`);
}

/* ================================================================== */
/* Agenda view                                                         */
/* ================================================================== */
// Collapsed agenda days are remembered on this device; "day done" syncs like other checks.
const agendaCollapsed = new Set((() => { try { return JSON.parse(localStorage.getItem('l1s:agcol') || '[]'); } catch { return []; } })());
// Done days start folded; agendaOpened remembers done days that were opened again by hand.
const agendaOpened = new Set((() => { try { return JSON.parse(localStorage.getItem('l1s:agopen') || '[]'); } catch { return []; } })());
const saveCollapsed = () => {
  try {
    localStorage.setItem('l1s:agcol', JSON.stringify([...agendaCollapsed].slice(-400)));
    localStorage.setItem('l1s:agopen', JSON.stringify([...agendaOpened].slice(-400)));
  } catch {}
};
const dayIsCollapsed = (iso) => agendaCollapsed.has(iso) || (!!getMeta('day:' + iso).done && !agendaOpened.has(iso));
function setDayCollapsed(iso, on) {
  if (on) { agendaCollapsed.add(iso); agendaOpened.delete(iso); } else { agendaCollapsed.delete(iso); agendaOpened.add(iso); }
  saveCollapsed();
  const sec = $(`[data-agday="${iso}"]`);
  if (!sec) return;
  sec.classList.toggle('collapsed', on);
  $('.day-toggle', sec)?.setAttribute('aria-expanded', String(!on));
}
function toggleDayDone(iso) {
  const on = !getMeta('day:' + iso).done;
  setMeta('day:' + iso, { done: on });
  commit({ rerender: false });
  const sec = $(`[data-agday="${iso}"]`);
  if (sec) {
    sec.classList.toggle('day-done', on);
    const box = $('[data-daydone]', sec);
    box.classList.toggle('on', on);
    box.setAttribute('aria-checked', String(on));
    $('.dd-lbl', box).textContent = on ? 'Done' : 'Day done';
  }
  setDayCollapsed(iso, on); // finishing a day folds it away; un-ticking opens it again
  if (on) toast(`${fmtDate(iso)} done ✓`);
}
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
    const done = !!getMeta('day:' + iso).done;
    const collapsed = dayIsCollapsed(iso);
    const n = list.filter((e) => !isClosure(e)).length;
    out += `<section class="card day ${iso === today ? 'today' : ''} ${collapsed ? 'collapsed' : ''} ${done ? 'day-done' : ''}" data-agday="${iso}">
      <div class="day-head">
        <button type="button" class="day-toggle" data-collapse="${iso}" aria-expanded="${!collapsed}" aria-controls="agb-${iso}">
          <svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l6 5-6 5"/></svg>
          <h3>${fmtDate(iso, { long: true })} <span class="muted small">${relDay(iso) !== fmtDate(iso) ? relDay(iso) : ''}</span></h3>
          <span class="day-count">${n} item${n === 1 ? '' : 's'}</span>
        </button>
        <span class="att-box day-done-box ${done ? 'on' : ''}" role="checkbox" tabindex="0" aria-checked="${done}" data-daydone="${iso}" title="${done ? 'Day done — click to undo' : 'Mark this day done'}"><span class="att-tick">✓</span><span class="dd-lbl">${done ? 'Done' : 'Day done'}</span></span>
      </div>
      <div class="day-body" id="agb-${iso}"><div class="day-inner">${list.map(rowEvHTML).join('')}</div></div></section>`;
  }
  v.innerHTML = `<div class="toolbar">
      <h2>Agenda</h2>
      <input type="search" id="ag-q" class="wide-search" placeholder="Search classes, notes, instructors…" value="${esc(ui.agendaQuery)}">
      <select id="ag-course" aria-label="Course"><option value="">All courses</option>${Object.keys(SCHED.courses).map((c) => `<option value="${c}" ${c === ui.agendaCourse ? 'selected' : ''}>${codeLabel(c)} · ${esc(COURSE_SHORT[c])}</option>`).join('')}</select>
      <label class="check small"><input type="checkbox" id="ag-past" ${ui.agendaPast ? 'checked' : ''}> Include past</label>
      <button class="btn sm" id="ag-fold">Collapse all</button><button class="btn sm" id="ag-unfold">Expand all</button>
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
  $('#ag-fold').onclick = () => $$('[data-agday]', v).forEach((sec) => setDayCollapsed(sec.dataset.agday, true));
  $('#ag-unfold').onclick = () => $$('[data-agday]', v).forEach((sec) => setDayCollapsed(sec.dataset.agday, false));
}

/* ================================================================== */
/* Tasks view                                                          */
/* ================================================================== */
const typeOptions = (sel) => typesList().map((t) => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${t.icon} ${esc(t.name)}</option>`).join('');

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
      <div class="meta">${it.course ? `<span class="chip crs" style="--c:${c}">${codeLabel(it.course)}</span>` : ''}<span>${itemIcon(it)} ${esc(typeOf(it).name)}</span>
      ${subs.length ? `<span>☑ ${subDone}/${subs.length}</span>` : ''}${(it.attachments || []).length ? `<span>${ICON.clip} ${(it.attachments || []).length}</span>` : ''}
      ${it.notes ? `<span>${ICON.note}</span>` : ''}</div></div>
    <div class="due ${dueClass(it)}">${it.date ? relDay(it.date) : 'No date'}${it.start ? `<br>${itemTime(it)}` : ''}</div>
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
  const rows = data.items.filter((i) => i.task || i.exam || i.grade).map((it) => ({
    key: 'i:' + it.id, src: 'i', id: it.id, code: it.course, name: `${itemIcon(it)} ${it.title}`, date: it.date, time: it.start, end: it.end, kind: it.kind, type: it.type,
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

// Phones: grouped cards with a big tick, a one-line summary and filters in a bottom sheet.
const STATUS_SHORT = { 'not-started': 'To do', 'in-progress': 'Doing', done: 'Done' };
const STATUS_NEXT = { 'not-started': 'in-progress', 'in-progress': 'done', done: 'not-started' };
function setRowStatus(key, st, el) {
  const card = el?.closest('.tk');
  const finish = () => {
    updateRow(key, { status: st });
    commit();
    if (st === 'done') toast('Nice — marked done ✓');
  };
  // Let the card tick and slide away before the list re-sorts.
  // Only slide it away when it is about to leave the current list (To do → done, Done → not done).
  const leaving = (ui.taskFilter === 'open' && st === 'done') || (ui.taskFilter === 'done' && st !== 'done');
  if (card && leaving && !reducedMotionMQ.matches) { card.classList.add('ticking'); setTimeout(finish, 260); } else finish();
}
function openTaskFilters(v) {
  openModal(`${modalHead('Filter deadlines')}
    <div class="body">
      <label class="field">Course<select id="tf-course"><option value="">All courses</option>${Object.keys(SCHED.courses).map((c) => `<option value="${c}" ${c === ui.taskCourse ? 'selected' : ''}>${codeLabel(c)} · ${esc(COURSE_SHORT[c])}</option>`).join('')}</select></label>
      <label class="field">Type<select id="tf-kind"><option value="">All types</option>${typeOptions(ui.taskKind)}</select></label>
      <label class="switch-row"><input type="checkbox" id="tf-tt" ${ui.taskTimetable ? 'checked' : ''}><span class="sw-track"></span><span><b>Timetable exams</b><span class="muted small">Include exams and tests from the official timetable</span></span></label>
    </div>
    <footer><button class="btn left" id="tf-reset">Reset</button><button class="btn primary" id="tf-apply">Show results</button></footer>`);
  $('#tf-reset').onclick = () => { ui.taskCourse = ''; ui.taskKind = ''; ui.taskTimetable = true; closeModal(); renderTasks(v); };
  $('#tf-apply').onclick = () => {
    ui.taskCourse = $('#tf-course').value; ui.taskKind = $('#tf-kind').value; ui.taskTimetable = $('#tf-tt').checked;
    closeModal(); renderTasks(v);
  };
}
function renderTasksMobile(v, { all, rows, open, overdue, weekDue, doneCount, pct, today, weekEnd }) {
  const tomorrow = D.iso(D.add(D.parse(today), 1));
  const nextEnd = D.iso(D.add(D.parse(weekEnd), 7));
  const group = (r) => {
    if (!r.date) return ['nodate', 'No date'];
    if (r.date < today) return r.status === 'done' ? ['past', 'Earlier'] : ['overdue', 'Overdue'];
    if (r.date === today) return ['today', 'Today'];
    if (r.date === tomorrow) return ['tomorrow', 'Tomorrow'];
    if (r.date > today && r.date <= weekEnd) return ['week', 'Later this week'];
    if (r.date > today && r.date <= nextEnd) return ['next', 'Next week'];
    const d = D.parse(r.date);
    return [`m${r.date.slice(0, 7)}`, `${MON[d.getMonth()]} ${d.getFullYear()}`];
  };
  const list = ui.taskFilter === 'done' ? [...rows].reverse() : rows;
  const groups = new Map();
  for (const r of list) {
    const [k, label] = group(r);
    if (!groups.has(k)) groups.set(k, { label, rows: [] });
    groups.get(k).rows.push(r);
  }
  // Overdue first, undated last; finished items stay in their date group (struck through).
  const order = [...groups.keys()].sort((a, b) => (a === 'overdue' ? -1 : b === 'overdue' ? 1 : a === 'nodate' ? 1 : b === 'nodate' ? -1 : 0));
  const card = (r) => {
    const it = r.item, done = r.status === 'done';
    const over = !done && r.date && r.date < today;
    const subs = it?.subtasks || [];
    const when = r.date ? `${fmtDate(r.date)}${r.time ? ' · ' + fmtTime(r.time) : ''}` : 'No date';
    return `<div class="tk ${done ? 'is-done' : ''} ${over ? 'over' : ''}" data-open="${r.key}" style="--c:${r.code ? courseColor(r.code) : 'var(--PERSONAL)'}">
      <button type="button" class="tk-check" data-tkdone="${r.key}" role="checkbox" aria-checked="${done}" aria-label="${done ? 'Mark not done' : 'Mark done'}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 6.8"/></svg></button>
      <div class="tk-main">
        <div class="tk-title">${esc(r.name)}${r.kind === 'exam' || r.kind === 'test' ? ' ' + kindChip({ kind: r.kind === 'test' ? 'test' : 'exam' }) : ''}</div>
        <div class="tk-meta">${r.code ? `<span class="chip crs" style="--c:${courseColor(r.code)}">${codeLabel(r.code)}</span>` : ''}
          <span class="tk-due">${over ? '⚠ ' : ''}${when}</span>${r.date && !done && relDay(r.date) !== fmtDate(r.date) ? `<span class="tk-rel">${relDay(r.date)}</span>` : ''}
          ${subs.length ? `<span>☑ ${subs.filter((x) => x.done).length}/${subs.length}</span>` : ''}${(it?.attachments || []).length ? `<span>${ICON.clip}${it.attachments.length}</span>` : ''}
          ${r.weight !== '' && r.weight != null ? `<span class="tk-badge">${esc(r.weight)}%</span>` : ''}${r.grade ? `<span class="tk-badge grade">${esc(r.grade)}</span>` : ''}
          ${r.src === 's' ? '<span>timetable</span>' : ''}</div>
      </div>
      <button type="button" class="tk-st st-${r.status}" data-tkstatus="${r.key}|${r.status}" aria-label="Status: ${STATUS[r.status]} — tap to change">${STATUS_SHORT[r.status]}</button>
    </div>`;
  };
  const filtersOn = (ui.taskCourse ? 1 : 0) + (ui.taskKind ? 1 : 0) + (ui.taskTimetable ? 0 : 1);
  const chips = [
    ui.taskCourse && `<button class="tk-chip" data-tkclear="course">${codeLabel(ui.taskCourse)} ✕</button>`,
    ui.taskKind && `<button class="tk-chip" data-tkclear="kind">${esc(typesList().find((t) => t.id === ui.taskKind)?.name || ui.taskKind)} ✕</button>`,
    !ui.taskTimetable && '<button class="tk-chip" data-tkclear="tt">No timetable exams ✕</button>',
  ].filter(Boolean).join('');
  const searchOpen = ui.taskSearchOpen || !!ui.taskQuery;
  v.innerHTML = `<div class="tk-head">
      <h2>Deadlines</h2>
      <button class="btn icon tk-icon ${searchOpen ? 'on' : ''}" id="tk-search-btn" aria-label="Search" aria-expanded="${searchOpen}"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3l4.2 4.2"/></svg></button>
      <button class="btn tk-icon ${filtersOn ? 'on' : ''}" id="tk-filter-btn" aria-label="Filters"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M6 10h8M8.5 15h3"/></svg>${filtersOn ? `<b>${filtersOn}</b>` : ''}</button>
    </div>
    ${searchOpen ? `<input type="search" id="tk-q" class="tk-search" placeholder="Search deadlines…" value="${esc(ui.taskQuery)}">` : ''}
    <div class="seg tk-seg" role="group" aria-label="Status">${[['open', 'To do'], ['all', 'All'], ['done', 'Done']].map(([f, n]) => `<button data-tf="${f}" aria-pressed="${ui.taskFilter === f}">${n}</button>`).join('')}</div>
    ${chips ? `<div class="tk-chips">${chips}</div>` : ''}
    <div class="card tk-sum">
      <div><b>${open.length}</b><span>to do</span></div>
      <div class="${overdue ? 'warn' : ''}"><b>${overdue}</b><span>overdue</span></div>
      <div><b>${weekDue}</b><span>this week</span></div>
      <div><b>${pct}%</b><span>${doneCount}/${all.length} done</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
    </div>
    ${rows.length ? order.map((k) => {
      const g = groups.get(k);
      const head = `<span>${g.label}</span><span class="tk-n">${g.rows.length}</span>`;
      const inner = g.rows.map(card).join('');
      return `<section class="tk-group ${k === 'overdue' ? 'is-over' : ''}"><h3 class="tk-gh">${head}</h3>${inner}</section>`;
    }).join('') : `<div class="card empty">${all.length ? (ui.taskFilter === 'open' ? 'All caught up 🎉' : 'Nothing matches these filters.') : 'No deadlines yet — tap the button below to add one.'}</div>`}`;

  $$('[data-tf]', v).forEach((b) => (b.onclick = () => { ui.taskFilter = b.dataset.tf; renderTasks(v); }));
  $('#tk-filter-btn').onclick = () => openTaskFilters(v);
  $('#tk-search-btn').onclick = () => { ui.taskSearchOpen = !searchOpen; if (searchOpen) ui.taskQuery = ''; renderTasks(v); $('#tk-q')?.focus(); };
  $$('[data-tkclear]', v).forEach((b) => (b.onclick = () => {
    const f = b.dataset.tkclear;
    if (f === 'course') ui.taskCourse = ''; else if (f === 'kind') ui.taskKind = ''; else ui.taskTimetable = true;
    renderTasks(v);
  }));
  const qi = $('#tk-q');
  qi?.addEventListener('input', debounce(() => { ui.taskQuery = qi.value; renderTasks(v); const n = $('#tk-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
}

function renderTasks(v) {
  const today = D.today();
  const weekEnd = D.iso(D.add(D.sow(new Date()), 6));
  const q = ui.taskQuery.toLowerCase();
  const all = deadlineRows().filter((r) => (!ui.taskCourse || r.code === ui.taskCourse) && (!ui.taskKind || r.type === ui.taskKind || (ui.taskKind === 'exam' && r.kind === 'test')))
    .filter((r) => !q || `${r.name} ${r.code || ''} ${r.item?.notes || ''}`.toLowerCase().includes(q));
  let rows = all;
  if (ui.taskFilter === 'open') rows = rows.filter((r) => r.status !== 'done');
  if (ui.taskFilter === 'done') rows = rows.filter((r) => r.status === 'done');
  const open = all.filter((r) => r.status !== 'done');
  const overdue = open.filter((r) => r.date && r.date < today).length;
  const weekDue = open.filter((r) => r.date >= today && r.date <= weekEnd).length;
  const doneCount = all.length - open.length;
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0;
  if (narrowMQ.matches) return renderTasksMobile(v, { all, rows, open, overdue, weekDue, doneCount, pct, today, weekEnd });

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
      <td><div class="nm">${r.src === 'i' && it.task ? doneBox(itemToEntry(it, it.date)) : ''}<button class="link" data-open="${r.key}">${esc(r.name)}</button>
        ${r.kind === 'exam' || r.kind === 'test' ? kindChip({ kind: r.kind === 'test' ? 'test' : 'exam' }) : ''}
        ${r.src === 's' ? '<span class="muted small">timetable</span>' : ''}
        ${subs.length ? `<span class="muted small">☑ ${subs.filter((x) => x.done).length}/${subs.length}</span>` : ''}
        ${(it?.attachments || []).length ? `<span class="muted small">${ICON.clip}${it.attachments.length}</span>` : ''}
        ${it?.notes ? `<span class="muted small" title="${esc(it.notes.slice(0, 300))}">${ICON.note}</span>` : ''}</div></td>
      <td class="dt ${over ? 'over' : ''}">${r.date ? `${MON[D.parse(r.date).getMonth()]} ${D.parse(r.date).getDate()}, ${D.parse(r.date).getFullYear()}${r.time ? ' ' + (r.end && r.end > r.time ? fmtRange(r.time, r.end) : fmtTime(r.time)).toUpperCase() : ''}` : 'No date'}
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
      <select id="tk-kind" aria-label="Type"><option value="">All types</option>${typeOptions(ui.taskKind)}</select>
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
    const it = { id: uid('t'), type: 'assignment', task: true, exam: false, kind: 'assignment', title: name, course: $('#qa-course').value || null,
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
  document.body.classList.toggle('note-editing', !!(active && narrowMQ.matches));
  if (narrowMQ.matches) return renderNotesMobile(v, { list, isSession, active });

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
  if (active) bindNoteEditor(active);
}
function bindNoteEditor(active) {
  {
    const persist = debounce(() => { commit({ rerender: false }); const el = $('#ne-saved'); if (el) el.textContent = 'Saved'; }, 400);
    const dirty = () => {
      Object.assign(active, { title: $('#ne-title').value, body: $('#ne-body').value, course: $('#ne-course').value || null, pinned: $('#ne-pin').checked, updatedAt: Date.now() });
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
    $('#ne-pin').addEventListener('change', () => $('#ne-pin').closest('.nm-pin')?.classList.toggle('on', $('#ne-pin').checked));
    $('#ne-del').onclick = () => {
      if (!confirm('Delete this note?')) return;
      remove('notes', active.id);
      ui.noteActive = null;
      commit();
    };
  }
}
// "5 min ago", "Yesterday", "Oct 3"
function agoText(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24 && new Date(ts).getDate() === new Date().getDate()) return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return relDay(D.iso(new Date(ts)));
}
// Phones: a list of note cards, and a full-screen editor with a back button.
function renderNotesMobile(v, { list, isSession, active }) {
  if (active) {
    v.innerHTML = `<div class="nm-edit" style="--c:${active.course ? courseColor(active.course) : 'var(--accent)'}">
      <div class="nm-bar">
        <button class="btn ghost nm-back" id="nm-back" aria-label="Back to notes"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg>Notes</button>
        <span class="muted small" id="ne-saved">Saved</span>
        <label class="btn icon nm-pin ${active.pinned ? 'on' : ''}" title="Pin to top"><input type="checkbox" id="ne-pin" ${active.pinned ? 'checked' : ''} hidden>📌</label>
        <button class="btn icon danger" id="ne-del" aria-label="Delete note">${ICON.trash}</button>
      </div>
      <input class="nm-title" id="ne-title" value="${esc(active.title)}" placeholder="Title" aria-label="Title">
      <select id="ne-course" class="nm-course" aria-label="Course">${courseOptions(active.course)}</select>
      <textarea id="ne-body" class="nm-body" placeholder="Write anything — lecture notes, questions for the instructor, study plan…">${esc(active.body)}</textarea>
    </div>`;
    $('#nm-back').onclick = () => { ui.noteActive = null; ui.anim = 'nav-prev'; render(); };
    bindNoteEditor(active);
    return;
  }
  const searchOpen = ui.noteSearchOpen || !!ui.noteQuery;
  const card = (n) => `<button type="button" class="nm-card" data-note="${esc(n.id)}" data-session="${n.session ? 1 : ''}" style="--c:${n.course ? courseColor(n.course) : 'var(--line)'}">
      <span class="nm-ct">${n.pinned ? '<span class="nm-pinned">📌</span>' : ''}${esc(n.title || 'Untitled')}</span>
      <span class="nm-cp">${esc((n.body || '').slice(0, 160)) || '<i>Empty</i>'}</span>
      <span class="nm-cm">${n.course ? `<span class="chip crs" style="--c:${courseColor(n.course)}">${codeLabel(n.course)}</span>` : ''}<span>${agoText(n.updatedAt || n.createdAt)}</span></span>
    </button>`;
  const pinned = list.filter((n) => n.pinned), rest = list.filter((n) => !n.pinned);
  v.innerHTML = `<div class="tk-head">
      <h2>Notes</h2>
      <button class="btn icon tk-icon ${searchOpen ? 'on' : ''}" id="nm-search-btn" aria-label="Search" aria-expanded="${searchOpen}"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5"/><path d="M12.3 12.3l4.2 4.2"/></svg></button>
      ${isSession ? '' : `<button class="btn primary tk-icon" id="nt-new" aria-label="New note"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg></button>`}
    </div>
    ${searchOpen ? `<input type="search" id="nt-q" class="tk-search" placeholder="Search notes…" value="${esc(ui.noteQuery)}">` : ''}
    <div class="seg tk-seg nm-seg" role="group"><button data-nm="notes" aria-pressed="${!isSession}">My notes</button><button data-nm="session" aria-pressed="${isSession}">Class notes</button></div>
    <div class="nm-courses" role="group" aria-label="Course">
      <button class="tk-chip ${ui.noteCourse ? '' : 'on'}" data-ncourse="">All</button>
      ${Object.keys(SCHED.courses).map((c) => `<button class="tk-chip ${c === ui.noteCourse ? 'on' : ''}" data-ncourse="${c}" style="--c:${courseColor(c)}">${codeLabel(c)}</button>`).join('')}
    </div>
    ${list.length ? `${pinned.length ? `<h3 class="tk-gh">Pinned <span class="tk-n">${pinned.length}</span></h3><div class="nm-list">${pinned.map(card).join('')}</div>` : ''}
      ${rest.length ? `${pinned.length ? `<h3 class="tk-gh">Notes <span class="tk-n">${rest.length}</span></h3>` : ''}<div class="nm-list">${rest.map(card).join('')}</div>` : ''}`
      : `<div class="card empty nm-empty">${isSession ? 'Notes you write on a class (tap any class in the timetable) show up here.' : ui.noteQuery || ui.noteCourse ? 'No notes match.' : `No notes yet.<br><button class="btn primary" id="nt-new2">${ICON.plus}<span>Write your first note</span></button>`}</div>`}`;
  $$('[data-nm]', v).forEach((b) => (b.onclick = () => { ui.noteMode = b.dataset.nm; ui.noteActive = null; renderNotes(v); }));
  $$('[data-ncourse]', v).forEach((b) => (b.onclick = () => { ui.noteCourse = b.dataset.ncourse; renderNotes(v); }));
  $('#nm-search-btn').onclick = () => { ui.noteSearchOpen = !searchOpen; if (searchOpen) ui.noteQuery = ''; renderNotes(v); $('#nt-q')?.focus(); };
  const qi = $('#nt-q');
  qi?.addEventListener('input', debounce(() => { ui.noteQuery = qi.value; renderNotes(v); const n = $('#nt-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250));
  for (const id of ['#nt-new', '#nt-new2']) { const b = $(id, v); if (b) b.onclick = () => newNote(ui.noteCourse); }
  $$('.nm-card', v).forEach((el) => (el.onclick = () => {
    if (el.dataset.session) return openSession(el.dataset.note);
    ui.noteActive = el.dataset.note;
    ui.anim = 'nav-next';
    render();
    scrollTo(0, 0);
  }));
  $('.nm-courses .on', v)?.scrollIntoView({ inline: 'center', block: 'nearest' });
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
/* ---- Course completion gates LEVEL UP! ---- */
const doneKey = (code) => `${currentLevel()}:${code}`;
function courseStatus(code) {
  const manual = (data.settings.completedCourses || []).includes(doneKey(code));
  const ses = SCHED.sessions.filter((s) => s.code === code && !isClosure(s));
  const last = ses[ses.length - 1];
  const today = D.today();
  const ended = !!last && (last.date < today || (last.date === today && D.mins(last.end || '23:59') <= D.nowMin()));
  return { done: manual || ended, manual, ended, last };
}
function levelProgress() {
  const codes = Object.keys(SCHED.courses || {});
  return { total: codes.length, remaining: codes.filter((c) => !courseStatus(c).done) };
}
function setCourseDone(code, on) {
  const set = new Set(data.settings.completedCourses || []);
  if (on) set.add(doneKey(code)); else set.delete(doneKey(code));
  const before = levelProgress().remaining.length;
  data.settings.completedCourses = [...set];
  data.settingsUpdatedAt = Date.now();
  commit();
  if (before && !levelProgress().remaining.length && currentLevel() < MAX_LEVEL) {
    celebrate();
    toast(`All Level ${currentLevel()} courses done — LEVEL UP! is unlocked ★`);
  }
}

function renderCourses(v) {
  const today = D.today(), now = D.nowMin();
  const cards = Object.entries(SCHED.courses).map(([code, name]) => {
    const ses = SCHED.sessions.filter((s) => s.code === code && relevance(s) !== 'other');
    const past = ses.filter((s) => s.date < today || (s.date === today && D.mins(s.end) <= now));
    const attended = past.filter((s) => getMeta(s.id).attended).length;
    const upcoming = ses.filter((s) => !past.includes(s));
    const next = upcoming[0];
    const nextExam = upcoming.find((s) => s.kind === 'exam' || s.kind === 'test') ||
      data.items.filter((i) => i.exam && i.course === code && i.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
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
    const cs = courseStatus(code);
    return `<div class="card course ${cs.done ? 'is-done' : ''}" style="--c:${courseColor(code)}">
      <div class="code">${codeLabel(code)}${cs.done ? ` <span class="done-badge">✓ ${cs.ended && !cs.manual ? 'Finished' : 'Completed'}</span>` : ''}</div><h3>${esc(name)}</h3>
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
        ${cs.ended ? '' : `<button class="btn sm ${cs.manual ? '' : 'ghost-ok'}" data-course-done="${esc(code)}" data-on="${cs.manual ? 0 : 1}">${cs.manual ? 'Mark not complete' : '✓ Mark course complete'}</button>`}
      </div>
    </div>`;
  }).join('');
  const lp = levelProgress();
  v.innerHTML = `<div class="toolbar"><h2>Courses</h2><span class="chip ${lp.remaining.length ? '' : 'mine'}">${lp.total - lp.remaining.length}/${lp.total} complete</span>
    <button class="btn sm" id="cr-setup">${ICON.plus} Add courses & class periods</button><span class="muted small">Counts reflect your groups (Pre-clinic ${esc(data.settings.preGroup)}, Rad lab ${esc(data.settings.radGroup)}). Tick “Attended” on a class to track attendance.</span></div>
    <div class="course-grid">${cards}</div>`;
  $$('[data-course-tasks]', v).forEach((b) => (b.onclick = () => { ui.taskCourse = b.dataset.courseTasks; ui.taskFilter = 'all'; setView('tasks'); }));
  $$('[data-course-notes]', v).forEach((b) => (b.onclick = () => { ui.noteCourse = b.dataset.courseNotes; ui.noteActive = null; setView('notes'); }));
  $$('[data-course-agenda]', v).forEach((b) => (b.onclick = () => { ui.agendaCourse = b.dataset.courseAgenda; setView('agenda'); }));
  $$('[data-course-new]', v).forEach((b) => (b.onclick = () => openItemEditor({ course: b.dataset.courseNew, type: 'assignment' })));
  $('#cr-setup').onclick = () => openLevelWizard(currentLevel(), { step: 1 });
  $$('[data-course-done]', v).forEach((b) => (b.onclick = () => setCourseDone(b.dataset.courseDone, b.dataset.on === '1')));
}

/* ================================================================== */
/* Modals                                                              */
/* ================================================================== */
function openModal(html, { wide = false, cls = '', color = '', onClose } = {}) {
  closeModal({ instant: true });
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''} ${cls}" role="dialog" aria-modal="true" style="${color ? `--c:${color}` : ''}">${html}</div></div>`;
  const back = root.firstElementChild;
  back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
  $$('[data-close]', root).forEach((b) => (b.onclick = () => closeModal()));
  closeModal.onClose = onClose;
  closeModal.lastFocus = document.activeElement;
  const sheet = root.querySelector('.modal');
  swipeToClose($('header', sheet) || sheet, sheet, () => closeModal({ instant: true }));
  setTimeout(() => (root.querySelector('[autofocus]') || root.querySelector('.modal button, .modal input'))?.focus(), 20);
  return root.querySelector('.modal');
}
const reducedMotionMQ = matchMedia('(prefers-reduced-motion: reduce)');
// Phones: drag a bottom sheet down by its header (or a drawer sideways) to dismiss it.
function swipeToClose(handle, sheet, onClose, axis = 'y') {
  if (!handle) return;
  let start = null, delta = 0;
  handle.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !narrowMQ.matches || e.target.closest('input, select, textarea, button:not(.sheet-grip)')) return;
    start = axis === 'y' ? e.clientY : e.clientX;
    delta = 0;
    sheet.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (start === null) return;
    delta = Math.max(0, (axis === 'y' ? e.clientY : e.clientX) - start);
    if (delta > 4) e.preventDefault();
    sheet.style.transform = axis === 'y' ? `translateY(${delta}px)` : `translateX(${delta}px)`;
  });
  const end = () => {
    if (start === null) return;
    start = null;
    sheet.style.transition = 'transform .22s var(--ease)';
    if (delta > 90) {
      sheet.style.transform = axis === 'y' ? 'translateY(100%)' : 'translateX(100%)';
      setTimeout(onClose, 200);
    } else sheet.style.transform = '';
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// Phones: a flyover menu with everything that doesn't fit in the header.
function openMenu() {
  if ($('.drawer-backdrop')) return;
  const t = SCHED.term;
  const btn = $('#levelup-btn');
  const el = document.createElement('div');
  el.className = 'drawer-backdrop';
  el.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true" aria-label="Menu">
    <header class="dr-head"><div><b>Pookie&rsquo;s DH</b><div class="muted small">${esc($('#term-sub').textContent)}</div></div>
      <button class="icon-btn dr-close" aria-label="Close menu">✕</button></header>
    <div class="dr-prog">${$('#term-progress').innerHTML}</div>
    <div class="dr-sec"><div class="dr-lbl">Level</div><div class="levels dr-levels">${$('#levels').innerHTML}</div></div>
    ${t.level < MAX_LEVEL ? `<button class="${btn.className} dr-levelup" data-action="level-up"><span class="lu-ico">${$('#levelup-ico').textContent}</span><b>LEVEL UP!</b><span class="lu-count">${$('#levelup-count').textContent}</span></button>` : ''}
    <nav class="dr-list">
      <button data-action="new-item"><span class="dr-ico">＋</span>New calendar entry</button>
      <button data-action="import"><span class="dr-ico">⤓</span>Import</button>
      <button data-action="print"><span class="dr-ico">⎙</span>Print</button>
      <button data-action="settings"><span class="dr-ico">⚙</span>Settings</button>
      <button data-action="types"><span class="dr-ico">🏷</span>Entry types</button>
    </nav>
    <div class="dr-foot"><span class="${$('#sync-status').className}">${esc($('#sync-status').textContent)}</span>
      <button class="btn sm" data-action="logout">Sign out</button></div>
  </aside>`;
  document.body.appendChild(el);
  const menuBtn = $('.menu-btn');
  menuBtn?.setAttribute('aria-expanded', 'true');
  const drawer = $('.drawer', el);
  const close = () => {
    if (!el.isConnected) return;
    menuBtn?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey, true);
    if (reducedMotionMQ.matches) return el.remove();
    el.classList.add('closing');
    setTimeout(() => el.remove(), 220);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('.dr-close')) return close();
    const a = e.target.closest('[data-action],[data-level]');
    if (!a) return;
    if (a.dataset.action === 'types') { close(); return openTypesManager(); }
    close(); // the document click handler runs the action itself
  });
  swipeToClose(drawer, drawer, () => { el.remove(); menuBtn?.setAttribute('aria-expanded', 'false'); document.removeEventListener('keydown', onKey, true); }, 'x');
  setTimeout(() => $('.dr-close', el).focus(), 30);
}
function closeModal({ instant = false } = {}) {
  const root = $('#modal-root');
  if (!root.innerHTML) return;
  // Leave a non-interactive copy behind to fade out; the real modal is gone immediately.
  const back = root.firstElementChild;
  if (!instant && back && !reducedMotionMQ.matches) {
    back.classList.add('closing');
    back.setAttribute('aria-hidden', 'true');
    document.body.appendChild(back);
    setTimeout(() => back.remove(), 170);
  }
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
        ${hasCarpool(s) ? `<label class="check"><input type="checkbox" data-m="carpool" ${m.carpool ? 'checked' : ''}> 🚗 ${esc(carpoolCfg().onText)} <span class="muted small">(off: ${esc(carpoolCfg().offText)})</span></label>` : ''}
      </div>
      <label class="field">Class notes
        <textarea id="ses-note" placeholder="Notes for this class — what was covered, homework mentioned, questions…">${esc(m.note || '')}</textarea></label>
      ${related.length ? `<div><div class="section-title" style="margin-top:0">Due this day</div><div class="card">${related.map(taskRowHTML).join('')}</div></div>` : ''}
    </div>
    <footer>
      <span class="left muted small" id="ses-saved"></span>
      ${s.periodId ? `<button class="btn" id="ses-period">Edit class periods</button>` : ''}
      ${s.code ? `<button class="btn" id="ses-cnote">${ICON.note} Course notes</button>` : ''}
      <button class="btn" id="ses-add">${ICON.plus} Add assignment / due date</button>
      <button class="btn primary" data-close>Done</button>
    </footer>`, { color: courseColor(s.code), onClose: () => changed && render() });
  const persist = debounce(() => { commit({ rerender: false }); const el = $('#ses-saved'); if (el) el.textContent = 'Saved'; }, 400);
  $('#ses-note').addEventListener('input', (e) => { setMeta(id, { note: e.target.value }); changed = true; $('#ses-saved').textContent = 'Saving…'; persist(); });
  $$('[data-m]', modal).forEach((cb) => (cb.onchange = () => { setMeta(id, { [cb.dataset.m]: cb.checked }); commit({ rerender: false }); changed = true; }));
  $$('[data-toggle]', modal).forEach((cb) => (cb.onchange = () => { changed = true; toggleItem(cb.dataset.toggle, cb.checked); }));
  $('#ses-add').onclick = () => openItemEditor({ course: s.code || null, date: s.date, type: 'assignment' });
  if (s.periodId) $('#ses-period').onclick = () => openLevelWizard(s.level, { step: 2 });
  if (s.code) $('#ses-cnote').onclick = () => { closeModal(); ui.noteCourse = s.code; ui.noteActive = null; ui.noteMode = 'notes'; setView('notes'); };
}

// "11:59 pm" for a single due time, "1:00–3:00 pm" for a time frame.
const itemTime = (it) => (it.start ? (it.end && it.end > it.start ? fmtRange(it.start, it.end) : fmtTime(it.start)) : '');

function toggleItem(id, done) {
  const it = data.items.find((i) => i.id === id);
  if (!it) return;
  setStatus(it, done ? 'done' : 'not-started');
  upsert('items', it);
  commit();
  if (done) toast('Nice — marked done ✓');
}

/* ---- Item editor (assignments, due dates, events, exams, reminders) ---- */
// Ask how far an edit/delete of one occurrence of a repeating event should reach.
function chooseScope(title, { allowFollowing = true } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal-backdrop scope-backdrop';
    el.innerHTML = `<div class="modal scope" role="dialog" aria-modal="true"><div class="body">
      <h2 style="margin:0;font-size:16px">${esc(title)}</h2>
      <label class="check"><input type="radio" name="scope" value="one" checked> This event</label>
      ${allowFollowing ? '<label class="check"><input type="radio" name="scope" value="following"> This and following events</label>' : ''}
      <label class="check"><input type="radio" name="scope" value="all"> All events</label></div>
      <footer><button class="btn" data-sc="cancel">Cancel</button><button class="btn primary" data-sc="ok">OK</button></footer></div>`;
    document.body.appendChild(el);
    const done = (v) => { el.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    el.querySelector('[data-sc="cancel"]').onclick = () => done(null);
    el.querySelector('[data-sc="ok"]').onclick = () => done(el.querySelector('input[name=scope]:checked').value);
    el.addEventListener('mousedown', (e) => { if (e.target === el) done(null); });
    el.querySelector('[data-sc="ok"]').focus();
  });
}
const dayBefore = (iso) => D.iso(D.add(D.parse(iso), -1));
const shiftIso = (iso, n) => D.iso(D.add(D.parse(iso), n));
// Apply an edit made to one occurrence (`occ`) of repeating item `orig` (edited copy: `ed`, with ed.date = new date).
function applySeriesEdit(orig, ed, occ, scope) {
  if (scope === 'following' && occ === orig.date) scope = 'all';
  if (scope === 'all') {
    const delta = D.diffDays(occ, ed.date);
    ed.date = shiftIso(orig.date, delta);
    ed.exdates = (orig.exdates || []).map((d) => shiftIso(d, delta));
    if (ed.recur?.until && delta) ed.recur = { ...ed.recur, until: shiftIso(ed.recur.until, delta) };
    upsert('items', ed);
    return;
  }
  const head = structuredClone(orig);
  if (scope === 'one') head.exdates = [...new Set([...(orig.exdates || []), occ])];
  else head.recur = { ...orig.recur, until: dayBefore(occ) };
  upsert('items', head);
  const copy = { ...structuredClone(ed), id: uid('t'), createdAt: Date.now() };
  if (scope === 'one') { copy.recur = null; copy.exdates = []; }
  else copy.exdates = (orig.exdates || []).filter((d) => d > occ);
  upsert('items', copy);
}
function deleteItemFiles(it) {
  const used = new Set(data.items.filter((x) => x.id !== it.id).flatMap((x) => (x.attachments || []).map((f) => f.id)));
  for (const f of it.attachments || []) if (f.cloud && !used.has(f.id)) fetch(`/api/files?id=${encodeURIComponent(f.id)}`, { method: 'DELETE' }).catch(() => {});
}
async function deleteItem(it, occ) {
  if (isRecurring(it) && occ) {
    const scope = await chooseScope('Delete repeating event');
    if (!scope) return false;
    if (scope === 'one') { upsert('items', { ...it, exdates: [...new Set([...(it.exdates || []), occ])] }); return true; }
    if (scope === 'following' && occ !== it.date) { upsert('items', { ...it, recur: { ...it.recur, until: dayBefore(occ) } }); return true; }
  } else if (!confirm('Delete this item?')) return false;
  deleteItemFiles(it);
  remove('items', it.id);
  return true;
}
// Move/resize from the week grid.
async function moveItem(it, occ, date, start, end) {
  const ed = { ...structuredClone(it), date, start, end };
  if (isRecurring(it)) {
    const scope = await chooseScope('Move repeating event');
    if (!scope) return render();
    applySeriesEdit(it, ed, occ, scope);
  } else upsert('items', ed);
  commit();
}

const EVENT_COLORS = ['', '#1098ad', '#1971c2', '#6741d9', '#d6336c', '#e8590c', '#f59f00', '#2f9e44', '#495057'];
const MAX_LOCAL_FILE = 1_000_000, MAX_CLOUD_FILE = 2_500_000;
// Manage the user's entry types (overlay, so it can open on top of the editor).
function openTypesManager(onDone) {
  let types = structuredClone(typesList());
  const el = document.createElement('div');
  el.className = 'modal-backdrop scope-backdrop';
  const draw = () => {
    el.innerHTML = `<div class="modal wide types-mgr" role="dialog" aria-modal="true">
      <header><span class="bar"></span><div style="flex:1"><h2>Entry types</h2><div class="muted small">Your own list — each type is a name, icon and colour plus the settings new entries start with. Any entry can still change every setting.</div></div></header>
      <div class="body">
        <div class="tm-head"><span>Icon</span><span>Name</span><span>Colour</span><span title="New entries get a done checkbox and appear in Deadlines">Task</span><span title="Highlighted as an exam or test">Exam</span><span title="Prep / Attended / Reviewed boxes like a class">Class checks</span><span title="New entries get a start and end time">Time range</span><span></span></div>
        ${types.map((t, i) => `<div class="tm-row">
          <input type="text" class="icon-in" data-ti="${i}" data-tf="icon" value="${esc(t.icon)}" maxlength="4" aria-label="Icon">
          <input type="text" data-ti="${i}" data-tf="name" value="${esc(t.name)}" aria-label="Name">
          <input type="color" data-ti="${i}" data-tf="color" value="${esc(/^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#1098ad')}" aria-label="Colour">
          ${[['task', 'Task'], ['exam', 'Exam'], ['track', 'Class checks'], ['range', 'Time range']].map(([f, lbl]) => `<label class="tm-flag"><input type="checkbox" data-ti="${i}" data-tf="${f}" ${t[f] ? 'checked' : ''} aria-label="${lbl}"><span class="tm-fl">${lbl}</span></label>`).join('')}
          <button type="button" class="icon-btn" data-tdel="${i}" aria-label="Remove ${esc(t.name)}">✕</button></div>`).join('')}
        <div class="tm-acts"><button type="button" class="btn sm" data-tadd>${ICON.plus} Add type</button><button type="button" class="btn sm ghost" data-treset>Reset to the starter list</button></div>
      </div>
      <footer><button class="btn" data-tcancel>Cancel</button><button class="btn primary" data-tsave>Save types</button></footer></div>`;
  };
  draw();
  document.body.appendChild(el);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.ti === undefined) return;
    const row = types[+t.dataset.ti];
    row[t.dataset.tf] = t.type === 'checkbox' ? t.checked : t.value;
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tadd],[data-tdel],[data-treset],[data-tsave],[data-tcancel]');
    if (!t) return;
    if (t.dataset.tcancel !== undefined) return close();
    if (t.dataset.tadd !== undefined) { types.push({ id: uid('ty'), name: 'New type', icon: '⭐', color: PALETTE[types.length % PALETTE.length], range: true }); draw(); $$('[data-tf="name"]', el).at(-1).select(); return; }
    if (t.dataset.treset !== undefined) { if (confirm('Replace your types with the starter list? Entries keep their own settings.')) { types = structuredClone(DEFAULT_TYPES); draw(); } return; }
    if (t.dataset.tdel !== undefined) {
      const ty = types[+t.dataset.tdel];
      const used = data.items.filter((i) => i.type === ty.id).length;
      if (used && !confirm(`${used} entr${used === 1 ? 'y uses' : 'ies use'} “${ty.name}”. Remove the type anyway? Those entries keep all their settings.`)) return;
      types.splice(+t.dataset.tdel, 1);
      return draw();
    }
    if (t.dataset.tsave !== undefined) {
      types = types.filter((x) => x.name.trim()).map((x) => ({ ...x, name: x.name.trim(), icon: x.icon.trim() || '•' }));
      if (!types.length) return toast('Keep at least one type');
      data.settings.types = types;
      data.settingsUpdatedAt = Date.now();
      commit({ rerender: !$('#modal-root').innerHTML });
      close();
      toast('Types saved');
      onDone?.();
    }
  });
}

function openItemEditor(seed = {}, { occ = null } = {}) {
  const existing = seed.id && data.items.find((i) => i.id === seed.id);
  const seedType = typesList().find((t) => t.id === seed.type) || typesList().find((t) => t.id === 'assignment') || typesList()[0];
  const it = existing ? migrateItem(structuredClone(existing)) : migrateItem({
    id: uid('t'), type: seedType.id, task: seed.task ?? !!seedType.task, exam: seed.exam ?? !!seedType.exam, track: seed.track ?? !!seedType.track,
    title: seed.title || '', course: seed.course || null, date: seed.date || D.today(), start: seed.start || '', end: seed.end || '',
    mode: seed.mode || '', priority: 'normal', notes: '', subtasks: [], attachments: [], done: false, createdAt: Date.now(),
    location: '', color: '', icon: '', recur: null, exdates: [],
  });
  it.subtasks ||= [];
  it.attachments ||= [];
  const recurring = existing && isRecurring(existing);
  if (!recurring) occ = null;
  const shownDate = occ || it.date;
  const r = it.recur || { freq: 'none', interval: 1, byDay: [], until: '' };
  const flag = (id, on, label, hint) => `<label class="switch-row"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span class="sw-track"></span><span><b>${label}</b><span class="muted small">${hint}</span></span></label>`;
  const modal = openModal(`
    ${modalHead(existing ? 'Edit entry' : 'New calendar entry', recurring ? `🔁 ${esc(recurText(existing))}` : 'Everything is optional except the title — set it up however you like.')}
    <form class="body ed-body" id="it-form" autocomplete="off">
      <div class="ed-main">
      <div class="field"><span class="form-label">Type</span><div class="qc-cats type-chips" id="it-types"></div></div>
      <div class="title-row"><input type="text" id="it-icon" class="icon-in" maxlength="4" value="${esc(it.icon || '')}" placeholder="${esc(typeOf(it).icon)}" aria-label="Icon (emoji)" title="Icon — leave empty to use the type's">
        <input type="text" id="it-title" required value="${esc(it.title)}" placeholder="Title" aria-label="Title" autofocus></div>
      <section class="ed-sec"><h3>When</h3>
        <div class="grid-3">
          <label class="field">Date<input type="date" id="it-date" value="${esc(shownDate || '')}"></label>
          <label class="field" id="it-start-wrap"><span id="it-start-lbl">Start / due time</span><input type="time" id="it-start" value="${esc(it.start || '')}"></label>
          <label class="field" id="it-end-wrap">End<input type="time" id="it-end" value="${esc(it.end || '')}"></label>
        </div>
        <label class="check small"><input type="checkbox" id="it-allday" ${existing && !it.start ? 'checked' : ''}> All day</label>
        <div class="repeat-box" id="it-repeat-wrap">
          <label class="field">Repeat<select id="it-freq">
            <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekdays">Every weekday (Mon–Fri)</option>
            <option value="weekly">Weekly</option><option value="monthly">Monthly (same date)</option></select></label>
          <label class="field" id="it-int-wrap">Every<span class="int-row"><input type="number" id="it-int" min="1" max="12" value="${+r.interval || 1}"><span id="it-int-unit">week(s)</span></span></label>
          <div class="field" id="it-days-wrap"><span class="form-label">On</span><div class="day-toggles">${DAY3.map((d, i) => `<button type="button" class="day-tg" data-dow="${i}" aria-pressed="false" title="${DAY[i]}">${d[0]}</button>`).join('')}</div></div>
          <label class="field" id="it-until-wrap">Ends<input type="date" id="it-until" value="${esc(r.until || '')}" title="Leave empty to repeat with no end date"></label>
        </div>
      </section>
      <section class="ed-sec"><h3>How it behaves</h3>
        ${flag('it-task', it.task, 'Task', 'A tick-off box wherever it shows, and listed under Deadlines with status, grade and weight')}
        ${flag('it-exam', it.exam, 'Exam / test', 'Highlighted with an EXAM badge and counted as an exam for its course')}
        ${flag('it-track', it.track, 'Class checks', 'Prepared / Attended / Reviewed boxes, like a class')}
        <div class="grid-2">
          <label class="field">Where <span class="muted">(in person → 🚗 carpool tag)</span><select id="it-mode"><option value="">Not specified</option><option value="in-person">In person</option><option value="online">Online</option></select></label>
          <label class="field">Location / link<input type="text" id="it-loc" value="${esc(it.location || '')}" placeholder="Room 204, Zoom link…"></label>
        </div>
      </section>
      </div>
      <div class="ed-side">
      <div class="ed-look">
        <label class="field">Course<select id="it-course">${courseOptions(it.course)}</select></label>
        <div class="field"><span class="form-label">Colour</span><div class="swatches">${EVENT_COLORS.map((c) => `<button type="button" class="sw-btn ${c === (it.color || '') ? 'on' : ''}" data-color="${c}" style="--c:${c || 'var(--line)'}" aria-label="${c ? 'Colour ' + c : 'Use the type or course colour'}">${c ? '' : '↺'}</button>`).join('')}<input type="color" id="it-color-custom" value="${esc(/^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#1098ad')}" aria-label="Custom colour" title="Custom colour"></div></div>
      </div>
      <label class="field">Notes<textarea id="it-notes" placeholder="Instructions, links, page numbers…">${esc(it.notes || '')}</textarea></label>
      <div class="form-section"><div class="form-label">Checklist</div>
        <div class="subtasks" id="it-subs"></div>
        <button type="button" class="btn sm" id="it-sub-add" style="justify-self:start;margin-top:6px">${ICON.plus} Add step</button></div>
      <div class="form-section"><div class="form-label">Attachments</div>
        <div class="attach-list" id="it-files"></div>
        <label class="dropzone" id="it-drop">Drop files here or <u>browse</u><input type="file" id="it-file" multiple hidden></label>
        <div class="muted small">${sync.cloud ? 'Files up to 2.5 MB, saved to the cloud.' : 'Cloud sync is off: files up to 1 MB are kept on this device only.'}</div></div>
      <div class="grid-2" id="it-task-wrap">
        <label class="field">Status<select id="it-status">${Object.entries(STATUS).map(([k, n]) => `<option value="${k}" ${k === statusOf(it) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field">Priority<select id="it-prio"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
        <label class="field">Grade<input type="text" id="it-grade" value="${esc(it.grade || '')}" placeholder="e.g. 85% or 17/20"></label>
        <label class="field">Weight (% of course)<input type="text" id="it-weight" inputmode="decimal" value="${esc(it.weight ?? '')}" placeholder="e.g. 10"></label>
      </div>
      </div>
    </form>
    <footer>
      ${existing ? `<button class="btn danger left" id="it-del">${ICON.trash} Delete</button><button class="btn" id="it-dup">Duplicate</button>` : ''}
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="it-save">Save</button>
    </footer>`, { wide: true, cls: 'editor', color: it.course ? courseColor(it.course) : it.color || typeOf(it).color });

  $('#it-prio').value = it.priority || 'normal';
  $('#it-mode').value = it.mode || '';
  $('#it-freq').value = r.freq || 'none';
  let byDay = r.byDay?.length ? [...r.byDay] : [D.parse(shownDate || D.today()).getDay()];
  let color = it.color || '';
  let typeId = it.type;
  const curType = () => typesList().find((t) => t.id === typeId) || typeOf({ type: typeId });
  const tint = () => modal.style.setProperty('--c', $('#it-course').value ? courseColor($('#it-course').value) : color || curType().color);
  const drawTypes = () => {
    $('#it-types').innerHTML = typesList().map((t) => `<button type="button" class="qc-cat" data-etype="${esc(t.id)}" style="--c:${esc(t.color)}" aria-pressed="${t.id === typeId}">${t.icon} ${esc(t.name)}</button>`).join('')
      + `<button type="button" class="qc-cat add" id="it-types-manage">✎ Manage types</button>`;
    $$('[data-etype]', modal).forEach((b) => (b.onclick = () => {
      typeId = b.dataset.etype;
      const t = curType();
      // A new entry takes the type's starting behaviour; an existing one keeps its own settings.
      if (!existing) {
        $('#it-task').checked = !!t.task; $('#it-exam').checked = !!t.exam; $('#it-track').checked = !!t.track;
        if (!t.range) $('#it-end').value = '';
      }
      $('#it-icon').placeholder = t.icon;
      drawTypes(); tint(); sync_();
    }));
    $('#it-types-manage').onclick = () => openTypesManager(() => { drawTypes(); tint(); });
  };
  const sync_ = () => {
    const allDay = $('#it-allday').checked;
    const task = $('#it-task').checked;
    const freq = $('#it-freq').value;
    $('#it-start-wrap').classList.toggle('hidden', allDay);
    $('#it-end-wrap').classList.toggle('hidden', allDay);
    $('#it-start-lbl').textContent = task && !$('#it-end').value ? 'Due time (optional)' : 'Start (optional)';
    $('#it-int-wrap').classList.toggle('hidden', !['daily', 'weekly', 'monthly'].includes(freq));
    $('#it-int-unit').textContent = { daily: 'day(s)', weekly: 'week(s)', monthly: 'month(s)' }[freq] || '';
    $('#it-days-wrap').classList.toggle('hidden', freq !== 'weekly');
    $('#it-until-wrap').classList.toggle('hidden', freq === 'none');
    $('#it-task-wrap').classList.toggle('hidden', !task && !$('#it-exam').checked);
    $$('.day-tg', modal).forEach((b) => b.setAttribute('aria-pressed', String(byDay.includes(+b.dataset.dow))));
  };
  drawTypes();
  ['#it-allday', '#it-freq', '#it-task', '#it-exam', '#it-track'].forEach((sel) => ($(sel).onchange = sync_));
  $('#it-end').oninput = sync_;
  $$('.day-tg', modal).forEach((b) => (b.onclick = () => {
    const d = +b.dataset.dow;
    byDay = byDay.includes(d) ? (byDay.length > 1 ? byDay.filter((x) => x !== d) : byDay) : [...byDay, d];
    sync_();
  }));
  const pickColor = (c, btn) => {
    color = c;
    $$('[data-color]', modal).forEach((x) => x.classList.toggle('on', x === btn));
    tint();
  };
  $$('[data-color]', modal).forEach((b) => (b.onclick = () => pickColor(b.dataset.color, b)));
  $('#it-color-custom').oninput = (e) => pickColor(e.target.value, null);
  $('#it-course').onchange = tint;
  sync_();

  const drawSubs = () => {
    $('#it-subs').innerHTML = it.subtasks.map((x, i) => `<div class="subtask">
      <input type="checkbox" data-si="${i}" ${x.done ? 'checked' : ''} aria-label="Done">
      <input type="text" data-st="${i}" value="${esc(x.text)}" placeholder="Step">
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
    $$('[data-fd]', modal).forEach((b) => (b.onclick = () => { it.attachments.splice(+b.dataset.fd, 1); drawFiles(); }));
  };
  drawFiles();
  const addFiles = async (files) => {
    for (const file of files) {
      const limit = sync.cloud ? MAX_CLOUD_FILE : MAX_LOCAL_FILE;
      if (file.size > limit) { toast(`${file.name} is too large (max ${(limit / 1e6).toFixed(1)} MB)`); continue; }
      const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
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

  // Read the form into a copy of the item; returns null (and says why) if something is off.
  const collect = () => {
    const ed = structuredClone(it);
    ed.title = $('#it-title').value.trim();
    if (!ed.title) { $('#it-title').focus(); toast('Add a title'); return null; }
    ed.type = typeId;
    ed.icon = $('#it-icon').value.trim();
    ed.course = $('#it-course').value || null;
    ed.color = color;
    ed.priority = $('#it-prio').value;
    ed.date = $('#it-date').value || '';
    const allDay = $('#it-allday').checked;
    ed.start = allDay ? '' : $('#it-start').value || '';
    ed.end = allDay || !ed.start ? '' : $('#it-end').value || '';
    if (ed.end && ed.end <= ed.start) { $('#it-end').focus(); toast('The end time must be after the start time'); return null; }
    ed.task = $('#it-task').checked;
    ed.exam = $('#it-exam').checked;
    ed.track = $('#it-track').checked;
    ed.kind = deriveKind(ed);
    ed.mode = $('#it-mode').value;
    ed.location = $('#it-loc').value.trim();
    const freq = $('#it-freq').value;
    if (freq !== 'none' && !ed.date) { $('#it-date').focus(); toast('A repeating entry needs a start date'); return null; }
    const until = $('#it-until').value;
    if (freq !== 'none' && until && until < ed.date) { $('#it-until').focus(); toast('The end date is before the first date'); return null; }
    ed.recur = freq === 'none' ? null : { freq, interval: clamp(+$('#it-int').value || 1, 1, 52), byDay: freq === 'weekly' ? byDay.slice().sort() : [], until };
    if (!ed.recur) ed.exdates = [];
    ed.notes = $('#it-notes').value;
    ed.subtasks = ed.subtasks.filter((x) => x.text.trim());
    setStatus(ed, $('#it-status').value);
    ed.grade = $('#it-grade').value.trim();
    ed.weight = $('#it-weight').value.trim();
    return ed;
  };
  const save = async () => {
    const ed = collect();
    if (!ed) return;
    if (recurring && occ) {
      const scope = await chooseScope('Edit repeating entry');
      if (!scope) return;
      applySeriesEdit(existing, ed, occ, scope);
    } else upsert('items', ed);
    // Files removed in the editor are deleted once nothing else uses them.
    if (existing) deleteItemFiles({ ...existing, attachments: (existing.attachments || []).filter((f) => !ed.attachments.some((x) => x.id === f.id)) });
    closeModal();
    commit();
    toast(existing ? 'Saved' : `${itemIcon(ed)} ${typeOf(ed).name} added`);
  };
  $('#it-save').onclick = save;
  $('#it-form').onsubmit = (e) => { e.preventDefault(); save(); };
  if (existing) {
    $('#it-del').onclick = async () => {
      if (!(await deleteItem(existing, occ))) return;
      closeModal();
      commit();
      toast('Deleted');
    };
    $('#it-dup').onclick = () => {
      const ed = collect();
      if (!ed) return;
      const copy = { ...ed, id: uid('t'), title: ed.title + ' (copy)', createdAt: Date.now(), exdates: [] };
      upsert('items', copy);
      commit({ rerender: true });
      openItemEditor(copy);
      toast('Duplicated');
    };
  }
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
      <div class="section-title" style="margin:6px 0 0">🚗 Carpool label (in-person classes)</div>
      <div class="cp-settings">
        <label class="field">When on<span class="cp-set"><input type="color" id="st-cp-oncolor" value="${esc(carpoolCfg().onColor)}" aria-label="Colour when on"><input type="text" id="st-cp-ontext" value="${esc(carpoolCfg().onText)}" maxlength="24"></span></label>
        <label class="field">When off<span class="cp-set"><input type="color" id="st-cp-offcolor" value="${esc(carpoolCfg().offColor)}" aria-label="Colour when off"><input type="text" id="st-cp-offtext" value="${esc(carpoolCfg().offText)}" maxlength="24"></span></label>
      </div>
      <div class="section-title" style="margin:6px 0 0">Entry types</div>
      <div class="type-preview">${typesList().map((t) => `<span class="qc-cat" style="--c:${esc(t.color)}">${t.icon} ${esc(t.name)}</span>`).join('')}<button type="button" class="btn sm" id="st-types">✎ Manage types</button></div>
      <label class="check small"><input type="checkbox" id="st-fun" ${st.fun !== false ? 'checked' : ''}> Hearts & stars burst out of some clicks ♥★</label>
      <div class="section-title" style="margin:6px 0 0">Levels</div>
      <div class="card level-list">${[...Array(MAX_LEVEL)].map((_, i) => {
        const n = i + 1, ok = levelAvailable(n), L = n === 1 ? BASE_L1.term : data.levels[n];
        return `<div class="level-row ${n === currentLevel() ? 'on' : ''}"><b>Level ${n}</b>
          <span class="muted small">${ok ? `${fmtDate(L.start, { year: true })} – ${fmtDate(L.end, { year: true })}${n === 1 ? ' · official timetable' : ` · ${(L.courses || []).length} courses`}` : 'Unlocks with LEVEL UP!'}</span>
          ${ok && n !== currentLevel() ? `<button class="btn sm" data-level="${n}">View</button>` : ''}${ok && n > 1 ? `<button class="btn sm" data-edit-level="${n}">Edit setup</button>` : ''}${n === 1 ? `<button class="btn sm" data-edit-level="1">${data.levels[1] ? 'Edit extra courses & periods' : 'Add courses & periods'}</button>` : ''}</div>`;
      }).join('')}</div>
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
  const saveCarpool = () => {
    data.settings.carpool = { onColor: $('#st-cp-oncolor').value, offColor: $('#st-cp-offcolor').value,
      onText: $('#st-cp-ontext').value.trim() || DEFAULT_CARPOOL.onText, offText: $('#st-cp-offtext').value.trim() || DEFAULT_CARPOOL.offText };
    data.settingsUpdatedAt = Date.now();
    commit();
  };
  ['#st-cp-oncolor', '#st-cp-offcolor', '#st-cp-ontext', '#st-cp-offtext'].forEach((sel) => ($(sel).onchange = saveCarpool));
  $('#st-types').onclick = () => openTypesManager(() => openSettings());
  $('#st-fun').onchange = (e) => { data.settings.fun = e.target.checked; data.settingsUpdatedAt = Date.now(); commit({ rerender: false }); if (e.target.checked) burst(innerWidth / 2, innerHeight / 2); };
  $$('[data-edit-level]', modal).forEach((b) => (b.onclick = () => openLevelWizard(+b.dataset.editLevel)));
  $$('[data-level]', modal).forEach((b) => b.addEventListener('click', () => closeModal()));
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
// Duplicate detection for imports: same day plus a matching title (ignoring "Assignment:", numbering,
// "- 10%" and punctuation), or a test/exam on a day the timetable already has one for that course.
const normTitle = (t) => String(t || '').toLowerCase()
  .replace(/^(assignment|knowledge check|quiz|discussion)\s*[:\-–]\s*/, '')
  .replace(/^\d+(\.\d+)*[a-z]?[.)]?\s+/, '').replace(/-?\s*\d+\s*%/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an|and|of|for|drop ?box|dropbox|directions)\b/g, ' ').replace(/\s+/g, ' ').trim();
function titlesMatch(a, b) {
  const x = normTitle(a), y = normTitle(b);
  if (!x || !y) return false;
  if (x === y || (Math.min(x.length, y.length) >= 6 && (x.includes(y) || y.includes(x)))) return true;
  const wa = new Set(x.split(' ')), wb = new Set(y.split(' '));
  const common = [...wa].filter((w) => wb.has(w)).length;
  return common / Math.min(wa.size, wb.size) >= 0.75 && (common >= 2 || Math.min(wa.size, wb.size) === 1);
}
const isTestLike = (r) => r.kind === 'exam' || /\b(test|exam|midterm|final|quiz)\b/i.test(r.title);
function findDuplicate(r) {
  const it = data.items.find((i) => !data.deleted[i.id] && i.date === r.date && (!r.course || !i.course || i.course === r.course) && titlesMatch(i.title, r.title));
  if (it) return it.title;
  if (isTestLike(r)) {
    const s = SCHED.sessions.find((x) => x.date === r.date && (x.kind === 'exam' || x.kind === 'test') && (!r.course || x.code === r.course));
    if (s) return `${s.title} (timetable ${s.kind})`;
  }
  return '';
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
        rows = (Array.isArray(j) ? j : j.events || []).map((r) => ({ title: r.title || r.name, date: r.date, start: r.start || r.time || '', end: r.end || '', kind: typesList().some((t) => t.id === (r.type || r.kind)) ? r.type || r.kind : guessKind(r.title || ''), course: guessCourse(r.course || r.title), notes: r.notes || r.description || '' }))
          .filter((r) => r.title && /^\d{4}-\d{2}-\d{2}$/.test(r.date));
      } else if (/BEGIN:VCALENDAR/.test(text)) rows = parseICS(text);
      else rows = parseCSV(text);
    } catch (e) {
      $('#im-preview').innerHTML = `<div class="note-hint" style="color:var(--danger)">${esc(e.message)}</div>`;
      return;
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    // Flag rows already in the calendar, and repeats inside the file itself; they start unticked.
    rows.forEach((r, i) => {
      r.dup = findDuplicate(r) || (rows.slice(0, i).some((o) => o.date === r.date && (o.course || '') === (r.course || '') && titlesMatch(o.title, r.title)) ? 'listed twice in this file' : '');
    });
    const dups = rows.filter((r) => r.dup).length;
    $('#im-preview').innerHTML = rows.length ? `<div class="toolbar" style="margin:0"><b>${rows.length} found</b>${dups ? `<span class="muted small">${dups} already in your calendar (unticked)</span>` : ''}<span class="spacer"></span><label class="check small"><input type="checkbox" id="im-all" checked> Select all</label></div>
      <div class="preview-list">${rows.map((r, i) => `<label class="${r.dup ? 'is-dup' : ''}"><input type="checkbox" data-ri="${i}" ${r.dup ? '' : 'checked'}>
        <span style="min-width:96px" class="muted">${fmtDate(r.date)}${r.start ? ' ' + fmtTime(r.start) : ''}</span>
        <select data-rk="${i}" style="width:auto;min-height:26px;padding:2px 6px">${typeOptions(r.kind)}</select>
        ${r.course ? `<span class="chip crs" style="--c:${courseColor(r.course)}">${codeLabel(r.course)}</span>` : ''}<span>${esc(r.title)}</span>${r.dup ? `<span class="dup-tag" title="${esc(r.dup)}">${r.dup === 'listed twice in this file' ? 'Listed twice in this file' : `Duplicate of “${esc(r.dup)}”`}</span>` : ''}</label>`).join('')}</div>`
      : '<div class="note-hint">No events with a title and date were found in that file.</div>';
    $('#im-go').disabled = !rows.length;
    $('#im-all')?.addEventListener('change', (e) => $$('[data-ri]', modal).forEach((c) => (c.checked = e.target.checked && !rows[c.dataset.ri].dup)));
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
      const tp = typesList().find((t) => t.id === r.kind) || typesList().find((t) => t.id === 'event') || typesList()[0];
      const timed = !!(tp.range && r.start);
      const end = timed ? (r.end > r.start ? r.end : D.hm(Math.min(D.mins(r.start) + 60, 1439))) : '';
      upsert('items', migrateItem({ id: uid('t'), type: tp.id, task: !!tp.task, exam: !!tp.exam, track: !!tp.track, title: r.title.slice(0, 300), course: r.course || null, date: r.date, start: r.start || '',
        end, mode: r.mode || '', priority: 'normal', notes: r.notes || '', subtasks: [], attachments: [], done: false, createdAt: Date.now() }));
    }
    closeModal();
    commit();
    toast(`Imported ${picked.length} item${picked.length === 1 ? '' : 's'}`);
  };
}
function icsRecur(it, timed) {
  if (!isRecurring(it)) return [];
  const r = it.recur, by = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const parts = r.freq === 'weekdays' ? ['FREQ=WEEKLY', 'BYDAY=MO,TU,WE,TH,FR']
    : [`FREQ=${r.freq.toUpperCase()}`, `INTERVAL=${r.interval || 1}`, ...(r.freq === 'weekly' && r.byDay?.length ? [`BYDAY=${r.byDay.map((d) => by[d]).join(',')}`] : [])];
  if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, '')}${timed ? 'T235959' : ''}`);
  return [`RRULE:${parts.join(';')}`, ...(it.exdates || []).map((d) => (timed ? `EXDATE:${d.replace(/-/g, '')}T${it.start.replace(':', '')}00` : `EXDATE;VALUE=DATE:${d.replace(/-/g, '')}`))];
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
      `DESCRIPTION:${icsEsc(it.notes)}`, ...(it.location ? [`LOCATION:${icsEsc(it.location)}`] : []), ...icsRecur(it, timed), 'END:VEVENT']);
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${SCHED.term.program}//EN`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${SCHED.term.program} — Level ${SCHED.term.level || 1}`, ...ev.flat(), 'END:VCALENDAR'].join('\r\n');
}

/* ================================================================== */
/* Print                                                               */
/* ================================================================== */
function openPrint() {
  const termStart = D.iso(D.sow(D.parse(SCHED.term.start)));
  const modal = openModal(`
    ${modalHead('Print', 'Landscape, colour-coded. The legend on each page lists only the courses on that page.')}
    <div class="body">
      <label class="field">Sheet<select id="pr-sheet">
        <option value="planner">Weekly planner — timetable + a notes section per class (1 week per page)</option>
        <option value="notes">Course notes sheet — the whole page is note blocks, one per class (1 week per page)</option>
        <option value="timetable">Full-page timetable — the planner's timetable on the whole page, no note blocks (1 week per page)</option></select></label>
      <label class="field">Weeks<select id="pr-range">
        <option value="week">This week</option><option value="next">Next week</option><option value="next4">This week + next 3</option>
        <option value="month">This month</option><option value="rest">Rest of the term</option><option value="term">Whole term</option>
        <option value="custom">Custom range…</option></select></label>
      <div class="grid-2 hidden" id="pr-custom">
        <label class="field">From<input type="date" id="pr-from" value="${D.iso(D.sow(ui.cursor))}"></label>
        <label class="field">To<input type="date" id="pr-to" value="${D.iso(D.add(D.sow(ui.cursor), 27))}"></label>
      </div>
      <div class="checks">
        <label class="check"><input type="checkbox" id="pr-mine" checked> Only my groups</label>
        <label class="check"><input type="checkbox" id="pr-items" checked> Include my due dates & events</label>
        <label class="check"><input type="checkbox" id="pr-notes" checked> Include class notes from the website</label>
      </div>
      <div class="note-hint" id="pr-hint"></div>
    </div>
    <footer><button class="btn" data-close>Cancel</button><button class="btn primary" id="pr-go">Print</button></footer>`);
  const getRange = () => {
    const r = $('#pr-range').value, cur = D.sow(ui.cursor);
    if (r === 'week') return [cur, D.add(cur, 6)];
    if (r === 'next') return [D.add(cur, 7), D.add(cur, 13)];
    if (r === 'next4') return [cur, D.add(cur, 27)];
    if (r === 'month') { const f = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1); return [D.sow(f), new Date(f.getFullYear(), f.getMonth() + 1, 0)]; }
    if (r === 'rest') return [D.sow(new Date()), D.parse(SCHED.term.end)];
    if (r === 'term') return [D.parse(termStart), D.parse(SCHED.term.end)];
    return [D.sow(D.parse($('#pr-from').value || D.today())), D.parse($('#pr-to').value || D.today())];
  };
  const est = () => {
    $('#pr-custom').classList.toggle('hidden', $('#pr-range').value !== 'custom');
    const [a, b] = getRange();
    const weeks = Math.max(1, Math.ceil((D.diffDays(D.iso(a), D.iso(b)) + 1) / 7));
    const sheet = $('#pr-sheet').value;
    const pages = weeks;
    const about = `${weeks} week${weeks > 1 ? 's' : ''} → ${pages} page${pages > 1 ? 's' : ''}.`;
    $('#pr-hint').innerHTML = sheet === 'planner'
      ? `${about} A large timetable where every class has ☐ Prep ☐ Att ☐ Rev boxes and every event or due item a ☐ (already ticked ☑ if done here), then an empty lined notes box for each class plus a <i>Reminders & to-do</i> box.`
      : sheet === 'timetable'
        ? `${about} The weekly timetable stretched over the whole page, with the same ☐ Prep ☐ Att ☐ Rev and ☐ done boxes, class notes and carpool status — no note blocks.`
      : sheet === 'notes'
        ? `${about} A full page of lined note blocks — one for each class you have that week (with its class times), plus a <i>Reminders & to-do</i> block.`
        : about;
  };
  est();
  $$('select, input', modal).forEach((el) => el.addEventListener('change', est));
  $('#pr-go').onclick = () => {
    const [a, b] = getRange();
    const opts = { sheet: $('#pr-sheet').value, mine: $('#pr-mine').checked, items: $('#pr-items').checked, notes: $('#pr-notes').checked };
    closeModal();
    buildPrint(a, b, opts);
    setTimeout(() => window.print(), 60);
  };
}

function buildPrint(from, to, opts) {
  const root = $('#print-root');
  const weeks = [];
  for (let w = D.sow(from); w <= to; w = D.add(w, 7)) weeks.push([...Array(7)].map((_, i) => D.iso(D.add(w, i))));
  const entries = (iso) => {
    const ses = sessionsOn(iso, { all: !opts.mine }).map((s) => ({ ...s, rel: relevance(s) }));
    const its = opts.items ? itemsOn(iso).map((it) => itemToEntry(it, iso)) : [];
    return [...ses, ...its].sort((a, b) => (a.start || '00:00').localeCompare(b.start || '00:00'));
  };
  const weekEntries = (days) => days.flatMap(entries);
  const codesIn = (list) => [...new Set(list.map((e) => e.code).filter(Boolean))].sort((a, b) => Object.keys(SCHED.courses).indexOf(a) - Object.keys(SCHED.courses).indexOf(b));
  const termWeek0 = D.sow(D.parse(SCHED.term.start));
  const weekNo = (days) => Math.floor((D.parse(days[0]) - termWeek0) / (7 * 864e5)) + 1;
  const totalWeeks = Math.ceil((D.add(D.parse(SCHED.term.end), 1) - termWeek0) / (7 * 864e5));
  const noteOf = (e) => (opts.notes ? ((e.src === 's' ? getMeta(e.id).note : e.item?.notes) || '').trim() : '');
  const clip = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);
  // Black-and-white friendly: exams are named in the title, not just outlined.
  const short = (e) => (e.kind === 'exam' ? 'EXAM · ' : e.kind === 'test' ? 'TEST · ' : '') + (e.code ? `${codeLabel(e.code)} ` : '') + entryTitle(e);
  const extra = (e) => [modeLabel(e.mode), hasCarpool(e) ? `🚗 ${carpoolText(e)}` : '', e.group ? groupLabel(e) : '',
    e.detail && e.kind !== 'exam' && e.kind !== 'test' ? e.detail : ''].filter(Boolean).join(' · ');
  const sundayEmpty = weeks.every((w) => !entries(w[0]).length);
  const cols = [...Array(7)].map((_, i) => (i === 0 && sundayEmpty ? '.42fr' : '1fr')).join(' ');
  const isExam = (e) => e.kind === 'exam' || e.kind === 'test' || !!e.item?.exam;
  const st = data.settings;

  const pageHead = (title, sub) => `<div class="p-head"><h3>${esc(SCHED.term.program)} <span>· Level ${SCHED.term.level || 1} of ${SCHED.term.levels || 4} · ${title}</span></h3><div>${sub}</div></div>`;
  const groupLine = `${opts.mine ? `Pre-clinic ${esc(st.preGroup)} · Rad lab ${esc(st.radGroup)}` : 'All groups'} · printed ${fmtDate(D.today(), { year: true })}`;
  const weekTitle = (days) => {
    const a = D.parse(days[0]), b = D.parse(days[6]);
    const n = weekNo(days);
    return `${MON3[a.getMonth()]} ${a.getDate()} – ${MON3[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}${n >= 1 && n <= totalWeeks ? ` <span class="wk">Week ${n} of ${totalWeeks}</span>` : ''}`;
  };
  const dayHeads = (days) => days.map((iso, i) => {
    const d = D.parse(iso), tag = dayTag(iso);
    return `<div class="ph ${tag?.cls === 'off' ? 'off' : ''}">${DAY3[i]} ${d.getDate()}${tag && tag.cls !== 'off' ? ` <span>· ${tag.label}</span>` : ''}</div>`;
  }).join('');

  const gridHTML = (days, list, maxMM, cap = 7) => {
    const timed = list.filter(isTimed);
    const lo = Math.floor(Math.min(480, ...timed.map((e) => D.mins(e.start))) / 60) * 60;
    const hi = Math.ceil(Math.max(1020, ...timed.map((e) => D.mins(e.end))) / 60) * 60;
    const nrows = (hi - lo) / 30;
    const rowMM = Math.max(2.2, Math.min(cap, maxMM / nrows));
    const px = (m) => ((m - lo) / 30) * rowMM;
    let times = '';
    for (let m = lo; m <= hi; m += 60) times += `<span style="top:${px(m)}mm">${fmtTime(D.hm(m), false)}</span>`;
    // Due dates and all-day items get their own row under the day headers (never covering classes).
    const pillsFor = (iso) => entries(iso).filter((e) => !isTimed(e) && !isClosure(e)).map((e) => `<div class="${e.done ? 'pdone' : ''}">${e.item?.task ? (e.done ? '☑' : '☐') : itemIcon(e.item)} ${e.item?.task && !e.item?.exam ? '<b>Due</b> ' : ''}${e.start ? itemTime(e.item) + ' ' : ''}${esc(e.title)}</div>`).join('');
    const pillRow = days.map(pillsFor);
    const alldayHTML = pillRow.some(Boolean) ? `<div class="pad-lbl">Due</div>${pillRow.map((h) => `<div class="pad">${h}</div>`).join('')}` : '';
    const pcols = days.map((iso) => {
      const dl = entries(iso);
      const closed = dayClosed(iso);
      return `<div class="pcol ${closed ? 'closed' : ''}">${closed ? `<div class="pclosed">${esc(closed.title)}</div>` : ''}
        ${layoutColumns(dl.filter(isTimed)).map((e) => {
          const w = 100 / (e._lanes || 1), l = (e._lane || 0) * w, h = px(D.mins(e.end)) - px(D.mins(e.start));
          const n = noteOf(e);
          const m = tracksAttendance(e) ? getMeta(metaKey(e)) : null;
          const box = (on) => (on ? '☑' : '☐');
          // Classes: Prep/Att/Rev boxes (ticked if done on the site); your events: one done box.
          const checks = m ? `<div class="pck">${box(m.prepared)} Prep ${box(m.attended)} Att ${box(m.reviewed)} Rev</div>` : '';
          const lead = e.src === 'i' && e.item.task ? `${box(e.done)} ` : m && (!checks || h <= rowMM * 3) ? `${box(m.attended)} ` : '';
          return `<div class="pev ${modeClass(e.mode)} ${isExam(e) ? 'exam' : ''} ${e.src === 'i' && e.done ? 'pdone' : ''}" style="--c:${entryColor(e)};top:${px(D.mins(e.start))}mm;height:${h - 0.3}mm;left:${l}%;width:calc(${w}% - .4mm);${e.rel === 'other' ? 'opacity:.55' : ''}">
            <b>${lead}${esc(short(e))}${n && h <= rowMM * 5.5 ? ' ✎' : ''}</b>${h > rowMM * 2 ? `<span class="pm">${fmtRange(e.start, e.end)}</span>` : ''}${h > rowMM * 3 ? `<div class="pm">${esc(extra(e))}</div>` : ''}${h > rowMM * 3 ? checks : ''}${n && h > rowMM * 5.5 ? `<div class="pn">✎ ${esc(clip(n, 140))}</div>` : ''}</div>`;
        }).join('')}</div>`;
    }).join('');
    return `<div class="p-grid" style="--pcols:${cols};--prow:${rowMM}mm;--nrows:${nrows}"><div class="ph"></div>${dayHeads(days)}${alldayHTML}<div class="ptimes">${times}</div>${pcols}</div>`;
  };

  // An empty notes box per class (plus one general box): everything trackable is in the timetable above.
  // full: the course notes sheet — blocks fill the page and list that week's class times.
  const blocksHTML = (days, list, { full = false } = {}) => {
    const times = (code) => list.filter((e) => e.src === 's' && e.code === code && !isClosure(e))
      .map((e) => `${DAY3[D.parse(e.date).getDay()]} ${D.parse(e.date).getDate()} ${fmtRange(e.start, e.end)}`).join(' · ');
    const blocks = codesIn(list).filter((c) => list.some((e) => e.src === 's' && e.code === c && !isClosure(e))).map((code) => `<section class="nb" style="--c:${courseColor(code)}">
        <div class="nb-h"><b>${codeLabel(code)}</b> ${esc(SCHED.courses[code])}<span class="nb-i">${esc((COURSE_INSTR[code] || []).join(', '))}</span></div>
        ${full ? `<div class="nb-when-row">${esc(times(code))}</div>` : ''}
        <div class="nb-lines"></div></section>`);
    const n = blocks.length + 1;
    const cols = n <= 2 ? n : n <= 4 ? 2 : n <= 9 ? 3 : 4;
    // On the notes sheet the Reminders block stretches over any empty slots in the last row.
    const spare = full ? (cols - (n % cols)) % cols : 0;
    blocks.push(`<section class="nb general" ${spare ? `style="grid-column: span ${spare + 1}"` : ''}><div class="nb-h"><b>Reminders & to-do</b><span class="nb-i">this week</span></div><div class="nb-lines"></div></section>`);
    if (full) {
      return `<div class="nb-grid full" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${Math.ceil(n / cols)}, minmax(0, 1fr))">${blocks.join('')}</div>`;
    }
    const rows = n <= 5 ? 1 : n <= 10 ? 2 : 3;
    return `<div class="nb-grid" style="grid-template-columns:repeat(${Math.ceil(n / rows)}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(0, 1fr))">${blocks.join('')}</div>`;
  };

  if (opts.sheet === 'notes') {
    root.innerHTML = weeks.map((days, i) => `<div class="p-page planner ${i < weeks.length - 1 ? 'break' : ''}">
        ${pageHead(`Course notes · ${weekTitle(days)}`, groupLine)}${blocksHTML(days, weekEntries(days), { full: true })}</div>`).join('');
    return;
  }
  if (opts.sheet === 'planner') {
    root.innerHTML = weeks.map((days, i) => {
      const list = weekEntries(days);
      return `<div class="p-page planner ${i < weeks.length - 1 ? 'break' : ''}">
        ${pageHead(weekTitle(days), groupLine)}
        ${gridHTML(days, list, list.some((e) => !isTimed(e) && !isClosure(e)) ? 110 : 122)}
        ${blocksHTML(days, list)}</div>`;
    }).join('');
    return;
  }

  // Full-page timetable: the planner's grid with the whole page to itself.
  root.innerHTML = weeks.map((days, i) => `<div class="p-page planner full-tt ${i < weeks.length - 1 ? 'break' : ''}">
      ${pageHead(weekTitle(days), groupLine)}${gridHTML(days, weekEntries(days), weekEntries(days).some((e) => !isTimed(e) && !isClosure(e)) ? 162 : 176, 9)}</div>`).join('');
}
window.addEventListener('afterprint', () => { $('#print-root').innerHTML = ''; });

/* ================================================================== */
/* Levels: LEVEL UP!, setup wizard, switching                          */
/* ================================================================== */
function switchLevel(n) {
  if (!levelAvailable(n)) return;
  data.settings.currentLevel = n;
  data.settingsUpdatedAt = Date.now();
  commit();
  toast(`Viewing Level ${n}`);
}

function levelUp() {
  const cur = currentLevel();
  if (cur >= MAX_LEVEL) return toast('Level 4 is the final level — you made it! 🎓');
  const prog = levelProgress();
  if (prog.remaining.length) return openLockedLevelUp(prog);
  const next = cur + 1;
  if (!levelAvailable(next)) return openLevelWizard(next);
  const modal = openModal(`${modalHead(`Level ${next} is ready ★`, 'Its courses and class periods are already set up.')}
    <div class="body"><p style="margin:0">Jump to your Level ${next} timetable, or change its courses and periods first.</p></div>
    <footer><button class="btn" id="lv-edit">Edit Level ${next} setup</button><button class="btn primary" id="lv-go">Go to Level ${next} →</button></footer>`);
  $('#lv-edit', modal).onclick = () => openLevelWizard(next);
  $('#lv-go', modal).onclick = () => { closeModal(); switchLevel(next); celebrate(); };
}

function openLockedLevelUp(prog) {
  const lvl = currentLevel();
  const modal = openModal(`${modalHead(`🔒 LEVEL UP! is locked`, `Finish all ${prog.total} Level ${lvl} courses to unlock Level ${lvl + 1}.`)}
    <div class="body">
      <div class="lock-progress"><div class="progress"><i style="width:${Math.round(((prog.total - prog.remaining.length) / prog.total) * 100)}%"></i></div>
        <span><b>${prog.total - prog.remaining.length}</b> of ${prog.total} courses complete</span></div>
      <div class="muted small">A course counts as complete once its last class is over, or when you mark it complete (for example after final grades are in).</div>
      <div class="card">${prog.remaining.map((c) => {
        const last = courseStatus(c).last;
        return `<div class="lock-row" style="--c:${courseColor(c)}"><span class="sw"></span><div><b>${codeLabel(c)}</b> ${esc(SCHED.courses[c])}
          <div class="muted small">${last ? `Last class ${fmtDate(last.date, { year: true })}` : 'No classes scheduled'}</div></div>
          <button class="btn sm" data-lock-done="${esc(c)}">✓ Mark complete</button></div>`;
      }).join('')}</div>
    </div>
    <footer><button class="btn" data-close>Close</button><button class="btn" id="lk-courses">Open Courses</button></footer>`);
  $$('[data-lock-done]', modal).forEach((b) => (b.onclick = () => {
    setCourseDone(b.dataset.lockDone, true);
    const p = levelProgress();
    if (p.remaining.length) openLockedLevelUp(p);
    else { closeModal(); levelUp(); }
  }));
  $('#lk-courses', modal).onclick = () => { closeModal(); setView('courses'); };
}

function levelTermDefaults(n) {
  const prevEnd = n - 1 === 1 ? BASE_L1.term.end : data.levels[n - 1]?.end || D.today();
  let start = D.add(D.parse(prevEnd), 1);
  while (start.getDay() !== 1) start = D.add(start, 1); // next Monday
  return { start: D.iso(start), end: D.iso(D.add(start, 7 * 15 - 3)) }; // 15 weeks, ending Friday
}

// Multi-step setup: term → courses → weekly class periods → review.
function openLevelWizard(n, { step = 0 } = {}) {
  const existing = data.levels[n];
  const l1 = n === 1;
  const draft = existing ? structuredClone(existing)
    : { level: n, ...(l1 ? { start: BASE_L1.term.start, end: BASE_L1.term.end } : levelTermDefaults(n)), breaks: [], courses: [], periods: [] };
  if (l1) Object.assign(draft, { start: BASE_L1.term.start, end: BASE_L1.term.end });
  if (!draft.courses.length) draft.courses.push({ code: '', name: '', instructor: '', color: PALETTE[0] });
  const STEPS = ['Term', 'Courses', 'Class periods', 'Review'];
  const order = l1 ? [1, 2, 3] : [0, 1, 2, 3]; // Level 1's term comes from the official timetable
  if (!order.includes(step)) step = order[0];
  const modal = openModal(`<header><span class="bar" style="background:linear-gradient(#ffd43b,#f783ac)"></span><div style="flex:1">
      <h2>${l1 ? 'Level 1 — your extra courses & class periods' : existing ? `Level ${n} setup` : `★ LEVEL UP! Welcome to Level ${n}`}</h2><div class="muted small" id="lw-sub"></div></div>
      <button class="icon-btn" data-close aria-label="Close">${ICON.x.replace('<svg', '<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2"')}</button></header>
    <div class="lw-steps" id="lw-steps"></div><div class="body" id="lw-body"></div><footer id="lw-foot"></footer>`, { wide: true });
  const body = $('#lw-body', modal);

  const setPath = (path, value) => {
    const keys = path.split('.');
    let o = draft;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = value;
  };
  const normCode = (c) => c.toUpperCase().replace(/\s+/g, '');
  const courseSel = (sel) => draft.courses.filter((c) => c.code).map((c) => `<option value="${esc(c.code)}" ${c.code === sel ? 'selected' : ''}>${codeLabel(c.code)} · ${esc(c.name || '')}</option>`).join('');

  const views = [
    () => `<p class="lw-intro">${existing ? 'Change the term dates or days off.' : `Congrats on finishing Level ${n - 1}! 🎉 Let's build your Level ${n} timetable. First, when does the term run?`}</p>
      <div class="grid-2"><label class="field">First day of classes<input type="date" data-f="start" value="${esc(draft.start)}"></label>
        <label class="field">Last day of classes<input type="date" data-f="end" value="${esc(draft.end)}"></label></div>
      <div class="form-section"><div class="form-label">Days off (reading week, holidays…) — no classes are scheduled on these days</div>
        ${draft.breaks.map((b, i) => `<div class="lw-row lw-break"><input type="text" placeholder="e.g. Reading week" data-f="breaks.${i}.label" value="${esc(b.label || '')}">
          <input type="date" data-f="breaks.${i}.from" value="${esc(b.from || '')}" aria-label="From"><span class="muted">to</span><input type="date" data-f="breaks.${i}.to" value="${esc(b.to || '')}" aria-label="To (optional)">
          <button type="button" class="icon-btn" data-rm="breaks.${i}" aria-label="Remove">✕</button></div>`).join('')}
        <button type="button" class="btn sm" data-add="break">${ICON.plus} Add days off</button></div>`,
    () => `<p class="lw-intro">${l1 ? 'Level 1\'s official courses come from the timetable. Add any extra courses here (electives, study groups, tutoring…) — or skip straight to class periods to add extra sessions for an official course.' : `Which courses are you taking in Level ${n}?`}</p>
      <div class="lw-courses"><div class="lw-row lw-head"><span>Code</span><span>Course name</span><span>Instructor</span><span>Colour</span><span></span></div>
      ${draft.courses.map((c, i) => `<div class="lw-row lw-course">
        <input type="text" placeholder="DH 201" data-f="courses.${i}.code" value="${esc(c.code.replace(/^DH(?=\d)/, 'DH '))}" aria-label="Course code">
        <input type="text" placeholder="e.g. Clinical Practice II" data-f="courses.${i}.name" value="${esc(c.name)}" aria-label="Course name">
        <input type="text" placeholder="e.g. Ms. Morrow" data-f="courses.${i}.instructor" value="${esc(c.instructor || '')}" aria-label="Instructor">
        <input type="color" data-f="courses.${i}.color" value="${esc(c.color || PALETTE[i % PALETTE.length])}" aria-label="Colour">
        <button type="button" class="icon-btn" data-rm="courses.${i}" aria-label="Remove course">✕</button></div>`).join('')}</div>
      <button type="button" class="btn sm" data-add="course">${ICON.plus} Add course</button>`,
    () => `<p class="lw-intro">Add each course's class periods — the times it meets every week. Online and in-person periods are shown differently on the timetable.</p>
      ${[...draft.courses.filter((c) => c.code), ...(l1 ? Object.keys(BASE_L1.courses).map((code) => ({ code, name: BASE_L1.courses[code], color: '', official: true })) : [])].map((c) => {
        const list = draft.periods.map((p, i) => [p, i]).filter(([p]) => p.code === c.code);
        return `<section class="lw-card" style="--c:${c.official ? courseColor(c.code) : esc(c.color)}"><h3><span class="sw"></span>${codeLabel(c.code)} <span>${esc(c.name)}${c.official ? ' · official timetable — add extra sessions only' : ''}</span></h3>
          ${list.length ? '' : '<div class="muted small">No periods yet.</div>'}
          ${list.map(([p, i]) => `<div class="lw-period">
            <div class="day-toggles">${DAY3.map((d, di) => `<button type="button" class="day-tg" data-day="${i}.${di}" aria-pressed="${(p.days || []).includes(di)}" title="${DAY[di]}">${d.slice(0, 2)}</button>`).join('')}</div>
            <label class="field">Start<input type="time" data-f="periods.${i}.start" value="${esc(p.start || '')}"></label>
            <label class="field">End<input type="time" data-f="periods.${i}.end" value="${esc(p.end || '')}"></label>
            <label class="field">Type<select data-f="periods.${i}.type">${Object.entries(PERIOD_TYPES).map(([k, v]) => `<option value="${k}" ${k === (p.type || 'lecture') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="field">Where<select data-f="periods.${i}.mode"><option value="in-person" ${p.mode !== 'online' ? 'selected' : ''}>In person</option><option value="online" ${p.mode === 'online' ? 'selected' : ''}>Online</option></select></label>
            <label class="field">Room / link<input type="text" data-f="periods.${i}.location" value="${esc(p.location || '')}" placeholder="Room 204"></label>
            <label class="field">Repeats<select data-f="periods.${i}.every"><option value="1" ${(p.every || 1) == 1 ? 'selected' : ''}>Every week</option><option value="2" ${p.every == 2 ? 'selected' : ''}>Every 2 weeks</option></select></label>
            <label class="field">From <span class="muted">(optional)</span><input type="date" data-f="periods.${i}.from" value="${esc(p.from || '')}"></label>
            <label class="field">Until <span class="muted">(optional)</span><input type="date" data-f="periods.${i}.until" value="${esc(p.until || '')}"></label>
            <button type="button" class="icon-btn lw-rm" data-rm="periods.${i}" aria-label="Remove period">✕</button></div>`).join('')}
          <button type="button" class="btn sm" data-add="period" data-code="${esc(c.code)}">${ICON.plus} Add period</button></section>`;
      }).join('')}`,
    () => {
      const sched = buildLevelSchedule(n, draft);
      const classes = sched.sessions.filter((x) => x.kind === 'class');
      const weekly = draft.periods.reduce((a, p) => a + (p.days || []).length * Math.max(0, D.mins(p.end || '00:00') - D.mins(p.start || '00:00')) / (p.every || 1), 0) / 60;
      return `<p class="lw-intro">Here's your Level ${n} at a glance.</p>
        <dl class="kv-list">${l1 ? '' : '<dt>Term</dt>'}${l1 ? '' : `<dd>${fmtDate(draft.start, { year: true })} – ${fmtDate(draft.end, { year: true })}</dd>`}
          <dt>Days off</dt><dd>${draft.breaks.length ? draft.breaks.map((b) => `${esc(b.label || 'No classes')} (${fmtDate(b.from)}${b.to && b.to !== b.from ? ' – ' + fmtDate(b.to) : ''})`).join(', ') : '—'}</dd>
          <dt>Classes</dt><dd>${classes.length} sessions · about ${+weekly.toFixed(1)} h a week</dd></dl>
        <div class="note-hint">Study blocks, prep time, commutes, shifts and appointments aren't class periods — after this, drag on the week view (or use <b>New → Event</b>) to add them, once or repeating, with a category like 📚 Study or 🚌 Commute.</div>
        <div class="card">${[...draft.courses, ...(l1 ? [...new Set(draft.periods.map((p) => p.code))].filter((code) => BASE_L1.courses[code]).map((code) => ({ code, name: BASE_L1.courses[code], color: '' })) : [])].map((c) => {
          const ps = draft.periods.filter((p) => p.code === c.code);
          return `<div class="lock-row" style="--c:${c.color ? esc(c.color) : courseColor(c.code)}"><span class="sw"></span><div><b>${codeLabel(c.code)}</b> ${esc(c.name)}${c.instructor ? ` <span class="muted">· ${esc(c.instructor)}</span>` : ''}
            <div class="muted small">${ps.length ? ps.map((p) => `${(p.days || []).slice().sort().map((d) => DAY3[d]).join(' & ')} ${fmtRange(p.start, p.end)} · ${PERIOD_TYPES[p.type || 'lecture']} · ${p.mode === 'online' ? 'online' : 'in person'}${p.location ? ' · ' + esc(p.location) : ''}${p.every == 2 ? ' · every 2 weeks' : ''}`).join('<br>') : '<span style="color:var(--warn)">No class periods — it will appear in your course list only.</span>'}</div></div></div>`;
        }).join('')}</div>`;
    },
  ];

  const validate = (i) => {
    if (i === 0) {
      if (!draft.start || !draft.end || draft.end <= draft.start) return 'Pick a first and last day (the last day must be after the first).';
      if (draft.breaks.some((b) => !b.from || (b.to && b.to < b.from))) return 'Each set of days off needs a start date (and an end date after it).';
    }
    if (i === 1) {
      draft.courses = draft.courses.filter((c) => c.code || c.name);
      if (!draft.courses.length && !l1) { draft.courses.push({ code: '', name: '', instructor: '', color: PALETTE[0] }); return 'Add at least one course.'; }
      for (const c of draft.courses) {
        if (l1 && BASE_L1.courses[c.code]) return `${c.code} is already an official Level 1 course — add its extra sessions on the next step instead.`;
        if (!c.code || !c.name) return 'Every course needs a code and a name.';
        if (!/^[A-Z0-9-]{2,12}$/.test(c.code)) return `"${c.code}" isn't a valid code — use letters and numbers, like DH 201.`;
      }
      if (new Set(draft.courses.map((c) => c.code)).size !== draft.courses.length) return 'Two courses have the same code.';
    }
    if (i === 2) {
      for (const p of draft.periods) {
        const c = draft.courses.find((x) => x.code === p.code) || (l1 && BASE_L1.courses[p.code] ? { code: p.code } : null);
        if (!(p.days || []).length) return `Pick at least one day for each ${c ? codeLabel(c.code) : ''} period.`;
        if (!p.start || !p.end || p.end <= p.start) return `Each ${c ? codeLabel(c.code) : ''} period needs a start and end time (end after start).`;
      }
    }
    return '';
  };

  const draw = (i) => {
    step = i;
    const pos = order.indexOf(i), prev = order[pos - 1], next = order[pos + 1];
    $('#lw-sub', modal).textContent = `Step ${pos + 1} of ${order.length}: ${STEPS[i]}`;
    $('#lw-steps', modal).innerHTML = order.map((k, j) => `<button type="button" class="lw-step ${k === i ? 'on' : j < pos ? 'past' : ''}" ${existing || l1 || j < pos ? `data-go="${k}"` : 'disabled'}>${j + 1}. ${STEPS[k]}</button>`).join('');
    body.innerHTML = views[i]();
    body.classList.remove('step-enter'); void body.offsetWidth; body.classList.add('step-enter');
    $('#lw-foot', modal).innerHTML = `${prev !== undefined ? '<button class="btn left" id="lw-back">← Back</button>' : ''}<button class="btn" data-close>Cancel</button>
      ${next !== undefined ? '<button class="btn primary" id="lw-next">Next →</button>' : `<button class="btn primary levelup-go" id="lw-done">${existing || l1 ? 'Save changes' : `★ Start Level ${n}`}</button>`}`;
    $$('[data-close]', modal).forEach((b) => (b.onclick = closeModal));
    $$('[data-go]', modal).forEach((b) => (b.onclick = () => { const err = validate(step); if (err && order.indexOf(+b.dataset.go) > pos) return toast(err); draw(+b.dataset.go); }));
    $('#lw-back', modal)?.addEventListener('click', () => draw(prev));
    $('#lw-next', modal)?.addEventListener('click', () => { const err = validate(i); if (err) { toast(err); draw(i); return; } draw(next); });
    $('#lw-done', modal)?.addEventListener('click', finish);
    body.querySelector('input, select')?.focus();
  };

  body.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    let v = e.target.value;
    if (/^courses\.\d+\.code$/.test(f)) {
      const i = +f.split('.')[1], old = draft.courses[i].code;
      v = normCode(v);
      for (const p of draft.periods) if (p.code === old) p.code = v;
    }
    if (/\.every$/.test(f)) v = +v;
    setPath(f, v);
  });
  body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-add],[data-rm],[data-day]');
    if (!t) return;
    if (t.dataset.day) {
      const [i, d] = t.dataset.day.split('.').map(Number);
      const days = new Set(draft.periods[i].days || []);
      days.has(d) ? days.delete(d) : days.add(d);
      draft.periods[i].days = [...days];
      t.setAttribute('aria-pressed', String(days.has(d)));
      return;
    }
    if (t.dataset.add === 'break') draft.breaks.push({ label: '', from: '', to: '' });
    if (t.dataset.add === 'course') draft.courses.push({ code: '', name: '', instructor: '', color: PALETTE[draft.courses.length % PALETTE.length] });
    if (t.dataset.add === 'period') {
      const prev = [...draft.periods].reverse().find((p) => p.code === t.dataset.code);
      draft.periods.push({ id: uid('p'), code: t.dataset.code, days: prev ? [...prev.days] : [1], start: prev?.start || '09:00', end: prev?.end || '11:00', type: 'lecture', mode: prev?.mode || 'in-person', location: prev?.location || '', every: 1, from: '', until: '' });
    }
    if (t.dataset.rm) {
      const [list, i] = t.dataset.rm.split('.');
      const [gone] = draft[list].splice(+i, 1);
      if (list === 'courses' && gone?.code) draft.periods = draft.periods.filter((p) => p.code !== gone.code);
    }
    draw(step);
  });

  function finish() {
    for (const k of order.slice(0, -1)) { const err = validate(k); if (err) { toast(err); return draw(k); } }
    draft.level = n;
    draft.updatedAt = Date.now();
    data.levels[n] = draft;
    if (!l1) { data.settings.currentLevel = n; data.settingsUpdatedAt = Date.now(); }
    closeModal();
    commit();
    if (!existing && !l1) { celebrate(); toast(`★ Welcome to Level ${n}!`); } else toast(`Level ${n} updated`);
  }
  draw(step);
}

/* ================================================================== */
/* Fun: hearts & stars                                                 */
/* ================================================================== */
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
function burst(x, y, { count = 9, spread = 70, size = 18 } = {}) {
  if (reducedMotion.matches) return;
  const glyphs = [['♥', '#ff4d8d'], ['♥', '#ff8fb8'], ['❤', '#f03e3e'], ['★', '#fcc419'], ['✦', '#ffd43b'], ['★', '#ffa94d']];
  for (let i = 0; i < count; i++) {
    const [ch, color] = glyphs[Math.floor(Math.random() * glyphs.length)];
    const el = document.createElement('span');
    el.className = 'fx';
    el.textContent = ch;
    el.style.cssText = `left:${x}px;top:${y}px;color:${color};font-size:${size * (0.6 + Math.random() * 0.8)}px`;
    document.body.appendChild(el);
    const ang = Math.random() * Math.PI * 2, dist = spread * (0.5 + Math.random());
    el.animate([
      { transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist - 20}px)) scale(1) rotate(${(Math.random() - 0.5) * 120}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${Math.cos(ang) * dist * 1.2}px), calc(-50% + ${Math.sin(ang) * dist + 25}px)) scale(.8) rotate(${(Math.random() - 0.5) * 200}deg)`, opacity: 0 },
    ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => el.remove();
  }
}
function celebrate() {
  const w = innerWidth, h = innerHeight;
  [[w / 2, h / 3], [w / 4, h / 2], [(3 * w) / 4, h / 2]].forEach(([x, y], i) => setTimeout(() => burst(x, y, { count: 26, spread: 180, size: 26 }), i * 220));
}
// Every so often a click sends out a little burst of hearts and stars.
document.addEventListener('pointerdown', (e) => {
  if (data.settings.fun === false || e.button !== 0 || Math.random() > 0.2) return;
  burst(e.clientX, e.clientY);
}, { passive: true });

/* ================================================================== */
/* Events / navigation                                                 */
/* ================================================================== */
function navigate(dir) {
  ui.anim = dir > 0 ? 'nav-next' : dir < 0 ? 'nav-prev' : 'view-enter';
  if (dir === 0) ui.cursor = new Date();
  else if (ui.view === 'month') ui.cursor = D.addMonths(ui.cursor, dir);
  else ui.cursor = D.add(ui.cursor, 7 * dir);
  render();
}

document.addEventListener('click', (e) => {
  if (e.target.matches('[data-toggle]')) return;
  const ddEl = e.target.closest('[data-daydone]');
  if (ddEl) { e.preventDefault(); return toggleDayDone(ddEl.dataset.daydone); }
  const colEl = e.target.closest('[data-collapse]');
  if (colEl) { e.preventDefault(); return setDayCollapsed(colEl.dataset.collapse, !dayIsCollapsed(colEl.dataset.collapse)); }
  const tkDone = e.target.closest('[data-tkdone]');
  if (tkDone) {
    e.preventDefault(); e.stopPropagation();
    const on = tkDone.getAttribute('aria-checked') !== 'true';
    tkDone.setAttribute('aria-checked', String(on));
    return setRowStatus(tkDone.dataset.tkdone, on ? 'done' : 'not-started', tkDone);
  }
  const tkSt = e.target.closest('[data-tkstatus]');
  if (tkSt) {
    e.preventDefault(); e.stopPropagation();
    const [key, st] = [tkSt.dataset.tkstatus.slice(0, tkSt.dataset.tkstatus.lastIndexOf('|')), tkSt.dataset.tkstatus.split('|').pop()];
    return setRowStatus(key, STATUS_NEXT[st], tkSt);
  }
  const doneEl = e.target.closest('[data-done]');
  if (doneEl) { e.preventDefault(); e.stopPropagation(); return toggleEntryDone(doneEl.dataset.done); }
  const cpEl = e.target.closest('[data-carpool]');
  if (cpEl) { e.preventDefault(); e.stopPropagation(); return toggleCarpool(cpEl.dataset.carpool); }
  const att = e.target.closest('[data-attend]');
  if (att) { e.preventDefault(); e.stopPropagation(); return toggleAttended(att.dataset.attend); }
  const t = e.target.closest('[data-action],[data-nav],[data-open],[data-add-date],[data-msel],[data-goto],[data-view],[data-level],[data-others],[data-courses-all],[data-legend]');
  if (!t) return;
  if (t.dataset.view) return setView(t.dataset.view);
  if (t.dataset.level) return switchLevel(+t.dataset.level);
  if (t.dataset.addDate) return openItemEditor({ date: t.dataset.addDate, type: 'event' });
  if (t.dataset.nav !== undefined) return navigate(+t.dataset.nav);
  if (t.dataset.legend) {
    legendCollapsed = t.dataset.legend === 'close';
    try { localStorage.setItem('l1s:legend', legendCollapsed ? 'collapsed' : 'open'); } catch {}
    return render();
  }
  if (t.dataset.coursesAll) return setHiddenCourses(t.dataset.coursesAll === 'hide' ? Object.keys(SCHED.courses) : []);
  if (t.dataset.others) { data.settings.others = t.dataset.others; data.settingsUpdatedAt = Date.now(); return commit(); }
  if (t.dataset.msel) { ui.monthSel = t.dataset.msel; return render(); }
  if (t.dataset.goto) { ui.cursor = D.parse(t.dataset.goto); return setView('week'); }
  if (t.dataset.open) {
    if (Date.now() < suppressClickUntil) return; // the pointer just finished dragging an event
    const [src, rest] = [t.dataset.open.slice(0, 1), t.dataset.open.slice(2)];
    if (src === 's') return openSession(rest);
    const [id, occ] = rest.split('|');
    const it = data.items.find((i) => i.id === id);
    if (it) openItemEditor(it, { occ: occ || it.date });
    return;
  }
  const a = t.dataset.action;
  if (a === 'new-item') openItemEditor({ date: ui.view === 'week' || ui.view === 'month' ? pickDefaultDate() : D.today(), course: ui.view === 'tasks' ? ui.taskCourse || null : null });
  else if (a === 'level-up') levelUp();
  else if (a === 'print') openPrint();
  else if (a === 'settings') openSettings();
  else if (a === 'import') openImport();
  else if (a === 'menu') openMenu();
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
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches?.('[data-attend]')) { e.preventDefault(); return toggleAttended(e.target.dataset.attend); }
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches?.('[data-daydone]')) { e.preventDefault(); return toggleDayDone(e.target.dataset.daydone); }
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches?.('[data-done]')) { e.preventDefault(); return toggleEntryDone(e.target.dataset.done); }
  if ((e.key === ' ' || e.key === 'Enter') && e.target.matches?.('[data-carpool]')) { e.preventDefault(); return toggleCarpool(e.target.dataset.carpool); }
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
narrowMQ.addEventListener('change', () => ['week', 'month', 'tasks', 'notes'].includes(ui.view) && render());
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
// Due dates from Brightspace (7 pages of the Upcoming list, Oct 2026 intake). Same rules as above:
// fixed ids, added once, and anything edited or deleted on any device stays that way.
// [course, title, date, time, points, weight %, exam?, notes]
const BRIGHTSPACE_DEADLINES = [
  ['DH107', 'Plagiarism Homework', '2026-10-16', '23:59'],
  ['DH110', 'SMART GOALS Quiz', '2026-10-23', '23:59', 1],
  ['DH110', 'Learning Styles Assessment Drop Box', '2026-10-23', '23:59', 2],
  ['DH103', '2. Lesson 1 Crossword Dropbox', '2026-10-23', '23:59', 1],
  ['DH110', 'ADEA Membership drop box', '2026-10-28', '23:59'],
  ['DH108', 'Microbiology Test 1A', '2026-10-30', '17:25', 100, 10, true],
  ['DH107', '3.4 Journal Citation Homework', '2026-11-04', '23:59'],
  ['DH110', 'CDHA membership drop box', '2026-11-09', '23:59'],
  ['DH110', 'ODHA Membership Drop Box', '2026-11-09', '23:59'],
  ['DH103', '3. Lesson 2 Review Crossword Dropbox', '2026-11-14', '23:59', 1],
  ['DH103', '5. Test 1 Flashcards', '2026-11-15', '23:59', 1],
  ['DH107', '4.3 Warning Reflection Paper', '2026-11-20', '23:59', 15],
  ['DH108', 'Microbiology Test 2A', '2026-11-23', '17:00', 50, 10, true],
  ['DH107', 'Thesis Statement & Outline', '2026-11-27', '23:59'],
  ['DH108', 'Microbiology Test 3', '2026-12-07', '15:30', 15, 15, true],
  ['DH107', 'Medical Terminology', '2026-12-09', '23:59'],
  ['DH110', 'DH 110 Test 1', '2026-12-16', '15:55', 70, '', true],
  ['DH107', '7.3 Assignment 2 – Academic Paper', '2026-12-18', '23:59', 100, 30],
  ['DH107', '7.4 Assignment 2 – Peer and Self Reflection', '2027-01-06', '23:59'],
  ['DH107', 'Assignment 2, Part B', '2027-01-06', '23:59', 100, 10],
  ['DH102', 'Participation Activity Drop Box', '2027-01-08', '23:59', 10],
  ['DH110', 'CDHO – Consent and the Dental Hygienist', '2027-01-11', '23:59'],
  ['DH108', 'Assignment 1 – IPAC Reprocessing in the Community Course', '2027-01-13', '23:59', 5],
  ['DH108', 'Peer Evaluation Form Dropbox', '2027-01-27', '23:59'],
  ['DH108', 'Assignment 2: Infection Control Assignment & Presentation', '2027-01-27', '23:59', 100],
  ['DH110', 'Ethics in Dentistry: Part I – Principles and Values', '2027-01-29', '23:59', 1],
  ['DH108', 'Microbiology Test 4', '2027-02-03', '19:00', 15, 15, true],
  ['DH110', 'Assignment #2: Philosophy of Oral and General Health paper', '2027-02-08', '23:59', 20],
  ['DH107', 'Self- and Peer-Assessment A3', '2027-02-18', '23:59'],
  ['DH107', 'A3 – Cultural Diversity PPT', '2027-02-18', '23:59', 100, 15],
  ['DH110', 'Portfolio Shell', '2027-02-19', '23:59', 5],
  ['DH110', 'Final Portfolio submission', '2027-02-24', '23:59', 5],
  ['DH110', 'Developing as a Professional – Continuing Education requirements for RDHs', '2027-02-28', '23:59', 2],
  // The exam itself is already on the timetable (Mar 3, 8:00); this is Brightspace's closing time.
  ['DH108', 'FINAL EXAM (Brightspace)', '2027-03-03', '13:00', 35, '', false, 'The exam is on the timetable at 8:00 am; Brightspace closes at 1:00 pm.'],
  ['DH107', 'Cultural Summary – A reflection', '2027-03-05', '23:59', 5],
];
// Notion deadlines that are also on Brightspace: Brightspace gives them an 11:59 pm due time.
const BRIGHTSPACE_TIMES = { t_seed_06: '23:59', t_seed_07: '23:59', t_seed_08: '23:59', t_seed_09: '23:59', t_seed_10: '23:59' };
function seedDeadlines() {
  let added = 0;
  STARTER_DEADLINES.forEach(([course, title, date, start, status], i) => {
    const id = `t_seed_${String(i + 1).padStart(2, '0')}`;
    if (data.deleted[id] || data.items.some((x) => x.id === id)) return;
    data.items.push({ id, type: 'assignment', task: true, exam: false, kind: 'assignment', title, course, date, start, end: '', mode: '', priority: 'normal', notes: '', subtasks: [],
      attachments: [], status, done: status === 'done', grade: '', weight: '', createdAt: 1, updatedAt: 1 });
    added++;
  });
  BRIGHTSPACE_DEADLINES.forEach(([course, title, date, start, pts = '', weight = '', exam = false, note = ''], i) => {
    const id = `t_bs_${String(i + 1).padStart(2, '0')}`;
    if (data.deleted[id] || data.items.some((x) => x.id === id)) return;
    data.items.push({ id, type: exam ? 'exam' : 'assignment', task: true, exam, kind: exam ? 'exam' : 'assignment', title, course, date, start, end: '', mode: '',
      priority: 'normal', notes: [note, pts ? `Worth ${pts} pt${pts === 1 ? '' : 's'} on Brightspace.` : ''].filter(Boolean).join('\n'), subtasks: [],
      attachments: [], status: 'not-started', done: false, grade: '', weight: String(weight), createdAt: 1, updatedAt: 1 });
    added++;
  });
  for (const [id, start] of Object.entries(BRIGHTSPACE_TIMES)) {
    const it = data.items.find((x) => x.id === id);
    if (it && !it.start && it.updatedAt === 1) { it.start = start; it.updatedAt = 2; added++; }
  }
  if (added) commit({ rerender: false });
}

/* ================================================================== */
/* Boot                                                                */
/* ================================================================== */
// Opened as a home-screen app (iOS/Android): always start on this week's timetable.
const isHomeScreenApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function goToTodaysWeek() {
  ui.view = 'week';
  ui.cursor = new Date();
}

(async function boot() {
  loadLocal();
  applyTheme();
  try { ui.view = localStorage.getItem('l1s:view') || 'week'; } catch {}
  if (!['week', 'month', 'agenda', 'tasks', 'notes', 'courses'].includes(ui.view)) ui.view = 'week';
  const launchToday = isHomeScreenApp();
  showSyncState();
  await loadSchedule();
  ensureLevel();
  if (launchToday) goToTodaysWeek();
  render();
  await pullRemote();
  seedDeadlines();
  // Syncing can switch the level being viewed, which moves the calendar; land back on today.
  if (launchToday && ensureLevel() && ui.view === 'week') goToTodaysWeek();
  render();
})();

// Home-screen apps stay alive in the background: coming back after a while also returns to today.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (isHomeScreenApp() && hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000 && !$('#modal-root').innerHTML) {
    goToTodaysWeek();
    ui.anim = 'view-enter';
    render();
  }
});
