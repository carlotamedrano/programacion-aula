// Cuentas. GET /api/users?yo=1 devuelve la cuenta propia; GET (administradora) lista las cuentas.
// POST acciones: crear, clave, ia, activo (administradora) y mi_clave (cualquier cuenta con contraseña propia).
import { json, auth, writeUsers, validId, hashPw, newSalt } from './_lib.js';

const pub = (id, u) => ({ id, name: u.name, admin: !!u.admin, ai: !!u.ai, activo: !u.off, propia: !u.env });

export async function GET(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  if (new URL(req.url).searchParams.get('yo')) return json(a.user);
  if (!a.user.admin) return json({ error: 'sin_permiso' }, 403);
  return json({ cuentas: Object.entries(a.db.users).map(([id, u]) => pub(id, u)) });
}

export async function POST(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  let b;
  try { b = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  const db = a.db;
  const okPw = (p) => typeof p === 'string' && p.length >= 6 && p.length <= 100;

  if (b && b.accion === 'mi_clave') {
    const u = db.users[a.user.id];
    if (u.env) return json({ error: 'clave_en_vercel' }, 400);
    if (!okPw(b.nueva)) return json({ error: 'clave_corta' }, 400);
    u.salt = newSalt();
    u.hash = hashPw(b.nueva, u.salt);
    await writeUsers(db);
    return json({ ok: true });
  }

  if (!a.user.admin) return json({ error: 'sin_permiso' }, 403);
  const id = String((b && b.id) || '').trim().toLowerCase();

  if (b.accion === 'crear') {
    const name = String(b.nombre || '').trim().slice(0, 40);
    if (!validId(id)) return json({ error: 'usuario_no_valido' }, 400);
    if (db.users[id]) return json({ error: 'usuario_existe' }, 409);
    if (!name) return json({ error: 'sin_nombre' }, 400);
    if (!okPw(b.clave)) return json({ error: 'clave_corta' }, 400);
    const salt = newSalt();
    db.users[id] = { name, admin: false, ai: !!b.ia, salt, hash: hashPw(b.clave, salt), created: new Date().toISOString() };
    await writeUsers(db);
    return json({ ok: true, cuenta: pub(id, db.users[id]) });
  }

  const u = db.users[id];
  if (!u) return json({ error: 'no_existe' }, 404);
  if (b.accion === 'clave') {
    if (u.env) return json({ error: 'clave_en_vercel' }, 400);
    if (!okPw(b.clave)) return json({ error: 'clave_corta' }, 400);
    u.salt = newSalt();
    u.hash = hashPw(b.clave, u.salt);
  } else if (b.accion === 'ia') {
    u.ai = !!b.ia;
  } else if (b.accion === 'activo') {
    if (id === a.user.id) return json({ error: 'no_a_ti' }, 400);
    if (b.activo) delete u.off; else u.off = true;
  } else {
    return json({ error: 'formato' }, 400);
  }
  await writeUsers(db);
  return json({ ok: true, cuenta: pub(id, u) });
}
