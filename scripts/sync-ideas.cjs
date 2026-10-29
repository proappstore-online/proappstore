#!/usr/bin/env node
// Pull the shared App ideas data and FreeAppStore's capabilities from the FAS
// platform repo's main into data/, so /ideas reflects the current dataset and
// what FAS can build today. The committed files are the fallback: a fetch or
// validation failure keeps them and exits 0, so a FAS outage never blocks a
// PAS deploy.
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { validateIdeas, validateCapabilities } = require('./ideas.cjs');

const BASE = 'https://raw.githubusercontent.com/freeappstore-online/platform/main/sites/storefront/data/';
const DATA = path.join(__dirname, '..', 'data');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`${url}: HTTP ${res.statusCode}`)); }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    });
    req.on('timeout', () => req.destroy(new Error(`${url}: timeout`)));
    req.on('error', reject);
  });
}

(async () => {
  try {
    const ideas = JSON.parse(await get(BASE + 'app-ideas.json'));
    const caps = JSON.parse(await get(BASE + 'capabilities.json'));
    const errors = [...validateIdeas(ideas), ...validateCapabilities(caps)];
    if (caps.platform !== 'fas') errors.push('capabilities.json is not FreeAppStore\'s');
    if (errors.length) throw new Error(errors.join('; '));
    fs.writeFileSync(path.join(DATA, 'app-ideas.json'), JSON.stringify(ideas, null, 2) + '\n');
    fs.writeFileSync(path.join(DATA, 'fas-capabilities.json'), JSON.stringify(caps, null, 2) + '\n');
    console.log(`Synced ${ideas.ideas.length} ideas and FAS capabilities (verified ${caps.verifiedAt})`);
  } catch (err) {
    console.warn(`Ideas sync failed, keeping committed data: ${err.message}`);
  }
})();
