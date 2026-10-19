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
export const thisMonth = () => todayStr().slice(0, 7);

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
export const monthLabel = (ym) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;

// This week = Sunday..Saturday (same as the calendar), in KST.
export function weekRange() {
  const today = todayStr();
  const dow = new Date(today + 'T00:00:00Z').getUTCDay();
  const start = dayNum(today) - dow;
  return [fromDayNum(start), fromDayNum(start + 6)];
}

export function periodOptions(sentences) {
  const months = [...new Set(sentences.map((s) => s.date.slice(0, 7)))].sort().reverse();
  const opts = [
    { value: 'all', label: '전체' },
    { value: 'week', label: '이번 주' },
    { value: 'this', label: '이번 달' },
  ];
  for (const m of months) opts.push({ value: m, label: monthLabel(m) });
  return opts;
}

export function filterByPeriod(sentences, period) {
  if (period === 'all') return sentences;
  if (period === 'week') {
    const [from, to] = weekRange();
    return sentences.filter((s) => s.date >= from && s.date <= to);
  }
  const ym = period === 'this' ? thisMonth() : period;
  return sentences.filter((s) => s.date.startsWith(ym));
}

export function periodSelectHtml(id, sentences, selected) {
  const opts = periodOptions(sentences);
  if (!opts.some((o) => o.value === selected)) selected = 'all';
  return `<select id="${id}">${opts
    .map((o) => `<option value="${o.value}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('')}</select>`;
}

export function periodLabel(period) {
  if (period === 'all') return '전체';
  if (period === 'week') return '이번 주';
  if (period === 'this') return '이번 달';
  return monthLabel(period);
}

// Answer matching: ignore case, spaces and punctuation (Unicode letters/digits only).
export const normalizeAnswer = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// A sentence is a "wrong note" when its cumulative wrong rate is 10% or more.
export const WRONG_RATE = 0.1;
export const isWrongNote = (stat) => !!stat && stat.tries > 0 && stat.wrong / stat.tries >= WRONG_RATE;
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
