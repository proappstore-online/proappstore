const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function build(out, mode = 'ready') {
  if (!['ready', 'unavailable'].includes(mode)) throw new Error('Invalid candidate mode');
  const destination = mode === 'ready' ? 'test/fixtures/promoter-destination-ready.json' : 'data/promoter-destination.json';
  out = path.resolve(out);
  if (out === root || out.startsWith(root + path.sep)) throw new Error('Candidate output must be outside the checkout');
  fs.mkdirSync(out, { recursive: true });
  if (fs.readdirSync(out).length) throw new Error('Candidate output must be empty');
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean).sort();
  const sources = {};
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, file));
    sources[file] = hash(bytes);
    // Only deployable static files; never ship source, functions, or test data.
    if (!file.includes('/') && /\.(js|css|svg|png|html|txt|webmanifest)$/.test(file) && !['build.js', 'playwright.config.js', 'card-styles.css'].includes(file)) {
      fs.writeFileSync(path.join(out, file), bytes);
    }
  }
  const env = { ...process.env, REGISTRY_PATH: path.join(root, 'test/fixtures/browser-registry.json'),
    PROMOTER_DESTINATION_PATH: path.join(root, destination), OUT_DIR: out };
  delete env.PUBLIC_INVENTORY; delete env.PUBLIC_INVENTORY_PATH;
  execFileSync(process.execPath, [path.join(root, 'build.js')], { cwd: root, env, stdio: 'pipe' });
  fs.copyFileSync(path.join(root, 'scripts/serve-candidate.cjs'), path.join(out, 'serve.cjs'));
  fs.copyFileSync(path.join(root, 'docs/storefront-candidate.md'), path.join(out, 'TRANSPORT.md'));
  const outputs = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else outputs[path.relative(out, file).split(path.sep).join('/')] = hash(fs.readFileSync(file));
    }
  }
  walk(out);
  const sri = {};
  for (const file of Object.keys(outputs).filter(f => /\.(js|css)$/.test(f))) {
    sri[file] = 'sha256-' + crypto.createHash('sha256').update(fs.readFileSync(path.join(out, file))).digest('base64');
  }
  const manifest = { version: 1, revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
    mode, fixtures: ['test/fixtures/browser-registry.json', destination],
    sources, sourceDigest: hash(JSON.stringify(sources)), outputs, buildDigest: hash(JSON.stringify(outputs)), sri };
  fs.writeFileSync(path.join(out, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
if (require.main === module) {
  if (!process.argv[2]) throw new Error('usage: node scripts/build-candidate.cjs <empty-directory-outside-checkout>');
  build(process.argv[2]);
}
module.exports = { build };
