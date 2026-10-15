// Calendario común del colegio (días sin clase, light, medias jornadas y notas). Lo ven y editan todas las cuentas.
import { json, auth, readCal, writeCal, cleanCal } from './_lib.js';

export async function GET(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  try {
    return json(await readCal());
  } catch (e) {
    console.error(e);
    return json({ error: 'leer' }, 500);
  }
}

export async function PUT(req) {
  const a = await auth(req);
  if (a.res) return a.res;
  let body;
  try { body = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  try {
    const cur = await readCal();
    const base = Number(body && body.rev) || 0;
    if (cur.rev > base) return json(cur, 409);
    const cal = { rev: cur.rev + 1, data: cleanCal(body && body.data) };
    await writeCal(cal);
    return json({ rev: cal.rev });
  } catch (e) {
    console.error(e);
    return json({ error: 'guardar' }, 500);
  }
}
