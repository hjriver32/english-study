import * as store from '../store.js';
import { esc, todayStr, sortNewest, toast } from '../utils.js';

export async function render(el, { person, isStale }) {
  el.innerHTML = `
    <section class="card">
      <label class="field">영어 문장
        <textarea id="en" rows="2" placeholder="How have you been?" autocapitalize="sentences" autocomplete="off"></textarea>
      </label>
      <label class="field">한글 해석
        <textarea id="ko" rows="2" placeholder="어떻게 지냈어?" autocomplete="off"></textarea>
      </label>
      <button id="save" class="btn primary block" disabled>저장</button>
    </section>
    <h2 class="section-title">오늘 등록한 문장 <span id="today-count"></span></h2>
    <div id="today-list" class="list"><p class="muted">불러오는 중…</p></div>`;

  const en = el.querySelector('#en');
  const ko = el.querySelector('#ko');
  const save = el.querySelector('#save');
  const refreshBtn = () => (save.disabled = !(en.value.trim() && ko.value.trim()));
  en.addEventListener('input', refreshBtn);
  ko.addEventListener('input', refreshBtn);

  const drawToday = (sentences) => {
    const today = sortNewest(sentences.filter((s) => s.date === todayStr()));
    el.querySelector('#today-count').textContent = `(${today.length})`;
    el.querySelector('#today-list').innerHTML = today.length
      ? today.map((s) => `<article class="item"><div class="en">${esc(s.en)}</div><div class="ko">${esc(s.ko)}</div></article>`).join('')
      : '<p class="muted">아직 오늘 등록한 문장이 없어요.</p>';
  };

  try {
    const sentences = await store.load(person.key, true);
    if (isStale()) return;
    drawToday(sentences);
  } catch (e) {
    el.querySelector('#today-list').innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }

  save.addEventListener('click', async () => {
    const text = { en: en.value.trim(), ko: ko.value.trim() };
    if (!text.en || !text.ko) return;
    save.disabled = true;
    save.textContent = '저장 중…';
    try {
      await store.add(person.key, text);
      en.value = '';
      ko.value = '';
      drawToday(await store.load(person.key));
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
