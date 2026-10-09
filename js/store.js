import { readJson, writeJson, ApiError } from './github.js';
import { newId, nowIso, todayStr } from './utils.js';

const cache = {}; // person -> sentences[]
const pathOf = (p) => `data/${p}.json`;

export async function load(person, force = false) {
  if (!force && cache[person]) return cache[person];
  const { data } = await readJson(pathOf(person));
  cache[person] = data.sentences || [];
  return cache[person];
}

export const invalidate = () => { for (const k of Object.keys(cache)) delete cache[k]; };

// Always re-reads the latest file, applies fn, then writes. Retries on conflicts so edits from both phones merge.
async function mutate(person, fn, message) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, sha } = await readJson(pathOf(person));
    const sentences = data.sentences || [];
    const next = fn(sentences);
    try {
      await writeJson(pathOf(person), { version: 1, sentences: next }, sha, message);
      cache[person] = next;
      return next;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && attempt < 3) continue;
      throw e;
    }
  }
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
