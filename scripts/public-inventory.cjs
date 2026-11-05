// Public-visibility gate for the storefront build (issue #3).
//
// The platform API's /v1/storefront/apps lists only PUBLIC apps: a private app is
// omitted. build.js drops every registry app that is not in that list, so a private
// app never reaches a card, an apps/<id>/ page, the sitemap, catalogue.json, the
// /promoters chooser or the /ideas cross-links. Any failure to read the list throws:
// the build must fail rather than fall back to listing everything.
//
// Modes (chosen by build.js from the environment):
//   live  - fetch the API now (this file run as a CLI, so build.js stays synchronous)
//   path  - read a saved API response (tests and offline reproduction)
const fs = require('node:fs');

const INVENTORY_URL = 'https://api.proappstore.online/v1/storefront/apps';
const PRIVATE_VISIBILITIES = new Set(['private', 'hidden', 'unlisted']);

/** Validates an API response and returns the set of public app ids. */
function parseInventory(inventory) {
  if (!inventory || !Array.isArray(inventory.apps) || inventory.apps.length === 0) {
    throw new Error('Public inventory is empty or invalid; refusing to guess which apps are public');
  }
  const ids = new Set();
  for (const row of inventory.apps) {
    if (!row || typeof row.appId !== 'string' || !row.appId) throw new Error('Public inventory has a row without an appId');
    ids.add(row.appId);
  }
  return ids;
}

/** An entry that declares itself non-public never renders, whatever the API says. */
function isPrivateEntry(app) {
  return app.private === true || PRIVATE_VISIBILITIES.has(String(app.visibility ?? '').trim().toLowerCase());
}

/** Splits registry apps into the ones that may render and the ones dropped (with a reason). */
function filterPublic(apps, publicIds) {
  const kept = [];
  const dropped = [];
  for (const app of apps) {
    if (isPrivateEntry(app)) dropped.push({ id: app.id, reason: 'entry is marked private' });
    else if (publicIds && !publicIds.has(app.id)) dropped.push({ id: app.id, reason: 'not in the public inventory' });
    else kept.push(app);
  }
  return { kept, dropped };
}

async function fetchInventory(url = INVENTORY_URL, get = fetch) {
  const response = await get(url, { signal: AbortSignal.timeout(20000), headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Public inventory HTTP ${response.status}`);
  return response.json();
}

function readInventoryFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read public inventory ${file}: ${error.message}`);
  }
}

if (require.main === module) {
  // CLI: print the validated live inventory as JSON, exit 1 on any failure.
  fetchInventory(process.env.PUBLIC_INVENTORY_URL || INVENTORY_URL)
    .then((inventory) => { parseInventory(inventory); process.stdout.write(JSON.stringify(inventory)); })
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { INVENTORY_URL, parseInventory, isPrivateEntry, filterPublic, fetchInventory, readInventoryFile };
