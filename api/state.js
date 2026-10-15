// Guarda y devuelve el estado de la app en un almacén privado de Vercel Blob.
// Solo responde si la cabecera x-clave coincide con la variable APP_PASSWORD.
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
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
  const text = await new Response(r.stream).text();
  return { etag: r.blob.etag, data: JSON.parse(text) };
}

export async function GET(req) {
  const denied = await check(req);
  if (denied) return denied;
  try {
    return json((await read()) || { etag: null, data: null });
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
  const text = JSON.stringify(body.data);
  if (text.length > 3_000_000) return json({ error: 'demasiado_grande' }, 413);
  const opts = { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60 };
  if (body.etag) opts.ifMatch = body.etag;
  else opts.allowOverwrite = false;
  try {
    const r = await put(PATH, text, opts);
    return json({ etag: r.etag });
  } catch (e) {
    // Otro dispositivo guardó antes: se devuelve la versión actual para que la app la cargue.
    const cur = await read().catch(() => null);
    if (cur && (e instanceof BlobPreconditionFailedError || !body.etag)) return json(cur, 409);
    console.error(e);
    return json({ error: 'guardar' }, 500);
  }
}
