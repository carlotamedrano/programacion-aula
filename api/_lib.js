// Código compartido por las funciones del servidor (los archivos con _ no son rutas).
import { get, put, list, del } from '@vercel/blob';
import { createHash, timingSafeEqual } from 'node:crypto';

export const PATH = 'progaula/estado.json';
const COPIAS = 'progaula/copias/';
const MAX_COPIAS = 30;
const CADA = 6 * 3600 * 1000; // copia automática como mucho cada 6 horas

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const sha = (x) => createHash('sha256').update(String(x)).digest();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function check(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return json({ error: 'sin_clave' }, 500);
  if (!timingSafeEqual(sha(req.headers.get('x-clave') || ''), sha(expected))) {
    await wait(800);
    return json({ error: 'clave' }, 401);
  }
  return null;
}

async function readPath(path) {
  const r = await get(path, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const p = JSON.parse(await new Response(r.stream).text());
  if (p && typeof p.rev === 'number' && p.data && typeof p.data === 'object') return { rev: p.rev, data: p.data, bk: p.bk || 0 };
  return { rev: 0, data: p, bk: 0 }; // formato antiguo, sin número de versión
}

export const read = () => readPath(PATH);

export async function write(state) {
  const text = JSON.stringify(state);
  if (text.length > 3_000_000) throw Object.assign(new Error('demasiado_grande'), { code: 413 });
  await put(PATH, text, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

// Guarda una copia del estado actual y borra las más antiguas.
export async function backup(cur) {
  if (!cur || !cur.data) return;
  await put(`${COPIAS}${stamp()}.json`, JSON.stringify({ rev: cur.rev, data: cur.data }), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
  });
  const all = await listBackups();
  const extra = all.slice(MAX_COPIAS);
  if (extra.length) await del(extra.map((b) => b.url));
}

export async function backupIfDue(cur) {
  if (!cur || Date.now() - (cur.bk || 0) < CADA) return cur ? cur.bk || 0 : 0;
  try { await backup(cur); return Date.now(); } catch (e) { console.error('copia', e); return cur.bk || 0; }
}

export async function listBackups() {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: COPIAS, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
}

export const readBackup = (id) => readPath(COPIAS + id);
export const validId = (id) => typeof id === 'string' && /^[\w.-]+\.json$/.test(id);
export const idOf = (b) => b.pathname.slice(COPIAS.length);
