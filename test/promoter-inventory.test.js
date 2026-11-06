const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePage, fetchInventory } = require('../scripts/promoter-inventory.cjs');
test('empty readiness catalogue is valid; incomplete payloads fail closed', () => {
  assert.deepEqual(parsePage({ apps: [], next: null }), { apps: [], next: null });
  for (const bad of [{apps:[]}, {apps:[{}],next:null}, {apps:[{appId:'../private'}],next:null}, {apps:[],next:{}}]) assert.throws(()=>parsePage(bad));
});
test('discovery follows cursors and refuses repeated cursors or unavailable API', async () => {
  const urls=[];
  const result = await fetchInventory(async url => {urls.push(url); return Response.json(urls.length === 1 ? {apps:[{appId:'dating'}],next:{after:'dating'}} : {apps:[{appId:'notes'}],next:null});});
  assert.deepEqual(result.apps.map(a=>a.appId),['dating','notes']);
  assert.match(urls[1], /after=dating/);
  await assert.rejects(fetchInventory(async()=>Response.json({apps:[],next:{after:'same'}})), /Repeated/);
  await assert.rejects(fetchInventory(async()=>new Response('',{status:503})), /503/);
});
test('the rendered chooser excludes public apps that are not referral-ready', () => {
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {execFileSync}=require('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'promoter-ready-'));
  const inventory=path.join(dir,'inventory.json');
  const out=path.join(dir,'out');fs.mkdirSync(out);
  const run=apps=>{
    fs.writeFileSync(inventory,JSON.stringify({apps,next:null}));
    execFileSync(process.execPath,['build.js'],{cwd:path.resolve(__dirname,'..'),stdio:'pipe',env:{...process.env,OUT_DIR:out,REGISTRY_PATH:'test/fixtures/browser-registry.json',PROMOTER_DESTINATION_PATH:'test/fixtures/promoter-destination-ready.json',PROMOTER_INVENTORY_PATH:inventory}});
    return fs.readFileSync(path.join(out,'promoters.html'),'utf8');
  };
  try {
    const html=run([{appId:'synthetic-one'}]);
    assert.match(html,/data-app-id="synthetic-one"/);
    assert.doesNotMatch(html,/data-app-id="synthetic-two"/);
    assert.match(run([]),/No apps are accepting promoters/);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
