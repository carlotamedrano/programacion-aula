// Copias de seguridad: GET lista las copias; POST {accion:"crear"} hace una ahora;
// POST {accion:"recuperar", id} vuelve a una copia (antes guarda una copia del estado actual).
import { json, check, read, write, backup, listBackups, readBackup, validId, idOf } from './_lib.js';

export async function GET(req) {
  const denied = await check(req);
  if (denied) return denied;
  try {
    const all = await listBackups();
    return json({ copias: all.map((b) => ({ id: idOf(b), at: b.uploadedAt, size: b.size })) });
  } catch (e) {
    console.error(e);
    return json({ error: 'leer' }, 500);
  }
}

export async function POST(req) {
  const denied = await check(req);
  if (denied) return denied;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  try {
    const cur = await read();
    if (body && body.accion === 'crear') {
      if (!cur) return json({ error: 'sin_datos' }, 400);
      await backup(cur);
      await write({ rev: cur.rev, data: cur.data, bk: Date.now() });
      return json({ ok: true });
    }
    if (body && body.accion === 'recuperar' && validId(body.id)) {
      const copy = await readBackup(body.id);
      if (!copy) return json({ error: 'no_existe' }, 404);
      if (cur) await backup(cur);
      const rev = (cur ? cur.rev : 0) + 1;
      await write({ rev, data: copy.data, bk: Date.now() });
      return json({ rev, data: copy.data });
    }
    return json({ error: 'formato' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'guardar' }, 500);
  }
}
