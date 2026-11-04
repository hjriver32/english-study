export const PEOPLE = {
  wng: { key: 'wng', name: 'WNG', color: 'var(--wng)' },
  ranie: { key: 'ranie', name: 'RANIE', color: 'var(--ranie)' },
};

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const KST_MS = 9 * 3600 * 1000;
const kst = (ms = Date.now()) => new Date(ms + KST_MS);

export const todayStr = () => kst().toISOString().slice(0, 10);
export const nowIso = () => kst().toISOString().slice(0, 19) + '+09:00';

export const newId = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

const dayNum = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
const fromDayNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- streak ----
export function calcStreak(dates) {
  const days = [...new Set(dates)].sort();
  if (!days.length) return { current: 0, best: 0, doneToday: false };
  const set = new Set(days);
  const today = todayStr();
  const doneToday = set.has(today);
  const yesterday = fromDayNum(dayNum(today) - 1);
  let current = 0;
  let cursor = doneToday ? today : set.has(yesterday) ? yesterday : null;
  while (cursor && set.has(cursor)) {
    current++;
    cursor = fromDayNum(dayNum(cursor) - 1);
  }
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = dayNum(days[i]) - dayNum(days[i - 1]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return { current, best, doneToday };
}

// ---- period filter ----
// A period is { unit: 'all' | 'day' | 'week' | 'month', anchor: 'YYYY-MM-DD' }.
// day = that date, week = Sunday..Saturday containing the anchor (same as the calendar), month = calendar month containing the anchor.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad2 = (n) => String(n).padStart(2, '0');
const dowOf = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const mdw = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}(${WEEKDAYS[dowOf(s)]})`;

export function periodRange(unit, anchor) {
  if (unit === 'all') return null;
  if (unit === 'day') return [anchor, anchor];
  if (unit === 'week') {
    const start = dayNum(anchor) - dowOf(anchor);
    return [fromDayNum(start), fromDayNum(start + 6)];
  }
  const [y, m] = anchor.split('-').map(Number);
  return [`${y}-${pad2(m)}-01`, `${y}-${pad2(m)}-${pad2(new Date(Date.UTC(y, m, 0)).getUTCDate())}`];
}

export function filterByPeriod(sentences, { unit, anchor }) {
  const r = periodRange(unit, anchor);
  return r ? sentences.filter((s) => s.date >= r[0] && s.date <= r[1]) : sentences;
}

export function periodLabel({ unit, anchor }) {
  if (unit === 'all') return '전체';
  const [from, to] = periodRange(unit, anchor);
  if (unit === 'day') return `${Number(from.slice(0, 4))}년 ${Number(from.slice(5, 7))}월 ${Number(from.slice(8, 10))}일 (${WEEKDAYS[dowOf(from)]})`;
  if (unit === 'week') return `${mdw(from)} ~ ${mdw(to)}`;
  return `${Number(from.slice(0, 4))}년 ${Number(from.slice(5, 7))}월`;
}

function shiftAnchor(unit, anchor, dir) {
  if (unit === 'day') return fromDayNum(dayNum(anchor) + dir);
  if (unit === 'week') return fromDayNum(dayNum(anchor) + 7 * dir);
  const [y, m] = anchor.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10);
}

// Renders "전체 / 하루 / 일주일 / 한달" + ‹ date › into host and keeps `state` ({unit, anchor}) up to date.
export function mountPeriodControl(host, state, onChange) {
  const UNITS = [['all', '전체'], ['day', '하루'], ['week', '일주일'], ['month', '한달']];
  const draw = () => {
    host.innerHTML = `
      <div class="seg" data-role="unit">${UNITS.map(([v, l]) => `<button data-unit="${v}" class="${state.unit === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${state.unit === 'all' ? '' : `
        <div class="range-nav">
          <button class="icon-btn" data-nav="-1" aria-label="이전">‹</button>
          <input type="date" value="${state.anchor}" aria-label="기준 날짜">
          <button class="icon-btn" data-nav="1" aria-label="다음">›</button>
        </div>
        <div class="range-label">${esc(periodLabel(state))}</div>`}`;
  };
  const changed = () => { draw(); onChange(); };
  host.onclick = (e) => {
    const u = e.target.closest('[data-unit]');
    const n = e.target.closest('[data-nav]');
    if (u) { state.unit = u.dataset.unit; changed(); }
    else if (n) { state.anchor = shiftAnchor(state.unit, state.anchor, Number(n.dataset.nav)); changed(); }
  };
  host.onchange = (e) => {
    if (e.target.type === 'date' && e.target.value) { state.anchor = e.target.value; changed(); }
  };
  draw();
}

// Answer matching: ignore case, spaces and punctuation (Unicode letters/digits only).
export const normalizeAnswer = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// A sentence is a "wrong note" (and appears in the wrong-review quiz) while its cumulative wrong rate is 25% or more.
// e.g. 1/1=100%, 1/2=50%, 1/3=33%, 1/4=25% still count; 1/5=20% drops out.
export const WRONG_RATE = 0.25;
export const isWrongNote = (stat) => !!stat && stat.tries > 0 && stat.wrong / stat.tries >= WRONG_RATE;
// How many times the sentence has been asked. `seen` survives rate resets; older records only have `tries`.
export const seenCount = (stat) => (stat ? stat.seen ?? stat.tries ?? 0 : 0);
export const wrongLabel = (stat) => `${stat.wrong}/${stat.tries} (${Math.round((stat.wrong / stat.tries) * 100)}%)`;

// newest first
export const sortNewest = (list) =>
  list.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

export function highlight(text, q) {
  if (!q) return esc(text);
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  let out = '';
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(ql, i);
    if (at < 0) {
      out += esc(text.slice(i));
      break;
    }
    out += esc(text.slice(i, at)) + '<mark>' + esc(text.slice(at, at + q.length)) + '</mark>';
    i = at + q.length;
  }
  return out;
}

export function toast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
