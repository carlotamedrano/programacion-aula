// Guarda y devuelve el estado de la app en un almacén privado de Vercel Blob.
// Solo responde si la cabecera x-clave coincide con la variable APP_PASSWORD.
// Cada guardado lleva un número de versión (rev) para detectar cambios hechos en otro dispositivo.
import { get, put } from '@vercel/blob';
import { createHash, timingSafeEqual } from 'node:crypto';

const PATH = 'progaula/estado.json';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const sha = (x) => createHash('sha256').update(String(x)).digest();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(req) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return json({ error: 'sin_clave' }, 500);
  if (!timingSafeEqual(sha(req.headers.get('x-clave') || ''), sha(expected))) {
    await wait(800);
    return json({ error: 'clave' }, 401);
  }
  return null;
}

async function read() {
  const r = await get(PATH, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  const p = JSON.parse(await new Response(r.stream).text());
  if (p && typeof p.rev === 'number' && p.data && typeof p.data === 'object') return { rev: p.rev, data: p.data };
  return { rev: 0, data: p }; // formato antiguo, sin número de versión
}

export async function GET(req) {
  const denied = await check(req);
  if (denied) return denied;
  try {
    return json((await read()) || { rev: 0, data: null });
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
    if (cur && cur.rev > base) return json(cur, 409);
    const rev = Math.max(base, cur ? cur.rev : 0) + 1;
    const text = JSON.stringify({ rev, data: body.data });
    if (text.length > 3_000_000) return json({ error: 'demasiado_grande' }, 413);
    await put(PATH, text, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
    return json({ rev });
  } catch (e) {
    console.error(e);
    return json({ error: 'guardar' }, 500);
  }
}
