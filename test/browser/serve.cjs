// Builds the storefront from the synthetic fixture registry into <tmp>/pas-browser-site/<name>
// and serves it with Cloudflare-Pages-style clean URLs. Synthetic data only.
//   node test/browser/serve.cjs <unavailable|ready> <port>
const http = require('node:http');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const [name, portArg] = process.argv.slice(2);
if (!['unavailable', 'ready'].includes(name) || !/^\d+$/.test(portArg || '')) {
  console.error('usage: serve.cjs <unavailable|ready> <port>');
  process.exit(2);
}
// Outside the repo on purpose: deploy.yml publishes the working directory, so synthetic sites must never land in it.
const out = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'pas-browser-site', name);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const env = { ...process.env, REGISTRY_PATH: path.join(ROOT, 'test/fixtures/browser-registry.json'), OUT_DIR: out };
if (name === 'ready') env.PROMOTER_DESTINATION_PATH = path.join(ROOT, 'test/fixtures/promoter-destination-ready.json');
else delete env.PROMOTER_DESTINATION_PATH;
execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { env, cwd: ROOT, stdio: 'inherit' });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
function resolve(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  for (const base of [out, ROOT]) {
    for (const cand of [rel, rel + '.html', path.join(rel, 'index.html')]) {
      const file = path.resolve(base, cand);
      if (!file.startsWith(base + path.sep) && file !== base) continue;
      if (base === ROOT && /^(node_modules|\.git|\.browser-site)(\/|$)/.test(path.relative(ROOT, file).split(path.sep).join('/'))) continue;
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    }
  }
  return null;
}
http.createServer((req, res) => {
  const file = resolve(new URL(req.url, 'http://x').pathname === '/' ? '/index.html' : new URL(req.url, 'http://x').pathname);
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(Number(portArg), '127.0.0.1', () => console.log(`serving ${name} on http://127.0.0.1:${portArg}`));
