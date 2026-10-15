// Copias de seguridad de cada profesor: GET lista; POST {accion:"crear"} hace una ahora;
// POST {accion:"recuperar", id} vuelve a una copia (antes guarda una copia del estado actual).
import { json, auth, read, write, backup, listBackups, readBackup, validFile, fileOf } from './_lib.js';

export async function GET(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  try {
    const all = await listBackups(a.user.id);
    return json({ copias: all.map((b) => ({ id: fileOf(a.user.id, b), at: b.uploadedAt, size: b.size })) });
  } catch (e) {
    console.error(e);
    return json({ error: 'leer' }, 500);
  }
}

export async function POST(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  const uid = a.user.id;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  try {
    const cur = await read(uid);
    if (body && body.accion === 'crear') {
      if (!cur) return json({ error: 'sin_datos' }, 400);
      await backup(uid, cur);
      await write(uid, { rev: cur.rev, data: cur.data, bk: Date.now() });
      return json({ ok: true });
    }
    if (body && body.accion === 'recuperar' && validFile(body.id)) {
      const copy = await readBackup(uid, body.id);
      if (!copy) return json({ error: 'no_existe' }, 404);
      if (cur) await backup(uid, cur);
      const rev = (cur ? cur.rev : 0) + 1;
      await write(uid, { rev, data: copy.data, bk: Date.now() });
      return json({ rev, data: copy.data });
    }
    return json({ error: 'formato' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'guardar' }, 500);
  }
}
