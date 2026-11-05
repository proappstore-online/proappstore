// Standalone: serves only this artifact, never a checkout or external fallback.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function resolve(url) {
  let rel;
  try { rel = decodeURIComponent(new URL(url, 'http://local').pathname).replace(/^\/+/, '') || 'index.html'; } catch { return null; }
  for (const candidate of [rel, rel + '.html', path.join(rel, 'index.html')]) {
    const file = path.resolve(root, candidate);
    if (!file.startsWith(root + path.sep)) continue;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return null;
}
function server() {
  return http.createServer((req, res) => {
    const file = resolve(req.url);
    if (!file) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
}
if (require.main === module) server().listen(Number(process.argv[2] || 4174), '127.0.0.1');
module.exports = { server, resolve };
