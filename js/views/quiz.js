import * as store from '../store.js';
import { esc, shuffle, filterByPeriod, periodSelectHtml } from '../utils.js';

const KEY = 'es.quiz';
const loadPrefs = () => {
  try { return { dir: 'ko-en', period: 'all', count: 'all', ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { dir: 'ko-en', period: 'all', count: 'all' }; }
};
const savePrefs = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };

export async function render(el, { person, isStale }) {
  el.innerHTML = '<p class="muted">불러오는 중…</p>';
  let sentences;
  try {
    sentences = await store.load(person.key, true);
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }
  if (isStale()) return;
  const prefs = loadPrefs();

  const setup = () => {
    const pool = filterByPeriod(sentences, prefs.period);
    const n = pool.length;
    const counts = [];
    for (let c = 10; c < n; c += 10) counts.push(c);
    if (prefs.count !== 'all' && !counts.includes(Number(prefs.count))) prefs.count = 'all';

    el.innerHTML = `
      <section class="card">
        <h2 class="section-title">방향</h2>
        <div class="seg" id="dir">
          <button data-v="ko-en" class="${prefs.dir === 'ko-en' ? 'on' : ''}">한글 → 영어</button>
          <button data-v="en-ko" class="${prefs.dir === 'en-ko' ? 'on' : ''}">영어 → 한글</button>
        </div>
        <h2 class="section-title">출제 기간</h2>
        ${periodSelectHtml('period', sentences, prefs.period)}
        <p class="muted">이 기간 문장 ${n}개</p>
        <h2 class="section-title">문제 수</h2>
        <div class="seg wrap" id="count">
          <button data-v="all" class="${prefs.count === 'all' ? 'on' : ''}">전체 (${n})</button>
          ${counts.map((c) => `<button data-v="${c}" class="${Number(prefs.count) === c ? 'on' : ''}">${c}</button>`).join('')}
        </div>
        <button id="start" class="btn primary block" ${n ? '' : 'disabled'}>${n ? '시작' : '문장이 없어요'}</button>
      </section>`;

    el.querySelector('#dir').onclick = (e) => { if (e.target.dataset.v) { prefs.dir = e.target.dataset.v; savePrefs(prefs); setup(); } };
    el.querySelector('#count').onclick = (e) => { if (e.target.dataset.v) { prefs.count = e.target.dataset.v; savePrefs(prefs); setup(); } };
    el.querySelector('#period').onchange = (e) => { prefs.period = e.target.value; prefs.count = 'all'; savePrefs(prefs); setup(); };
    el.querySelector('#start').onclick = () => {
      const total = prefs.count === 'all' ? n : Math.min(Number(prefs.count), n);
      play(shuffle(pool).slice(0, total));
    };
  };

  const play = (deck) => {
    let i = 0;
    let shown = false;
    const [qk, ak] = prefs.dir === 'ko-en' ? ['ko', 'en'] : ['en', 'ko'];
    const draw = () => {
      const s = deck[i];
      el.innerHTML = `
        <div class="progress"><span>${i + 1} / ${deck.length}</span><div class="bar"><i style="width:${((i + 1) / deck.length) * 100}%"></i></div></div>
        <section class="card quiz-card">
          <div class="q-label">${qk === 'ko' ? '한글' : '영어'}</div>
          <div class="q-text">${esc(s[qk])}</div>
          <div class="a-box ${shown ? 'shown' : ''}">
            ${shown ? `<div class="q-label">${ak === 'ko' ? '한글' : '영어'}</div><div class="q-text">${esc(s[ak])}</div>` : ''}
          </div>
          ${shown ? '' : '<button id="reveal" class="btn primary block">정답 보기</button>'}
        </section>
        <div class="nav-row">
          <button id="prev" class="btn" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
          <button id="next" class="btn ${shown ? 'primary' : ''}">${i === deck.length - 1 ? '끝내기' : '다음 ▶'}</button>
        </div>`;
      const r = el.querySelector('#reveal');
      if (r) r.onclick = () => { shown = true; draw(); };
      el.querySelector('#prev').onclick = () => { i--; shown = false; draw(); };
      el.querySelector('#next').onclick = () => { if (i === deck.length - 1) done(deck); else { i++; shown = false; draw(); } };
    };
    draw();
  };

  const done = (deck) => {
    el.innerHTML = `
      <section class="card center">
        <div class="big">🎉</div>
        <h2>${deck.length}문제 완료!</h2>
        <button id="again" class="btn primary block">같은 설정으로 다시</button>
        <button id="reset" class="btn block">설정 바꾸기</button>
      </section>`;
    el.querySelector('#again').onclick = () => {
      const pool = filterByPeriod(sentences, prefs.period);
      const total = prefs.count === 'all' ? pool.length : Math.min(Number(prefs.count), pool.length);
      play(shuffle(pool).slice(0, total));
    };
    el.querySelector('#reset').onclick = setup;
  };

  setup();
}
