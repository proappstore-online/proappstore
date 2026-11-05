const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { appendRef, propagateRef } = require('../detail-page.js');
const launch = 'https://synthetic-one.proappstore.online/path?mode=demo#section';

function documentFixture(hrefs = [launch]) {
  const links = hrefs.map(href => ({ href, getAttribute() { return this.href; }, setAttribute(key, value) { this.href = value; } }));
  const unrelated = { href: 'https://github.com/example/source' };
  return { links, unrelated,
    querySelector: () => ({ getAttribute: () => 'synthetic-one' }),
    querySelectorAll(selector) { assert.equal(selector, 'a[data-launch-link]'); return links; },
  };
}

test('appendRef merges the query and preserves the path and hash', () => {
  assert.equal(appendRef(launch, 'testcode'), 'https://synthetic-one.proappstore.online/path?mode=demo&ref=testcode#section');
  assert.equal(appendRef(launch.replace('mode=demo', 'ref=old'), 'testcode'), 'https://synthetic-one.proappstore.online/path?ref=testcode#section');
});

test('absent and hostile referrals leave URLs unchanged', () => {
  for (const ref of [null, undefined, '', 'a b', 'a\nb', '<bad>', 'a&b', 'a"b', 'x'.repeat(65)]) {
    assert.equal(appendRef(launch, ref), launch);
  }
  for (const search of ['', '?other=testcode', '?ref=', '?ref=a+b', '?ref=%3Cbad%3E', '?ref=a%26b', '?ref=a%22b', '?ref=' + 'x'.repeat(65), '?ref=one&ref=two']) {
    const doc = documentFixture();
    propagateRef(doc, search);
    assert.equal(doc.links[0].href, launch);
  }
});

test('unsafe and malformed launch URLs are unchanged', () => {
  for (const href of [null, '', 'not a URL', 'javascript:alert(1)', 'http://example.com', 'https://user:pw@example.com', 'https://example.com:8443', 'https://example.com/\n']) {
    assert.equal(appendRef(href, 'testcode'), href);
  }
});

test('propagation modifies only explicit launch links belonging to this app', () => {
  const otherApp = 'https://synthetic-two.proappstore.online/';
  const hostile = 'https://evil.example/';
  const doc = documentFixture([launch, otherApp, hostile]);
  propagateRef(doc, '?ref=testcode');
  assert.equal(new URL(doc.links[0].href).searchParams.get('ref'), 'testcode');
  assert.equal(doc.links[1].href, otherApp);
  assert.equal(doc.links[2].href, hostile);
  assert.equal(doc.unrelated.href, 'https://github.com/example/source');
});

test('template marks exactly three canonical launch links and loads the script with SRI', () => {
  const html = fs.readFileSync(require.resolve('../templates/app-detail.html'), 'utf8');
  assert.equal((html.match(/data-launch-link/g) || []).length, 3);
  assert.equal((html.match(/href="\{\{APP_URL\}\}" data-launch-link/g) || []).length, 3);
  assert.match(html, /src="\/detail-page.js" integrity="\{\{SRI_DETAIL_PAGE_JS\}\}"/);
});

test('browser startup propagates at DOM readiness without needing listing hydration', () => {
  const source = fs.readFileSync(require.resolve('../detail-page.js'), 'utf8');
  for (const readyState of ['loading', 'complete']) {
    const doc = documentFixture();
    let onReady;
    Object.assign(doc, { readyState, getElementById: () => null,
      addEventListener(event, callback) { assert.equal(event, 'DOMContentLoaded'); onReady = callback; } });
    vm.runInNewContext(source, { document: doc, window: { location: { search: '?ref=testcode' } }, URL, URLSearchParams });
    if (readyState === 'loading') { assert.equal(doc.links[0].href, launch); onReady(); }
    assert.equal(new URL(doc.links[0].href).searchParams.get('ref'), 'testcode');
  }
});
