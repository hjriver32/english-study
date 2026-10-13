import * as store from '../store.js';
import { PEOPLE, esc, todayStr, calcStreak } from '../utils.js';

const pad = (n) => String(n).padStart(2, '0');

function calendarHtml(key, sentences, quizDays, ym) {
  const [y, m] = ym.split('-').map(Number);
  const counts = {};
  for (const s of sentences) counts[s.date] = (counts[s.date] || 0) + 1;
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = todayStr();
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span class="day empty"></span>';
  for (let d = 1; d <= days; d++) {
    const ds = `${y}-${pad(m)}-${pad(d)}`;
    const c = counts[ds] || 0;
    const quizOnly = !c && !!quizDays[ds];
    const lvl = quizOnly ? 1 : c === 0 ? 0 : c < 3 ? 1 : c < 6 ? 2 : 3;
    const cls = `day lvl${lvl}${quizOnly ? ' quizonly' : ''}${ds === today ? ' today' : ''}`;
    cells += c
      ? `<a class="${cls}" href="#/${key}/list?date=${ds}" title="${c}문장">${d}</a>`
      : `<span class="${cls}"${quizOnly ? ' title="퀴즈 완료"' : ''}>${d}</span>`;
  }
  return `<div class="cal-head">
      <button class="icon-btn" data-nav="-1" data-key="${key}" aria-label="이전 달">‹</button>
      <strong>${y}년 ${m}월</strong>
      <button class="icon-btn" data-nav="1" data-key="${key}" aria-label="다음 달">›</button>
    </div>
    <div class="cal-grid">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<span class="wd">${w}</span>`).join('')}${cells}</div>`;
}

export async function render(el, { isStale }) {
  el.innerHTML = `
    <header class="topbar"><h1>영어공부</h1><a class="icon-btn" href="#/settings" aria-label="설정">⚙️</a></header>
    <main class="page"><p class="muted">불러오는 중…</p></main>`;
  const main = el.querySelector('main');

  let data;
  let quizData;
  try {
    const keys = Object.keys(PEOPLE);
    const lists = await Promise.all(keys.map((k) => store.load(k, true)));
    const quiz = await Promise.all(keys.map((k) => store.loadQuizDays(k, true)));
    data = Object.fromEntries(keys.map((k, i) => [k, lists[i]]));
    quizData = Object.fromEntries(keys.map((k, i) => [k, quiz[i]]));
  } catch (e) {
    main.innerHTML = `<p class="error">${esc(e.message)}</p><button class="btn" onclick="location.reload()">다시 시도</button>`;
    return;
  }
  if (isStale()) return;

  const months = Object.fromEntries(Object.keys(PEOPLE).map((k) => [k, todayStr().slice(0, 7)]));

  const draw = () => {
    main.innerHTML = Object.values(PEOPLE).map((p) => {
      const list = data[p.key];
      const st = calcStreak([...list.map((s) => s.date), ...Object.keys(quizData[p.key])]);
      const status = st.doneToday
        ? '<span class="badge ok">✅ 오늘 완료</span>'
        : `<span class="badge">⏳ 아직${st.current ? ` · 오늘 등록하면 ${st.current + 1}일!` : ''}</span>`;
      return `<section class="card person-card" style="--accent:${p.color}">
        <div class="pc-head">
          <h2>${esc(p.name)}</h2>
          <a class="btn small primary" href="#/${p.key}/add">페이지로 가기</a>
        </div>
        <div class="stats">
          <div><b>${list.length}</b><small>누적 문장</small></div>
          <div><b>🔥 ${st.current}</b><small>연속 일</small></div>
          <div><b>${st.best}</b><small>최장 연속</small></div>
        </div>
        <div>${status}</div>
        <div class="cal" data-key="${p.key}">${calendarHtml(p.key, list, quizData[p.key], months[p.key])}</div>
      </section>`;
    }).join('');
  };
  draw();

  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-nav]');
    if (!b) return;
    const key = b.dataset.key;
    const [y, m] = months[key].split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.nav), 1));
    months[key] = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    main.querySelector(`.cal[data-key="${key}"]`).innerHTML = calendarHtml(key, data[key], quizData[key], months[key]);
  });
}
