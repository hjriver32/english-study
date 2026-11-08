import * as store from '../store.js';
import { esc, todayStr, sortNewest, toast, KINDS, datasetOf } from '../utils.js';

export async function render(el, { person, kind, isStale }) {
  const L = KINDS[kind];
  const ds = datasetOf(kind, person.key);
  el.innerHTML = `
    <section class="card">
      <label class="field">${L.enLabel}
        <textarea id="en" rows="${L.rows}" placeholder="${esc(L.enHint)}" autocapitalize="${kind === 'word' ? 'off' : 'sentences'}" autocomplete="off"></textarea>
      </label>
      <label class="field">${L.koLabel}
        <textarea id="ko" rows="${L.rows}" placeholder="${esc(L.koHint)}" autocomplete="off"></textarea>
      </label>
      <button id="save" class="btn primary block" disabled>저장</button>
    </section>
    <h2 class="section-title">오늘 등록한 ${L.unit} <span id="today-count"></span></h2>
    <div id="today-list" class="list"><p class="muted">불러오는 중…</p></div>`;

  const en = el.querySelector('#en');
  const ko = el.querySelector('#ko');
  const save = el.querySelector('#save');
  const refreshBtn = () => (save.disabled = !(en.value.trim() && ko.value.trim()));
  en.addEventListener('input', refreshBtn);
  ko.addEventListener('input', refreshBtn);

  let items = [];
  let open = null; // item showing the 수정/삭제 buttons
  let editing = null; // item being edited inline

  const drawToday = (all = items) => {
    items = all;
    const today = sortNewest(items.filter((s) => s.date === todayStr()));
    el.querySelector('#today-count').textContent = `(${today.length})`;
    el.querySelector('#today-list').innerHTML = today.length
      ? today.map((s) => (editing === s.id
        ? `<article class="item editing" data-id="${s.id}">
            <textarea class="e-en" rows="${L.rows}">${esc(s.en)}</textarea>
            <textarea class="e-ko" rows="${L.rows}">${esc(s.ko)}</textarea>
            <div class="actions"><button class="btn primary" data-act="save">저장</button><button class="btn" data-act="cancel">취소</button></div>
          </article>`
        : `<article class="item${open === s.id ? ' open' : ''}" data-id="${s.id}">
            <div class="en">${esc(s.en)}</div><div class="ko">${esc(s.ko)}</div>
            ${open === s.id ? '<div class="actions"><button class="btn" data-act="edit">수정</button><button class="btn danger" data-act="delete">삭제</button></div>' : ''}
          </article>`)).join('')
      : `<p class="muted">아직 오늘 등록한 ${L.unit}이(가) 없어요.</p>`;
  };

  el.querySelector('#today-list').addEventListener('click', async (e) => {
    const item = e.target.closest('.item');
    if (!item) return;
    const id = item.dataset.id;
    const act = e.target.dataset.act;
    if (!act) {
      if (editing) return;
      open = open === id ? null : id;
      drawToday();
      return;
    }
    if (act === 'edit') { editing = id; drawToday(); }
    else if (act === 'cancel') { editing = null; drawToday(); }
    else if (act === 'save') {
      const newEn = item.querySelector('.e-en').value.trim();
      const newKo = item.querySelector('.e-ko').value.trim();
      if (!newEn || !newKo) { toast('영어와 한글을 모두 입력해 주세요.'); return; }
      e.target.disabled = true;
      e.target.textContent = '저장 중…';
      try {
        drawToday(await store.update(ds, id, { en: newEn, ko: newKo }));
        editing = null;
        toast('수정했어요 ✅');
      } catch (err) { toast(err.message, 4000); }
      drawToday();
    } else if (act === 'delete') {
      if (!confirm(`이 ${L.unit}을(를) 삭제할까요?`)) return;
      e.target.disabled = true;
      try {
        drawToday(await store.remove(ds, id));
        open = null;
        toast('삭제했어요');
      } catch (err) { toast(err.message, 4000); }
      drawToday();
    }
  });

  try {
    const items = await store.load(ds, true);
    if (isStale()) return;
    drawToday(items);
  } catch (e) {
    el.querySelector('#today-list').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }

  save.addEventListener('click', async () => {
    const text = { en: en.value.trim(), ko: ko.value.trim() };
    if (!text.en || !text.ko) return;
    save.disabled = true;
    save.textContent = '저장 중…';
    try {
      await store.add(ds, text);
      en.value = '';
      ko.value = '';
      drawToday(await store.load(ds));
      toast('저장했어요 ✅');
      en.focus();
    } catch (e) {
      toast(e.message, 4000);
    } finally {
      save.textContent = '저장';
      refreshBtn();
    }
  });
}
