import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const findings = [];
const notes = [];

function fail(message) {
  findings.push(message);
}

async function filesUnder(directory, extensions = null) {
  const result = [];
  const absolute = path.join(root, directory);
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(relative, extensions));
    else if (!extensions || extensions.some((extension) => entry.name.endsWith(extension))) result.push(relative);
  }
  return result;
}

async function read(relative) {
  return readFile(path.join(root, relative), 'utf8');
}

const sourceFiles = await filesUnder('src', ['.ts', '.tsx', '.css']);
const sourceEntries = await Promise.all(sourceFiles.map(async (file) => [file, await read(file)]));
const sourceText = sourceEntries.map(([file, content]) => `\n/* ${file} */\n${content}`).join('\n');

if (/serviceWorker\s*\.\s*register\s*\(/.test(sourceText)) {
  fail('The React source still registers a service worker.');
}

if (/dangerouslySetInnerHTML\s*=/.test(sourceText)) {
  fail('dangerouslySetInnerHTML is present in the React source.');
}

for (const [file, content] of sourceEntries) {
  if (/SUPABASE_SERVICE_ROLE_KEY|BOT_TOKEN/.test(content)) {
    fail(`Server-only secret name is referenced by browser source: ${file}`);
  }

  const unsafeStorageWrite = /(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*['"`][^'"`]*(?:password|passwd|token|secret|api[_-]?key)/i;
  if (unsafeStorageWrite.test(content)) {
    fail(`Potential credential write to browser storage: ${file}`);
  }
}

const jsx = sourceEntries
  .filter(([file]) => file.endsWith('.tsx'))
  .map(([, content]) => content)
  .join('\n');
const dialogs = [...jsx.matchAll(/<[^>]*\brole=["']dialog["'][^>]*>/g)].map((match) => match[0]);
if (dialogs.length === 0) fail('No accessible dialogs were found; modal audit could not run.');
for (const dialog of dialogs) {
  if (!/\baria-modal=["']true["']/.test(dialog)) {
    fail(`Dialog is missing aria-modal=true: ${dialog.slice(0, 180)}`);
  }
}
notes.push(`${dialogs.length} accessible modal dialog(s) inspected.`);

const scheduleCss = await read('src/pages/schedule.css');
if (!scheduleCss.includes('overscroll-behavior-y:auto')) {
  fail('Schedule table does not explicitly allow vertical scroll chaining.');
}
if (!scheduleCss.includes('touch-action:pan-x pan-y')) {
  fail('Schedule table does not allow both touch axes.');
}

const modalCss = await read('src/modal-runtime.css');
if (!modalCss.includes('--tiflis-modal-viewport-height') || !modalCss.includes('body.tiflis-modal-open')) {
  fail('Global modal runtime CSS is incomplete.');
}
const modalRuntime = await read('src/components/ModalRuntime.tsx');
if (!modalRuntime.includes('visualViewport') || !modalRuntime.includes('MutationObserver')) {
  fail('Global modal runtime does not track mobile visual viewport and dynamic dialogs.');
}

const mainSource = await read('src/main.tsx');
for (const insecureKey of ['tiflis_saved_password', 'tiflis_tg_token']) {
  if (!mainSource.includes(`localStorage.removeItem(key)`) || !mainSource.includes(insecureKey)) {
    fail(`Legacy insecure key retirement is missing for ${insecureKey}.`);
  }
}

const sw = await read('sw.js');
if (!sw.includes('registration.unregister()')) fail('Legacy service worker does not unregister itself.');
if (/respondWith\s*\(/.test(sw)) fail('Retirement service worker still intercepts requests.');

const indexHtml = await read('index.html');
if (!indexHtml.includes('stable-runtime/loader.js')) fail('Raw Pages fallback loader is missing from index.html.');
if (!indexHtml.includes('id="boot-recovery"')) fail('Boot recovery UI is missing from index.html.');
const viteConfig = await read('vite.config.ts');
if (!viteConfig.includes('TIFLIS_RAW_RUNTIME_START') || !viteConfig.includes('/src/main.tsx')) {
  fail('Vite does not transform the raw fallback into the React entry.');
}

for (const required of ['stable-runtime/loader.js', 'stable-runtime/version.json']) {
  await access(path.join(root, required)).catch(() => fail(`Stable runtime file is missing: ${required}`));
}
const stableAssets = await filesUnder('stable-runtime/assets');
if (stableAssets.length === 0) fail('Stable runtime contains no compiled assets.');
notes.push(`${stableAssets.length} stable runtime asset(s) present.`);

const temporaryFiles = [
  ...await filesUnder('.github/workflows', ['.yml', '.yaml']),
  ...await filesUnder('scripts', ['.mjs', '.js']),
].filter((file) => /apply-phase|final-portal-audit/i.test(file) && !file.endsWith('final-portal-audit.mjs'));
if (temporaryFiles.length) fail(`Temporary patch machinery remains: ${temporaryFiles.join(', ')}`);

const packageJson = JSON.parse(await read('package.json'));
for (const script of ['typecheck', 'build', 'perf:budget', 'smoke:dist']) {
  if (!packageJson.scripts?.[script]) fail(`Required package script is missing: ${script}`);
}

async function auditLiveSite() {
  const base = new URL(`https://loranius.github.io/tiflis/?audit=${Date.now()}`);
  const response = await fetch(base, { redirect: 'error', headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`Live root returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes('id="root"') || !html.includes('id="boot-recovery"')) {
    throw new Error('Live root does not contain the application and recovery shells.');
  }
  if (html.includes('/src/main.tsx')) throw new Error('Live site exposes the source TypeScript entry.');

  const refs = new Set();
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const value = match[1];
    if (!value || value.startsWith('data:') || value.startsWith('http:') || value.startsWith('https:') || value.startsWith('#')) continue;
    refs.add(value);
  }

  let checked = 0;
  for (const reference of refs) {
    const url = new URL(reference, base);
    const asset = await fetch(url, { redirect: 'error', headers: { 'cache-control': 'no-cache' } });
    if (!asset.ok) throw new Error(`Live asset ${url.pathname} returned HTTP ${asset.status}`);
    const data = await asset.arrayBuffer();
    if (data.byteLength === 0) throw new Error(`Live asset ${url.pathname} is empty.`);
    checked += 1;
  }

  if (html.includes('stable-runtime/loader.js')) {
    const loaderUrl = new URL('./stable-runtime/loader.js', base);
    const loaderResponse = await fetch(loaderUrl, { headers: { 'cache-control': 'no-cache' } });
    const loader = await loaderResponse.text();
    if (!loaderResponse.ok || !loader.includes('import(')) throw new Error('Stable runtime loader is invalid on the live site.');
    const assetMatches = [...loader.matchAll(/["'](assets\/[^"']+)["']/g)].map((match) => match[1]);
    for (const reference of new Set(assetMatches)) {
      const url = new URL(reference, loaderUrl);
      const asset = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      if (!asset.ok || (await asset.arrayBuffer()).byteLength === 0) {
        throw new Error(`Stable runtime asset is unavailable: ${url.pathname}`);
      }
      checked += 1;
    }
  }
  notes.push(`${checked} live local asset(s) fetched successfully.`);
}

try {
  await auditLiveSite();
} catch (error) {
  fail(`Live Pages audit failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (findings.length) {
  console.error('\nPortal audit failed:');
  findings.forEach((finding, index) => console.error(`${index + 1}. ${finding}`));
  process.exitCode = 1;
} else {
  console.log('Portal audit passed.');
  notes.forEach((note) => console.log(`- ${note}`));
}
