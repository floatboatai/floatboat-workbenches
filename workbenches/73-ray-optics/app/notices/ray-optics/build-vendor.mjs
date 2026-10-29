#!/usr/bin/env node
// Rebuilds app/src/ui/vendor/ray-optics.js from a checkout (or raw-file mirror)
// of ricktu288/ray-optics at the pinned commit. Run from the workbench root:
//
//   node app/notices/ray-optics/build-vendor.mjs /path/to/ray-optics
//
// Steps: copy upstream src/core and the en/zh-CN main+simulator locales into
// notices/ray-optics, apply patches/embedding.patch (ESM import shapes and
// embedded-canvas pointer offsets), bundle the adapter entry with the pinned
// esbuild, then prune copied files the bundle does not use and rewrite
// ray-optics-provenance.json with per-file upstream/vendored SHA-256.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT = 'daf76772c73a85e1a2568c4e2e71613bba1fab77';
const VERSION = '5.5.0';
const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '../..');
const workbench = resolve(app, '..');
const upstream = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(join(upstream, 'src/core/Scene.js')))
  throw new Error('Usage: node app/notices/ray-optics/build-vendor.mjs <ray-optics checkout at ' + COMMIT + '>');
const pkg = JSON.parse(readFileSync(join(upstream, 'package.json'), 'utf8'));
if (pkg.version !== VERSION) throw new Error('Expected upstream ' + VERSION + ', found ' + pkg.version);

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const source = join(here, 'source');
const locales = join(here, 'locales');
rmSync(source, { recursive: true, force: true });
rmSync(locales, { recursive: true, force: true });
cpSync(join(upstream, 'src/core'), source, { recursive: true });
for (const lang of ['en', 'zh-CN'])
  for (const ns of ['main', 'simulator']) {
    mkdirSync(join(locales, lang), { recursive: true });
    cpSync(join(upstream, 'locales', lang, ns + '.json'), join(locales, lang, ns + '.json'));
  }
// The patch is written against a/src/core; apply it with -p3 relative to source/.
execFileSync('patch', ['-p3', '--forward', '--quiet', '-d', source, '-i', join(here, 'patches/embedding.patch')]);
cpSync(join(here, 'adapter/index.js'), join(source, 'index.js'));
// Upstream sources are authored for webpack's CommonJS interop (e.g. the default
// import of evaluatex/dist/evaluatex.js). A package boundary without "type":
// "module" keeps esbuild on the same interop instead of app/package.json's
// Node ESM semantics.
writeFileSync(join(source, 'package.json'), JSON.stringify({ private: true, sideEffects: true }, null, 2) + '\n');

const esbuild = await import(join(workbench, 'node_modules/esbuild/lib/main.js'));
const outfile = join(app, 'src/ui/vendor/ray-optics.js');
const result = await esbuild.build({
  absWorkingDir: workbench,
  entryPoints: [relative(workbench, join(source, 'index.js'))],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  outfile,
  metafile: true,
  minify: true,
  legalComments: 'eof',
  logLevel: 'error',
  // tex-math-parser pins its own mathjs 12; resolve every import to the single
  // mathjs 15.2.0 used by the rest of the core (upstream lockfile also ships 15.2.0).
  alias: { mathjs: join(workbench, 'node_modules/mathjs') },
  nodePaths: [join(workbench, 'node_modules')],
});
const inputs = Object.keys(result.metafile.inputs).map((p) => resolve(workbench, p));
const used = new Set(inputs.filter((p) => p.startsWith(here + '/')));
used.add(join(source, 'package.json'));

function prune(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      prune(p);
      if (!readdirSync(p).length) rmSync(p, { recursive: true });
    } else if (!used.has(p)) rmSync(p);
  }
}
prune(source);

const patched = new Set(
  readFileSync(join(here, 'patches/embedding.patch'), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('+++ b/src/core/'))
    .map((l) => l.slice('+++ b/src/core/'.length).trim()),
);
const files = [];
for (const p of [...used].sort()) {
  const rel = relative(here, p);
  if (rel === 'source/index.js' || rel === 'source/package.json') continue;
  const upstreamPath = rel.startsWith('source/') ? 'src/core/' + rel.slice(7) : rel.replace(/^locales\//, 'locales/');
  const original = join(upstream, upstreamPath);
  const upstreamHash = sha(original);
  const vendoredHash = sha(p);
  files.push({
    path: upstreamPath,
    sha256: upstreamHash,
    vendored: 'notices/ray-optics/' + rel,
    vendoredSha256: vendoredHash,
    change: patched.has(rel.slice(7)) ? 'patches/embedding.patch' : upstreamHash === vendoredHash ? 'unchanged' : 'unexpected',
  });
}
if (files.some((f) => f.change === 'unexpected')) throw new Error('Unexpected vendored change');
const packages = [...new Set(
  inputs
    .map((p) => /^(.*\/node_modules\/((?:@[^/]+\/)?[^/.][^/]*))\//.exec(p))
    .filter(Boolean)
    .map((m) => m[2] + '@' + JSON.parse(readFileSync(join(m[1], 'package.json'), 'utf8')).version),
)].sort();
const provenancePath = join(app, 'notices/ray-optics-provenance.json');
const previous = existsSync(provenancePath) ? JSON.parse(readFileSync(provenancePath, 'utf8')) : {};
writeFileSync(
  provenancePath,
  JSON.stringify(
    {
      repository: 'https://github.com/ricktu288/ray-optics',
      commit: COMMIT,
      version: VERSION,
      license: 'Apache-2.0',
      adapter: 'adapter/index.js (copied to source/index.js) exposes upstream Scene, Simulator, Editor, geometry and the full sceneObjs registry, and initialises upstream i18next main/simulator namespaces (zh-CN, en fallback).',
      bundle: {
        path: 'src/ui/vendor/ray-optics.js',
        sha256: sha(outfile),
        builder: 'node app/notices/ray-optics/build-vendor.mjs <upstream> (esbuild ' + esbuild.version + ' --bundle --platform=browser --format=esm --minify --legal-comments=eof, alias mathjs -> mathjs@15.2.0)',
        entry: 'notices/ray-optics/source/index.js',
        bundledPackages: packages,
      },
      patches: ['patches/embedding.patch'],
      dependencyLicenseNotes: previous.dependencyLicenseNotes ?? {},
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log('vendored', files.length, 'files;', packages.length, 'npm packages; bundle', statSync(outfile).size, 'bytes');

// Regenerate the structural schema used by the shared (client + server) validator
// from the bundle's own serializableDefaults, so validation never drifts from the
// vendored core.
const vendor = await import(outfile + '?schema=' + Date.now());
const objectDefaults = {};
for (const [type, C] of Object.entries(vendor.sceneObjs).sort(([a], [b]) => a.localeCompare(b)))
  objectDefaults[type] = { name: '', locked: 'default', ...C.serializableDefaults };
writeFileSync(
  join(app, 'src/contracts/native-schema.ts'),
  '// Generated by app/notices/ray-optics/build-vendor.mjs from the pinned upstream\n' +
    '// Scene/sceneObjs serializableDefaults (Ray Optics ' + VERSION + '). Do not edit by hand.\n' +
    'export const sceneDefaults = ' + JSON.stringify(vendor.Scene.serializableDefaults) + ' as const;\n' +
    'export const objectDefaults = ' + JSON.stringify(objectDefaults).replace(/,"(?=[A-Z][A-Za-z]*":{"name")/g, ",\n  \"") + ' as const;\n',
);
console.log('native-schema.ts:', Object.keys(objectDefaults).length, 'object types');
