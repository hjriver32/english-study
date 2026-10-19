import * as store from '../store.js';
import { esc, shuffle, filterByPeriod, periodSelectHtml, normalizeAnswer, toast, isWrongNote } from '../utils.js';

const KEY = 'es.quiz';
const DEFAULTS = { dir: 'ko-en', period: 'all', count: 'all', wrongOnly: false };
const loadPrefs = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
};
const savePrefs = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ } };

export async function render(el, { person, isStale }) {
  el.innerHTML = '<p class="muted">불러오는 중…</p>';
  let sentences;
  let stats = {};
  try {
    sentences = await store.load(person.key, true);
    stats = (await store.loadQuiz(person.key, true)).stats;
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }
  if (isStale()) return;
  const prefs = loadPrefs();

  // Any answered question (check or reveal) counts as today's completion.
  const markDone = () => {
    store.markQuizDay(person.key).then((isNew) => { if (isNew) toast('오늘 완료 인증 ✅'); })
      .catch((e) => toast('인증 기록 저장 실패: ' + e.message, 4000));
  };

  const getPool = () => {
    const byPeriod = filterByPeriod(sentences, prefs.period);
    return prefs.wrongOnly ? byPeriod.filter((s) => isWrongNote(stats[s.id])) : byPeriod;
  };

  const setup = () => {
    const pool = getPool();
    const n = pool.length;
    const wrongTotal = sentences.filter((s) => isWrongNote(stats[s.id])).length;
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
        <h2 class="section-title">오답 복습</h2>
        <div class="seg" id="wrong">
          <button data-v="0" class="${prefs.wrongOnly ? '' : 'on'}">전체 문장</button>
          <button data-v="1" class="${prefs.wrongOnly ? 'on' : ''}">오답만 (${wrongTotal})</button>
        </div>
        <p class="muted">오답률 10% 이상인 문장이 오답으로 분류돼요.</p>
        <p class="muted"><b>조건에 맞는 문장 ${n}개</b></p>
        <h2 class="section-title">문제 수</h2>
        <div class="seg wrap" id="count">
          <button data-v="all" class="${prefs.count === 'all' ? 'on' : ''}">전체 (${n})</button>
          ${counts.map((c) => `<button data-v="${c}" class="${Number(prefs.count) === c ? 'on' : ''}">${c}</button>`).join('')}
        </div>
        <button id="start" class="btn primary block" ${n ? '' : 'disabled'}>${n ? '시작' : prefs.wrongOnly ? '오답 문장이 없어요 🎉' : '문장이 없어요'}</button>
      </section>`;
    el.querySelector('#wrong').onclick = (e) => {
      if (e.target.dataset.v === undefined) return;
      prefs.wrongOnly = e.target.dataset.v === '1';
      prefs.count = 'all';
      savePrefs(prefs);
      setup();
    };

    el.querySelector('#dir').onclick = (e) => { if (e.target.dataset.v) { prefs.dir = e.target.dataset.v; savePrefs(prefs); setup(); } };
    el.querySelector('#count').onclick = (e) => { if (e.target.dataset.v) { prefs.count = e.target.dataset.v; savePrefs(prefs); setup(); } };
    el.querySelector('#period').onchange = (e) => { prefs.period = e.target.value; prefs.count = 'all'; savePrefs(prefs); setup(); };
    el.querySelector('#start').onclick = () => start();
  };

  const start = () => {
    const pool = getPool();
    const total = prefs.count === 'all' ? pool.length : Math.min(Number(prefs.count), pool.length);
    play(shuffle(pool).slice(0, total));
  };

  const play = (deck) => {
    let i = 0;
    const res = deck.map(() => null); // 'c' correct | 'w' wrong | null unanswered
    const typed = deck.map(() => '');
    const retry = deck.map(() => false); // last check was a miss
    const [qk, ak] = prefs.dir === 'ko-en' ? ['ko', 'en'] : ['en', 'ko'];
    const label = (k) => (k === 'ko' ? '한글' : '영어');

    // Final result of each answered question is saved once per set (and when leaving the page mid-set).
    const saved = new Set();
    const flush = () => {
      const batch = deck.map((s, k) => ({ id: s.id, correct: res[k] === 'c', k })).filter((r) => res[r.k] && !saved.has(r.k));
      if (!batch.length) return;
      batch.forEach((r) => saved.add(r.k));
      store.recordResults(person.key, batch.map(({ id, correct }) => ({ id, correct })))
        .then((next) => { stats = next; })
        .catch((e) => { batch.forEach((r) => saved.delete(r.k)); toast('오답 기록 저장 실패: ' + e.message, 4000); });
    };
    window.addEventListener('hashchange', flush, { once: true });

    const draw = () => {
      const s = deck[i];
      const r = res[i];
      const answerBox = r
        ? `<div class="a-box shown">
             <div class="verdict ${r === 'c' ? 'ok' : 'bad'}">${r === 'c' ? '⭕ 정답!' : '❌ 오답'}</div>
             <div class="q-label">정답 (${label(ak)})</div><div class="q-text">${esc(s[ak])}</div>
           </div>`
        : '';
      el.innerHTML = `
        <div class="progress"><span>${i + 1} / ${deck.length}</span><div class="bar"><i style="width:${((i + 1) / deck.length) * 100}%"></i></div></div>
        <section class="card quiz-card">
          <div class="q-label">${label(qk)}</div>
          <div class="q-text">${esc(s[qk])}</div>
          <label class="field">${label(ak)} 문장 입력
            <textarea id="ans" rows="3" ${r ? 'disabled' : ''} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${label(ak)}로 써 보세요">${esc(typed[i])}</textarea>
          </label>
          ${!r && retry[i] ? '<p class="error small-msg">아쉬워요! 다시 써 보거나 정답 보기를 눌러 주세요. (정답 보기는 오답 처리)</p>' : ''}
          ${r ? '' : '<div class="row gap"><button id="check" class="btn primary grow">정답 확인</button><button id="reveal" class="btn grow">정답 보기</button></div>'}
          ${answerBox}
        </section>
        <div class="nav-row">
          <button id="prev" class="btn" ${i === 0 ? 'disabled' : ''}>◀ 이전</button>
          <button id="next" class="btn ${r ? 'primary' : ''}">${i === deck.length - 1 ? '끝내기' : '다음 ▶'}</button>
        </div>`;

      const ans = el.querySelector('#ans');
      ans.oninput = () => { typed[i] = ans.value; };
      const check = el.querySelector('#check');
      if (check) {
        check.onclick = () => {
          typed[i] = ans.value;
          if (!normalizeAnswer(typed[i])) { toast('답을 입력해 주세요.'); return; }
          markDone();
          if (normalizeAnswer(typed[i]) === normalizeAnswer(s[ak])) res[i] = 'c';
          else retry[i] = true;
          draw();
        };
        el.querySelector('#reveal').onclick = () => { typed[i] = ans.value; res[i] = 'w'; markDone(); draw(); };
      }
      el.querySelector('#prev').onclick = () => { i--; draw(); };
      el.querySelector('#next').onclick = () => {
        if (i < deck.length - 1) { i++; draw(); return; }
        const open = res.filter((x) => !x).length;
        if (open && !confirm(`아직 안 푼 문제 ${open}개는 오답으로 처리돼요. 끝낼까요?`)) return;
        flush();
        done(deck, res, ak);
      };
    };
    draw();
  };

  const done = (deck, res, ak) => {
    const correct = res.filter((x) => x === 'c').length;
    const score = Math.round((correct / deck.length) * 100);
    const emoji = score === 100 ? '🏆' : score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪';
    el.innerHTML = `
      <section class="card center">
        <div class="big">${emoji}</div>
        <div class="score">${score}<small>점</small></div>
        <p class="muted">${deck.length}문제 중 ${correct}문제 정답</p>
        <button id="again" class="btn primary block">같은 설정으로 다시</button>
        <button id="reset" class="btn block">설정 바꾸기</button>
      </section>
      <h2 class="section-title">문제별 결과</h2>
      <div class="list">
        ${deck.map((s, k) => `<article class="item ${res[k] === 'c' ? 'right' : 'wrong'}">
          <div class="en">${res[k] === 'c' ? '⭕' : '❌'} ${esc(s.en)}</div><div class="ko">${esc(s.ko)}</div>
        </article>`).join('')}
      </div>`;
    el.querySelector('#again').onclick = start;
    el.querySelector('#reset').onclick = setup;
    window.scrollTo(0, 0);
  };

  setup();
}
