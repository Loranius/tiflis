import { spawn } from 'node:child_process';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const previewUrl = 'http://127.0.0.1:4173/';

function fail(message) {
  throw new Error(`[smoke:dist] ${message}`);
}

function localAssetReferences(html) {
  const references = new Set();
  const pattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(pattern)) {
    const value = match[1];
    if (!value || value.startsWith('data:') || value.startsWith('http:') || value.startsWith('https:') || value.startsWith('#')) continue;
    references.add(value);
  }

  return [...references];
}

function assetPath(reference) {
  const clean = reference.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '');
  return path.join(distDir, clean);
}

async function assertArtifact() {
  await access(indexPath).catch(() => fail('dist/index.html is missing'));
  const html = await readFile(indexPath, 'utf8');

  if (!html.includes('id="root"')) fail('root mount point is missing');
  if (!html.includes('id="boot-recovery"')) fail('boot recovery screen is missing');
  if (html.includes('/src/main.tsx')) fail('production HTML still points to the source entry');
  if (html.includes('%VITE_BUILD_ID%')) fail('build identifier was not injected');

  const references = localAssetReferences(html);
  if (!references.some((reference) => reference.includes('/assets/') || reference.includes('assets/'))) {
    fail('no compiled asset references found');
  }

  for (const reference of references) {
    const file = assetPath(reference);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile() || info.size === 0) fail(`missing or empty local asset: ${reference}`);
  }

  return { html, references };
}

async function waitForPreview(child) {
  let lastError = null;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) fail(`preview server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(previewUrl, { redirect: 'error' });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  fail(`preview server did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function assertHttp(references) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await waitForPreview(child);

    const pageResponse = await fetch(previewUrl, { redirect: 'error' });
    if (!pageResponse.ok) fail(`preview root returned HTTP ${pageResponse.status}`);
    const pageHtml = await pageResponse.text();
    if (!pageHtml.includes('id="root"') || !pageHtml.includes('id="boot-recovery"')) {
      fail('preview root does not contain the application shell');
    }

    for (const reference of references) {
      const url = new URL(reference, previewUrl);
      const response = await fetch(url, { redirect: 'error' });
      if (!response.ok) fail(`${url.pathname} returned HTTP ${response.status}`);
      const body = await response.arrayBuffer();
      if (body.byteLength === 0) fail(`${url.pathname} returned an empty body`);
    }
  } catch (error) {
    if (output.trim()) console.error(output.trim());
    throw error;
  } finally {
    child.kill('SIGTERM');
  }
}

const { references } = await assertArtifact();
await assertHttp(references);
console.log(`[smoke:dist] OK — ${references.length} compiled assets verified through Vite preview.`);
