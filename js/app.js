import { PEOPLE, KINDS, esc } from './utils.js';
import { getToken } from './github.js';
import { render as dashboard } from './views/dashboard.js';
import { render as addView } from './views/add.js';
import { render as listView } from './views/list.js';
import { render as quizView } from './views/quiz.js';
import { render as settingsView } from './views/settings.js';

const app = document.getElementById('app');
const TABS = [
  { key: 'add', label: '입력', view: addView },
  { key: 'list', label: '목록', view: listView },
  { key: 'quiz', label: '퀴즈', view: quizView },
];

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}

let token = 0; // guards against stale async renders

async function route() {
  const my = ++token;
  const { parts, query } = parseHash();
  const [first, second] = parts;

  if (!getToken() && first !== 'settings') {
    location.replace('#/settings');
    return;
  }

  if (!first) {
    app.innerHTML = '';
    await dashboard(app, { isStale: () => my !== token });
  } else if (first === 'settings') {
    app.innerHTML = '';
    await settingsView(app, {});
  } else if (PEOPLE[first]) {
    const person = PEOPLE[first];
    // #/wng/<kind>/<tab>; the older #/wng/<tab> form means sentences
    const kind = KINDS[second] ? second : 'sentence';
    const tabKey = KINDS[second] ? parts[2] : second;
    const tab = TABS.find((t) => t.key === tabKey) || TABS[0];
    app.innerHTML = `
      <header class="topbar person" style="--accent:${person.color}">
        <a class="back" href="#/" aria-label="대시보드">‹</a>
        <h1>${esc(person.name)}</h1>
        <a class="icon-btn" href="#/settings" aria-label="설정">⚙️</a>
      </header>
      <div class="subnav" style="--accent:${person.color}">
        <div class="kinds">
          ${Object.values(KINDS).map((k) => `<a href="#/${person.key}/${k.key}/${tab.key}" class="${k.key === kind ? 'active' : ''}">${k.name}</a>`).join('')}
        </div>
        <nav class="tabs">
          ${TABS.map((t) => `<a href="#/${person.key}/${kind}/${t.key}" class="${t.key === tab.key ? 'active' : ''}">${t.label}</a>`).join('')}
        </nav>
      </div>
      <main id="tab-body" class="page" style="--accent:${person.color}"></main>`;
    await tab.view(document.getElementById('tab-body'), { person, kind, query, isStale: () => my !== token });
  } else {
    location.replace('#/');
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
