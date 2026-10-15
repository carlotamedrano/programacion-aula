// Asistente con IA (Vercel AI Gateway). Recibe la petición de Carlota y un resumen de su programación,
// y devuelve una respuesta con cambios propuestos en JSON. La app los muestra y solo los aplica si ella confirma.
import { getVercelOidcToken } from '@vercel/oidc';
import { json, auth } from './_lib.js';

// Se prueban en orden. Si un modelo no entra en el nivel gratuito, se pasa al siguiente.
const MODELS = [
  process.env.AI_MODEL,
  'anthropic/claude-haiku-5.5',
  'google/gemini-3.8-flash',
  'zai/glm-5.3-flash',
  'mistral/mistral-large-4',
  'inception/mercury-2.5',
  'nvidia/nemotron-3.5-lightning-free',
  'poolside/laguna-s-2.1-free',
].filter(Boolean);

const SYSTEM = `Eres el asistente de la app de programación de aula de una maestra de Primària en Catalunya.
Recibes un CONTEXTO con su horario, días especiales, unidades con sesiones y la temporalización de lenguas, y una PETICIÓN suya.
La persona que te escribe se llama {{NOMBRE}}.
Responde SIEMPRE con un único objeto JSON, sin texto antes ni después, con esta forma:
{"respuesta": "texto breve en español, cercano y claro", "acciones": [ ... ]}

Acciones posibles (usa solo estas, con estos campos exactos):
- {"tipo":"dia","fecha":"AAAA-MM-DD","clase":"normal"|"sin_clase"|"sin_clase_manana"|"sin_clase_tarde"|"light"}
- {"tipo":"nota","fecha":"AAAA-MM-DD","texto":"..."}  (texto vacío = borrar la nota)
- {"tipo":"no_avanzo","fecha":"AAAA-MM-DD","asignaturas":["mates","medi","cat","cas","oral"]}  (lista vacía = quitar)
- {"tipo":"nueva_sesion","unidad":"id","texto":"...","antes_de":índice opcional,"fecha":"AAAA-MM-DD" opcional,"imprimir":"..." opcional}
- {"tipo":"editar_sesion","unidad":"id","indice":n,"texto":opcional,"fecha":"AAAA-MM-DD" o "" para quitarla (opcional),"imprimir":opcional,"hecha":true|false opcional}
- {"tipo":"borrar_sesion","unidad":"id","indice":n}
- {"tipo":"nueva_unidad","titulo":"...","asignatura":"texto","agenda":"mates"|"medi"|"oral"|"","desde":n opcional,"hasta":n opcional,"saltar":[n] opcional,"por":1|2|3 opcional,"extras":["repaso","ficha","control"] opcional}
- {"tipo":"lengua","clave":"clave exacta del contexto","hecha":true|false opcional,"fecha":"AAAA-MM-DD" opcional}  (fecha = día en que se trabajará ese contenido; "" para quitarla)
- {"tipo":"grup_sencer","fecha":"AAAA-MM-DD","hora":"hora exacta de una franja catd (desdoblament) de ese día","modo":"conmigo"|"ingles"|"normal"}  (conmigo = ese día tengo el grupo entero; ingles = el grupo entero está con el profe de inglés y yo no tengo clase)
- {"tipo":"control","lengua":"cat"|"cas","mes":índice del mes,"fecha":"AAAA-MM-DD" o "" para quitarla}

Reglas:
- Usa solo ids de unidad, índices de sesión y claves de lengua que aparezcan en el CONTEXTO. Los índices se refieren a la lista tal como aparece en el CONTEXTO, aunque propongas varias acciones sobre la misma unidad.
- Calcula las fechas a partir de "Hoy" del CONTEXTO. Solo días de lunes a viernes. Si dice "el viernes" sin más, es el próximo viernes (o hoy si hoy es viernes).
- Una excursión o salida de todo el día es "sin_clase" más una nota. Si solo ocupa la mañana o la tarde, usa "sin_clase_manana" o "sin_clase_tarde".
- Las sesiones sin fecha fija se colocan solas en la agenda; no pongas fechas fijas salvo que lo pida.
- Si solo hace una pregunta, contesta en "respuesta" con "acciones": [].
- Si la petición es ambigua o falta un dato, pregunta en "respuesta" y no propongas acciones.
- No inventes contenidos del libro que no estén en el CONTEXTO. Sé breve.`;

async function token() {
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  try { return await getVercelOidcToken(); } catch { return process.env.VERCEL_OIDC_TOKEN || ''; }
}

const str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');

export async function POST(req) {
  const au = await auth(req);
  if (au.res) return au.res;
  if (!au.user.ai) return json({ error: 'sin_permiso' }, 403);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'formato' }, 400); }
  const pregunta = str(body && body.pregunta, 2000).trim();
  const contexto = str(body && body.contexto, 120000);
  if (!pregunta) return json({ error: 'formato' }, 400);
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .slice(-6)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: str(m.content, 4000) }));

  const tk = await token();
  if (!tk) return json({ error: 'sin_ia' }, 500);
  const messages = [
    { role: 'system', content: SYSTEM.replace('{{NOMBRE}}', au.user.name) },
    ...historial,
    { role: 'user', content: `CONTEXTO:\n${contexto}\n\nPETICIÓN:\n${pregunta}` },
  ];
  let last = '';
  for (const model of [...new Set(MODELS)]) {
    try {
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${tk}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: 2500, temperature: 0.2 }),
      });
      if (r.ok) {
        const j = await r.json();
        let c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
        if (Array.isArray(c)) c = c.map((p) => p.text || '').join('');
        return json({ texto: c || '', modelo: model });
      }
      const raw = await r.text();
      let err = {};
      try { err = JSON.parse(raw).error || {}; } catch {}
      last = `${r.status} ${err.type || ''} ${err.message || raw}`.slice(0, 400);
      console.error('IA', model, last);
      if (r.status === 429) return json({ error: 'limite' }, 429);
      if (r.status === 401) return json({ error: 'auth_ia', detalle: last }, 502);
      if (err.type === 'customer_verification_required') {
        const url = ((err.message || raw).match(/https:\/\/\S+/) || [''])[0].replace(/[).,]+$/, '');
        return json({ error: 'verificacion', url, detalle: last }, 402);
      }
      if (r.status === 402 && err.type !== 'quota_for_entity_exceeded') return json({ error: 'sin_credito', detalle: last }, 402);
      if (r.status === 402) return json({ error: 'presupuesto', detalle: last }, 402);
    } catch (e) {
      last = String(e);
      console.error('IA', model, e);
    }
  }
  return json({ error: 'modelo', detalle: last }, 502);
}
