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

  const drawToday = (items) => {
    const today = sortNewest(items.filter((s) => s.date === todayStr()));
    el.querySelector('#today-count').textContent = `(${today.length})`;
    el.querySelector('#today-list').innerHTML = today.length
      ? today.map((s) => `<article class="item"><div class="en">${esc(s.en)}</div><div class="ko">${esc(s.ko)}</div></article>`).join('')
      : `<p class="muted">아직 오늘 등록한 ${L.unit}이(가) 없어요.</p>`;
  };

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
