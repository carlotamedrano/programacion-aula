// Código compartido por las funciones del servidor (los archivos con _ no son rutas).
import { get, put, list, del } from '@vercel/blob';
import { createHash, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';

const USERS = 'progaula/usuarios.json';
const CAL = 'progaula/calendario.json';
const MAX_COPIAS = 30;
const CADA = 6 * 3600 * 1000; // copia automática como mucho cada 6 horas

// Carlota conserva las rutas de siempre; el resto de cuentas, cada una en su carpeta.
const base = (id) => (id === 'carlota' ? 'progaula/' : `progaula/u/${id}/`);
const statePath = (id) => base(id) + 'estado.json';
const copiasPath = (id) => base(id) + 'copias/';

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const sha = (x) => createHash('sha256').update(String(x)).digest();
const same = (a, b) => timingSafeEqual(sha(a), sha(b));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const opts = { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 };

async function readJson(path) {
  const r = await get(path, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

// ---------- Cuentas ----------
export const validId = (id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{1,19}$/.test(id);
export const hashPw = (pw, salt) => scryptSync(String(pw), salt, 32).toString('hex');
export const newSalt = () => randomBytes(16).toString('hex');

export async function readUsers() {
  const db = await readJson(USERS);
  return db && db.users ? db : { users: { carlota: { name: 'Carlota', admin: true, ai: true, env: true } } };
}
export const writeUsers = (db) => put(USERS, JSON.stringify(db), opts);

// Comprueba usuario (x-user) y contraseña (x-clave). Sin x-user se entiende Carlota (versiones antiguas de la app).
export async function auth(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return { res: json({ error: 'sin_clave' }, 500) };
  const id = String(req.headers.get('x-user') || 'carlota').trim().toLowerCase();
  const pw = req.headers.get('x-clave') || '';
  const db = await readUsers();
  const u = db.users[id];
  let ok = false;
  if (u && !u.off) ok = u.env ? same(pw, expected) : !!u.hash && same(hashPw(pw, u.salt), u.hash);
  if (!ok) {
    await wait(800);
    return { res: json({ error: 'clave' }, 401) };
  }
  return { user: { id, name: u.name, admin: !!u.admin, ai: !!u.ai, env: !!u.env }, db };
}

// ---------- Estado de cada profesor ----------
async function readState(path) {
  const p = await readJson(path);
  if (!p) return null;
  if (typeof p.rev === 'number' && p.data && typeof p.data === 'object') return { rev: p.rev, data: p.data, bk: p.bk || 0 };
  return { rev: 0, data: p, bk: 0 }; // formato antiguo, sin número de versión
}
export const read = (id) => readState(statePath(id));

export async function write(id, state) {
  const text = JSON.stringify(state);
  if (text.length > 3_000_000) throw Object.assign(new Error('demasiado_grande'), { code: 413 });
  await put(statePath(id), text, opts);
}

// ---------- Copias de seguridad ----------
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export async function backup(id, cur) {
  if (!cur || !cur.data) return;
  await put(`${copiasPath(id)}${stamp()}.json`, JSON.stringify({ rev: cur.rev, data: cur.data }), opts);
  const all = await listBackups(id);
  const extra = all.slice(MAX_COPIAS);
  if (extra.length) await del(extra.map((b) => b.url));
}

export async function backupIfDue(id, cur) {
  if (!cur || Date.now() - (cur.bk || 0) < CADA) return cur ? cur.bk || 0 : 0;
  try { await backup(id, cur); return Date.now(); } catch (e) { console.error('copia', e); return cur.bk || 0; }
}

export async function listBackups(id) {
  const out = [];
  let cursor;
  const prefix = copiasPath(id);
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs.filter((b) => !b.pathname.slice(prefix.length).includes('/')));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
}

export const readBackup = (id, file) => readState(copiasPath(id) + file);
export const validFile = (f) => typeof f === 'string' && /^[\w.-]+\.json$/.test(f);
export const fileOf = (id, b) => b.pathname.slice(copiasPath(id).length);

// ---------- Calendario común del colegio ----------
const CAL_KEYS = ['off', 'lt', 'hd', 'nt'];
export function cleanCal(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    off: Array.isArray(d.off) ? d.off.filter((x) => typeof x === 'string') : [],
    lt: Array.isArray(d.lt) ? d.lt.filter((x) => typeof x === 'string') : [],
    hd: d.hd && typeof d.hd === 'object' ? d.hd : {},
    nt: d.nt && typeof d.nt === 'object' ? d.nt : {},
  };
}
export async function readCal() {
  const c = await readJson(CAL);
  if (c && typeof c.rev === 'number') return { rev: c.rev, data: cleanCal(c.data) };
  // Primera vez: se crea a partir del calendario que ya tenía Carlota.
  const st = await read('carlota').catch(() => null);
  const data = cleanCal(st && st.data ? Object.fromEntries(CAL_KEYS.map((k) => [k, st.data[k]])) : {});
  const cal = { rev: 1, data };
  await put(CAL, JSON.stringify(cal), opts);
  return cal;
}
export const writeCal = (cal) => put(CAL, JSON.stringify(cal), opts);
