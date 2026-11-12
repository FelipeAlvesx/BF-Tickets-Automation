// Evolution falsa para scripts/simular.sh: aceita os envios do bot e guarda o que receberia o WhatsApp.
import http from 'node:http';
let log = [];
let n = 0;
http.createServer(async (req, res) => {
  let s = '';
  for await (const c of req) s += c;
  const json = (code, body) => res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  if (req.url === '/_log' && req.method === 'GET') return json(200, log);
  if (req.url === '/_log' && req.method === 'DELETE') { log = []; return json(200, { ok: true }); }
  const m = req.url.match(/^\/message\/(sendText|sendMedia)\//);
  if (m) {
    const body = JSON.parse(s || '{}');
    const id = `MOCK${++n}`;
    log.push({ id, tipo: m[1], number: body.number, text: body.text ?? body.caption ?? '', media: body.media ? String(body.media).slice(0, 40) : undefined });
    return json(201, { key: { remoteJid: `${body.number}@s.whatsapp.net`, fromMe: true, id }, status: 'PENDING' });
  }
  json(404, { message: 'mock: rota não simulada' });
}).listen(8080, () => console.log('mock-evolution :8080'));
