// GitHub Contents API wrapper. Token "demo" switches to a local (browser-only) store for testing.
const OWNER = 'hjriver32';
const REPO = 'english-study-data';
const BRANCH = 'main';
const TOKEN_KEY = 'es.token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const isDemo = () => getToken() === 'demo';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toBase64(str) {
  const bytes = enc.encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return dec.decode(bytes);
}

const url = (path) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
const headers = () => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${getToken()}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

async function check(res) {
  if (res.ok) return res;
  let msg = '';
  try { msg = (await res.json()).message || ''; } catch { /* ignore */ }
  if (res.status === 401) throw new ApiError(401, '토큰이 올바르지 않거나 만료되었어요. 설정에서 다시 입력해 주세요.');
  if (res.status === 403 || res.status === 404) throw new ApiError(res.status, '데이터 저장소에 접근할 수 없어요. 토큰 권한(Contents 읽기/쓰기)과 저장소 선택을 확인해 주세요.');
  if (res.status === 409 || res.status === 422) throw new ApiError(409, '동시에 저장되어 충돌했어요.');
  throw new ApiError(res.status, msg || `요청 실패 (${res.status})`);
}

// returns { data, sha }
export async function readJson(path) {
  if (isDemo()) {
    const raw = localStorage.getItem('es.demo.' + path);
    return { data: raw ? JSON.parse(raw) : { version: 1, sentences: [] }, sha: 'demo' };
  }
  let res;
  try {
    res = await fetch(url(path) + `?ref=${BRANCH}&t=${Date.now()}`, { headers: headers(), cache: 'no-store' });
  } catch {
    throw new ApiError(0, '네트워크에 연결할 수 없어요.');
  }
  if (res.status === 404) {
    // file may not exist yet -> treat as empty only if repo is reachable
    const probe = await fetch(url('') .replace(/\/$/, '') + `?ref=${BRANCH}`, { headers: headers(), cache: 'no-store' });
    await check(probe);
    return { data: { version: 1, sentences: [] }, sha: null };
  }
  await check(res);
  const json = await res.json();
  return { data: JSON.parse(fromBase64(json.content)), sha: json.sha };
}

export async function writeJson(path, data, sha, message) {
  if (isDemo()) {
    localStorage.setItem('es.demo.' + path, JSON.stringify(data));
    return { sha: 'demo' };
  }
  const body = { message, content: toBase64(JSON.stringify(data, null, 1)), branch: BRANCH };
  if (sha) body.sha = sha;
  let res;
  try {
    res = await fetch(url(path), { method: 'PUT', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, '네트워크에 연결할 수 없어요.');
  }
  await check(res);
  const json = await res.json();
  return { sha: json.content.sha };
}
