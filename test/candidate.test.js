const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { build } = require('../scripts/build-candidate.cjs');
test('candidate is reproducible, complete, isolated, and preserves actual consumer/SRI', async () => {
  const productionDestination = fs.readFileSync(path.join(__dirname, '../data/promoter-destination.json'), 'utf8');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-candidate-'));
  try {
    const out = path.join(temp, 'one');
    const manifest = build(out);
    assert.deepEqual(build(path.join(temp, 'two')), manifest);
    assert.throws(() => build(out), /empty/);
    for (const [file, digest] of Object.entries(manifest.outputs)) {
      assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(out, file))).digest('hex'), digest);
    }
    const page = fs.readFileSync(path.join(out, 'apps/synthetic-one/index.html'), 'utf8');
    for (const match of page.matchAll(/(?:src|href)="(\/[^"?#]*)"/g)) {
      if (/\.(js|css|png|svg|json)$/.test(match[1])) assert.ok(fs.existsSync(path.join(out, match[1])), match[1]);
    }
    assert.ok(page.includes('data-launch-link'));
    assert.ok(page.includes('id="contributors"'));
    for (const match of page.matchAll(/src="\/([^"]+)" integrity="([^"]+)"/g)) assert.equal(match[2], manifest.sri[match[1]]);
    assert.deepEqual(fs.readFileSync(path.join(out, 'contributors.js')), fs.readFileSync(path.join(__dirname, '../contributors.js')));
    assert.match(fs.readFileSync(path.join(out, 'promoters.html'), 'utf8'), /console\.proappstore\.online/);
    assert.equal(fs.readFileSync(path.join(__dirname, '../data/promoter-destination.json'), 'utf8'), productionDestination);
    const { server, resolve } = require(path.join(out, 'serve.cjs'));
    assert.equal(resolve('/build.js'), null);
    assert.equal(resolve('/test/fixtures/contributors.json'), null);
    assert.equal(resolve('/%2e%2e%2fpackage.json'), null);
    const http = server(); await new Promise(r => http.listen(0, '127.0.0.1', r));
    try {
      const base = 'http://127.0.0.1:' + http.address().port;
      assert.equal((await fetch(base + '/promoters')).status, 200);
      assert.equal((await fetch(base + '/apps/synthetic-one/')).status, 200);
      assert.equal((await fetch(base + '/registry.json')).status, 404);
    } finally { await new Promise(r => http.close(r)); }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
