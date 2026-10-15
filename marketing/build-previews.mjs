import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const apps = ['sample', 'kanban', 'micro'];
for (const fixture of apps) {
  const snapshot = join(root, 'marketing/fixtures', `${fixture}.json`);
  const { appId } = JSON.parse(readFileSync(snapshot, 'utf8'));
  if (appId !== (fixture === 'sample' ? 'sample-app' : fixture)) throw new Error(`fixture ID mismatch: ${fixture}`);
  const out = join(root, 'marketing/dist');
  const result = spawnSync(process.execPath, [
    join(root, 'marketing/build.mjs'), '--snapshot', snapshot,
    '--assets-dir', join(root, 'marketing/fixtures', fixture, 'assets'),
    '--out', out, '--preview', '--preview-base', `/preview/${appId}/`,
  ], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`preview build failed for ${appId}`);
  const destination = join(root, 'preview', appId);
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  for (const name of ['index.html', 'preview-theme.css', '_astro', 'assets']) {
    cpSync(join(out, name), join(destination, name), { recursive: true });
  }
}
