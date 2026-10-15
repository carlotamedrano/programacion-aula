// Guarda y devuelve el estado de cada profesor. Cada guardado lleva un número de versión (rev)
// para detectar cambios hechos en otro dispositivo.
import { json, auth, read, write, backupIfDue } from './_lib.js';

export async function GET(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  try {
    const cur = await read(a.user.id);
    return json(cur ? { rev: cur.rev, data: cur.data } : { rev: 0, data: null });
  } catch (e) {
    console.error(e);
    return json({ error: 'leer' }, 500);
  }
}

export async function PUT(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  const id = a.user.id;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
    return json({ error: 'formato' }, 400);
  }
  const base = Number(body.rev) || 0;
  try {
    const cur = await read(id);
    if (cur && cur.rev > base) return json({ rev: cur.rev, data: cur.data }, 409);
    const bk = await backupIfDue(id, cur);
    const rev = Math.max(base, cur ? cur.rev : 0) + 1;
    await write(id, { rev, data: body.data, bk });
    return json({ rev });
  } catch (e) {
    console.error(e);
    return json({ error: e.code === 413 ? 'demasiado_grande' : 'guardar' }, e.code === 413 ? 413 : 500);
  }
}
