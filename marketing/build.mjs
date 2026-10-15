import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, copyFileSync, rmSync, statSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, resolve, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSnapshot } from './content.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
}
const snapshotPath = option('--snapshot');
const assetsDir = option('--assets-dir');
const outDir = resolve(option('--out') ?? join(ROOT, 'marketing/dist'));
const preview = args.includes('--preview');
const previewBase = option('--preview-base');
if (!snapshotPath) throw new Error('usage: npm run build:marketing -- --snapshot <approved.json> [--assets-dir <dir>] [--out <dir>] [--preview]');
if (previewBase && (!preview || !/^\/[a-z0-9/-]+\/$/.test(previewBase) || previewBase.includes('//'))) {
  throw new Error('--preview-base requires --preview and a safe absolute path');
}

// Astro empties its output directory before writing. Resolve symlinks and
// refuse a destination that could erase source, a snapshot, or approved assets.
function canonical(path) {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  return parent === absolute ? absolute : join(canonical(parent), basename(absolute));
}
function contains(parent, child) {
  const rest = relative(parent, child);
  return rest === '' || (rest !== '..' && !rest.startsWith(`..${sep}`) && !isAbsolute(rest));
}
const output = canonical(outDir);
const source = canonical(ROOT);
// Keep this expected path lexical: canonicalizing it would follow a malicious
// marketing/dist symlink into source and incorrectly mark that target as safe.
const allowedInSource = join(source, 'marketing/dist');
if (contains(output, source)
  || (contains(source, output) && !contains(allowedInSource, output))
  || contains(output, canonical(snapshotPath))
  || (assetsDir && contains(output, canonical(assetsDir)))) {
  throw new Error('unsafe output directory');
}

process.env.PAS_MARKETING_SNAPSHOT = resolve(snapshotPath);
const snapshot = loadSnapshot();
const stage = mkdtempSync(join(tmpdir(), 'pas-marketing-assets-'));

function validImage(bytes, ext) {
  if (ext === '.png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (ext === '.jpg' || ext === '.jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === '.webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

try {
  const images = [snapshot.heroImage, ...snapshot.screenshots].filter(Boolean);
  if (images.length && !assetsDir) throw new Error('--assets-dir is required for snapshot images');
  mkdirSync(join(stage, 'assets'), { recursive: true });
  if (preview) writeFileSync(join(stage, 'preview-theme.css'), `:root{--accent:${snapshot.theme.accent}}\n`);
  for (const image of images) {
    const name = basename(image.src);
    const source = join(resolve(assetsDir), name);
    if (!existsSync(source) || !statSync(source).isFile()) throw new Error(`missing approved image: ${name}`);
    const bytes = readFileSync(source);
    if (bytes.length > 10 * 1024 * 1024 || !validImage(bytes, extname(name).toLowerCase())) {
      throw new Error(`invalid approved image: ${name}`);
    }
    copyFileSync(source, join(stage, 'assets', name));
  }

  const result = spawnSync(join(ROOT, 'node_modules/.bin/astro'), ['build', '--root', join(ROOT, 'marketing')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PAS_MARKETING_OUT_DIR: outDir,
      PAS_MARKETING_PUBLIC_DIR: stage,
      PAS_MARKETING_PREVIEW: preview ? '1' : '0',
      PAS_MARKETING_PREVIEW_BASE: previewBase ?? '',
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Astro build failed (${result.status})`);

  const files = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) {
        const path = '/' + relative(outDir, full).split('\\').join('/');
        if (path.endsWith('.map')) throw new Error('source maps are not publishable');
        const bytes = readFileSync(full);
        const ext = extname(path).toLowerCase();
        const contentType = ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[ext];
        if (!contentType) throw new Error(`unexpected artifact type: ${path}`);
        files.push({ path, contentType, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
      }
    }
  }
  visit(outDir);
  for (const required of ['/index.html', '/robots.txt', '/sitemap.xml']) {
    if (!files.some((file) => file.path === required)) throw new Error(`missing artifact: ${required}`);
  }
  const manifest = {
    schemaVersion: 1,
    appId: snapshot.appId,
    revision: snapshot.revision,
    preview,
    origin: `https://about-${snapshot.appId}.proappstore.online`,
    files,
  };
  writeFileSync(join(outDir, 'artifact-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Marketing artifact: ${files.length} files for ${snapshot.appId}@${snapshot.revision}${preview ? ' (preview)' : ''}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
