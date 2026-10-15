// Guarda y devuelve el estado de la app. Solo responde con la contraseña correcta (cabecera x-clave).
// Cada guardado lleva un número de versión (rev) para detectar cambios hechos en otro dispositivo.
import { json, check, read, write, backupIfDue } from './_lib.js';

export async function GET(req) {
  const denied = await check(req);
  if (denied) return denied;
  try {
    const cur = await read();
    return json(cur ? { rev: cur.rev, data: cur.data } : { rev: 0, data: null });
  } catch (e) {
    console.error(e);
    return json({ error: 'leer' }, 500);
  }
}

export async function PUT(req) {
  const denied = await check(req);
  if (denied) return denied;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
    return json({ error: 'formato' }, 400);
  }
  const base = Number(body.rev) || 0;
  try {
    const cur = await read();
    // Otro dispositivo guardó una versión más nueva: se devuelve para que la app la cargue.
    if (cur && cur.rev > base) return json({ rev: cur.rev, data: cur.data }, 409);
    const bk = await backupIfDue(cur);
    const rev = Math.max(base, cur ? cur.rev : 0) + 1;
    await write({ rev, data: body.data, bk });
    return json({ rev });
  } catch (e) {
    console.error(e);
    return json({ error: e.code === 413 ? 'demasiado_grande' : 'guardar' }, e.code === 413 ? 413 : 500);
  }
}
