import * as store from '../store.js';
import { getToken, setToken, clearToken, isDemo } from '../github.js';
import { PEOPLE, esc, todayStr, download, toast, datasetOf } from '../utils.js';

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;

export async function render(el) {
  const hasToken = !!getToken();
  el.innerHTML = `
    <header class="topbar">
      ${hasToken ? '<a class="back" href="#/" aria-label="대시보드">‹</a>' : ''}
      <h1>설정</h1><span></span>
    </header>
    <main class="page">
      <section class="card">
        <h2 class="section-title">GitHub 토큰</h2>
        ${hasToken ? `<p class="muted">저장된 토큰: ${isDemo() ? '데모 모드(이 브라우저에만 저장)' : '••••••••' + esc(getToken().slice(-4))}</p>` : '<p class="muted">처음 한 번만 입력하면 이 기기에 저장돼요.</p>'}
        <input id="token" type="password" placeholder="github_pat_..." autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="row gap">
          <button id="save" class="btn primary">저장 및 연결 테스트</button>
          ${hasToken ? '<button id="clear" class="btn danger">토큰 삭제</button>' : ''}
        </div>
        <p id="msg" class="muted"></p>
      </section>
      ${hasToken ? `<section class="card">
        <h2 class="section-title">데이터 백업 내보내기</h2>
        <select id="who"><option value="all">전체</option>${Object.values(PEOPLE).map((p) => `<option value="${p.key}">${esc(p.name)}</option>`).join('')}</select>
        <div class="row gap">
          <button id="json" class="btn">JSON 다운로드</button>
          <button id="csv" class="btn">CSV 다운로드</button>
        </div>
      </section>` : ''}
    </main>`;

  const msg = el.querySelector('#msg');
  el.querySelector('#save').onclick = async () => {
    const t = el.querySelector('#token').value.trim() || getToken();
    if (!t) { msg.textContent = '토큰을 입력해 주세요.'; return; }
    const prev = getToken();
    setToken(t);
    store.invalidate();
    msg.className = 'muted';
    msg.textContent = '연결 중…';
    try {
      const keys = Object.keys(PEOPLE);
      const lists = await Promise.all(keys.map((k) => store.load(k, true)));
      const words = await Promise.all(keys.map((k) => store.load(datasetOf('word', k), true)));
      msg.className = 'ok';
      msg.textContent = '연결 성공 ✅ ' + Object.values(PEOPLE).map((p, i) => `${p.name} 문장 ${lists[i].length} · 단어 ${words[i].length}`).join(', ');
      setTimeout(() => (location.hash = '#/'), 900);
    } catch (e) {
      if (prev) setToken(prev); else clearToken();
      msg.className = 'error';
      msg.textContent = e.message;
    }
  };

  const clear = el.querySelector('#clear');
  if (clear) clear.onclick = () => {
    if (!confirm('이 기기에서 토큰을 삭제할까요?')) return;
    clearToken();
    store.invalidate();
    location.hash = '#/settings';
    location.reload();
  };

  const exportData = async (fmt) => {
    const who = el.querySelector('#who').value;
    const keys = who === 'all' ? Object.keys(PEOPLE) : [who];
    try {
      const rows = {};
      const words = {};
      for (const k of keys) {
        rows[k] = await store.load(k, true);
        words[k] = await store.load(datasetOf('word', k), true);
      }
      const day = todayStr();
      if (fmt === 'json') {
        const quizDays = {};
        for (const k of keys) quizDays[k] = await store.loadQuizDays(k, true);
        download(`english-study-backup-${day}.json`, JSON.stringify({ exportedAt: day, people: rows, words, quizDays }, null, 2), 'application/json');
      } else {
        const lines = ['사람,날짜,영어,한글,구분'];
        const byTime = (a, b) => (a.createdAt < b.createdAt ? -1 : 1);
        for (const k of keys) {
          for (const s of [...rows[k]].sort(byTime)) lines.push([PEOPLE[k].name, s.date, s.en, s.ko, '문장'].map(csvCell).join(','));
          for (const s of [...words[k]].sort(byTime)) lines.push([PEOPLE[k].name, s.date, s.en, s.ko, '단어'].map(csvCell).join(','));
        }
        download(`english-study-backup-${day}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
      }
      toast('내보냈어요');
    } catch (e) {
      toast(e.message, 4000);
    }
  };
  const j = el.querySelector('#json');
  if (j) { j.onclick = () => exportData('json'); el.querySelector('#csv').onclick = () => exportData('csv'); }
}
