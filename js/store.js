import { readJson, writeJson, ApiError } from './github.js';
import { newId, nowIso, todayStr } from './utils.js';

const cache = {}; // person -> sentences[]
const quizCache = {}; // person -> { days: { 'YYYY-MM-DD': {...} }, stats: { [sentenceId]: { tries, wrong } } }
const pathOf = (p) => `data/${p}.json`;
const quizPathOf = (p) => `data/${p}-quiz.json`;

export async function load(person, force = false) {
  if (!force && cache[person]) return cache[person];
  const { data } = await readJson(pathOf(person));
  cache[person] = data.sentences || [];
  return cache[person];
}

export async function loadQuiz(person, force = false) {
  if (!force && quizCache[person]) return quizCache[person];
  const { data } = await readJson(quizPathOf(person));
  quizCache[person] = { days: data.days || {}, stats: data.stats || {} };
  return quizCache[person];
}

export const loadQuizDays = async (person, force = false) => (await loadQuiz(person, force)).days;

export const invalidate = () => {
  for (const k of Object.keys(cache)) delete cache[k];
  for (const k of Object.keys(quizCache)) delete quizCache[k];
};

// Always re-reads the latest file, applies fn to the whole file, then writes.
// Retries on conflicts so edits from both phones merge. Unknown keys in the file are preserved.
async function mutateFile(path, fn, message) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, sha } = await readJson(path);
    const next = fn(data);
    try {
      await writeJson(path, next, sha, message);
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && attempt < 3) continue;
      throw e;
    }
  }
}

async function mutate(person, fn, message) {
  const next = await mutateFile(pathOf(person), (d) => ({ ...d, version: 1, sentences: fn(d.sentences || []) }), message);
  cache[person] = next.sentences;
  return next.sentences;
}

export const add = (person, { en, ko }) => {
  const t = nowIso();
  const item = { id: newId(), en, ko, date: todayStr(), createdAt: t, updatedAt: t };
  return mutate(person, (l) => [...l, item], `add: ${person}`).then(() => item);
};

export const update = (person, id, { en, ko }) =>
  mutate(person, (l) => l.map((s) => (s.id === id ? { ...s, en, ko, updatedAt: nowIso() } : s)), `edit: ${person}`);

export const remove = (person, id) =>
  mutate(person, (l) => l.filter((s) => s.id !== id), `delete: ${person}`);

// Marks today as done because a quiz question was answered. Returns true if newly marked.
export async function markQuizDay(person) {
  const today = todayStr();
  const days = await loadQuizDays(person);
  if (days[today]) return false;
  const next = await mutateFile(
    quizPathOf(person),
    (d) => ({ ...d, version: 1, days: { ...(d.days || {}), [today]: (d.days || {})[today] || { at: nowIso() } } }),
    `quiz: ${person}`,
  );
  quizCache[person] = { days: next.days, stats: next.stats || quizCache[person]?.stats || {} };
  return true;
}

// results: [{ id, correct }] — final result of each answered question in a quiz set.
export async function recordResults(person, results) {
  if (!results.length) return (await loadQuiz(person)).stats;
  const next = await mutateFile(
    quizPathOf(person),
    (d) => {
      const stats = { ...(d.stats || {}) };
      for (const r of results) {
        const s = stats[r.id] || { tries: 0, wrong: 0 };
        stats[r.id] = { tries: s.tries + 1, wrong: s.wrong + (r.correct ? 0 : 1), last: nowIso() };
      }
      return { ...d, version: 1, stats };
    },
    `quiz-stats: ${person}`,
  );
  quizCache[person] = { days: next.days || quizCache[person]?.days || {}, stats: next.stats };
  return next.stats;
}
