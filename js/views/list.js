import * as store from '../store.js';
import { esc, highlight, sortNewest, filterByPeriod, periodSelectHtml, periodLabel, toast } from '../utils.js';

const state = { period: 'all', q: '' };

export async function render(el, { person, query, isStale }) {
  el.innerHTML = '<p class="muted">불러오는 중…</p>';
  let sentences;
  try {
    sentences = await store.load(person.key, true);
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }
  if (isStale()) return;

  let date = query.get('date') || '';
  let editing = null;
  let open = null;

  el.innerHTML = `
    <section class="card filters">
      <div class="row">${periodSelectHtml('period', sentences, state.period)}</div>
      <input id="q" type="search" placeholder="영어 또는 한글 검색" value="${esc(state.q)}" autocomplete="off">
      <div id="date-chip"></div>
    </section>
    <div id="count" class="muted count"></div>
    <div id="results" class="list"></div>`;

  const periodSel = el.querySelector('#period');
  periodSel.value = state.period in { all: 1, this: 1 } || [...periodSel.options].some((o) => o.value === state.period) ? state.period : 'all';
  state.period = periodSel.value;

  const draw = () => {
    el.querySelector('#date-chip').innerHTML = date
      ? `<button class="chip" id="clear-date">📅 ${esc(date)} ✕</button>`
      : '';
    let list = date ? sentences.filter((s) => s.date === date) : filterByPeriod(sentences, state.period);
    const q = state.q.trim();
    if (q) {
      const ql = q.toLowerCase();
      list = list.filter((s) => s.en.toLowerCase().includes(ql) || s.ko.toLowerCase().includes(ql));
    }
    const label = [date || periodLabel(state.period), q ? `'${q}'` : '', `${list.length}문장`].filter(Boolean).join(' · ');
    el.querySelector('#count').textContent = label;

    if (!list.length) {
      el.querySelector('#results').innerHTML = '<p class="muted">문장이 없어요.</p>';
      return;
    }
    const groups = new Map();
    for (const s of sortNewest(list)) {
      if (!groups.has(s.date)) groups.set(s.date, []);
      groups.get(s.date).push(s);
    }
    let html = '';
    for (const [d, items] of groups) {
      html += `<h3 class="date-head">${esc(d)} <span>${items.length}</span></h3>`;
      for (const s of items) {
        if (editing === s.id) {
          html += `<article class="item editing" data-id="${s.id}">
            <textarea class="e-en" rows="2">${esc(s.en)}</textarea>
            <textarea class="e-ko" rows="2">${esc(s.ko)}</textarea>
            <div class="actions"><button class="btn primary" data-act="save">저장</button><button class="btn" data-act="cancel">취소</button></div>
          </article>`;
        } else {
          html += `<article class="item${open === s.id ? ' open' : ''}" data-id="${s.id}">
            <div class="en">${highlight(s.en, q)}</div><div class="ko">${highlight(s.ko, q)}</div>
            ${open === s.id ? '<div class="actions"><button class="btn" data-act="edit">수정</button><button class="btn danger" data-act="delete">삭제</button></div>' : ''}
          </article>`;
        }
      }
    }
    el.querySelector('#results').innerHTML = html;
  };
  draw();

  periodSel.addEventListener('change', () => { state.period = periodSel.value; date = ''; draw(); });
  el.querySelector('#q').addEventListener('input', (e) => { state.q = e.target.value; draw(); });
  el.addEventListener('click', async (e) => {
    if (e.target.id === 'clear-date') { date = ''; history.replaceState(null, '', `#/${person.key}/list`); draw(); return; }
    const item = e.target.closest('.item');
    if (!item) return;
    const id = item.dataset.id;
    const act = e.target.dataset.act;
    if (!act) {
      if (editing) return;
      open = open === id ? null : id;
      draw();
      return;
    }
    if (act === 'edit') { editing = id; draw(); }
    else if (act === 'cancel') { editing = null; draw(); }
    else if (act === 'save') {
      const en = item.querySelector('.e-en').value.trim();
      const ko = item.querySelector('.e-ko').value.trim();
      if (!en || !ko) { toast('영어와 한글을 모두 입력해 주세요.'); return; }
      e.target.disabled = true;
      e.target.textContent = '저장 중…';
      try {
        sentences = await store.update(person.key, id, { en, ko });
        editing = null;
        toast('수정했어요 ✅');
      } catch (err) { toast(err.message, 4000); }
      draw();
    } else if (act === 'delete') {
      if (!confirm('이 문장을 삭제할까요?')) return;
      e.target.disabled = true;
      try {
        sentences = await store.remove(person.key, id);
        open = null;
        toast('삭제했어요');
      } catch (err) { toast(err.message, 4000); }
      draw();
    }
  });
}
