import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const stableDir = path.join(root, 'stable-runtime');
const distIndex = path.join(distDir, 'index.html');
const sourceSha = process.env.STABLE_SOURCE_SHA || process.env.VITE_BUILD_ID || 'unknown';

function isLocalReference(reference) {
  return !/^(?:[a-z]+:)?\/\//i.test(reference)
    && !reference.startsWith('data:')
    && !reference.startsWith('#');
}

function normalizedAsset(reference) {
  const value = reference.split(/[?#]/, 1)[0].replace(/^\.\//, '').replace(/^\//, '');
  if (!value.startsWith('assets/')) {
    throw new Error(`Stable runtime only supports compiled assets, received: ${reference}`);
  }
  return value;
}

const html = await readFile(distIndex, 'utf8');
const moduleScripts = [...html.matchAll(/<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
  .map((match) => match[1])
  .filter(isLocalReference)
  .map(normalizedAsset);
const stylesheets = [...html.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
  .map((match) => match[1])
  .filter(isLocalReference)
  .map(normalizedAsset);

if (moduleScripts.length !== 1) {
  throw new Error(`Expected one compiled module entry, found ${moduleScripts.length}`);
}

await rm(stableDir, { recursive: true, force: true });
await mkdir(stableDir, { recursive: true });
await cp(path.join(distDir, 'assets'), path.join(stableDir, 'assets'), { recursive: true });

const loader = `// Generated from verified build ${sourceSha}. Do not edit manually.\n`
  + `const styles=${JSON.stringify(stylesheets)};\n`
  + `for(const asset of styles){const href=new URL(asset,import.meta.url).href;if(!document.querySelector('link[data-tiflis-stable="'+href+'"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.tiflisStable=href;document.head.append(link);}}\n`
  + `window.__TIFLIS_STABLE_RUNTIME__=${JSON.stringify(sourceSha)};\n`
  + `import(new URL(${JSON.stringify(moduleScripts[0])},import.meta.url).href).catch((error)=>{console.error('[Tiflis] Stable runtime failed',error);const recovery=document.getElementById('boot-recovery');if(recovery){recovery.dataset.state='error';const title=recovery.querySelector('strong');const message=recovery.querySelector('.boot-message');if(title)title.textContent='Стабільна версія не завантажилась';if(message)message.textContent='Оновіть сторінку. Якщо проблема повториться, повідомте адміністратора.';}throw error;});\n`;

await writeFile(path.join(stableDir, 'loader.js'), loader, 'utf8');
await writeFile(path.join(stableDir, 'version.json'), `${JSON.stringify({ sourceSha, generatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');

console.log(`[stable-runtime] Materialized ${sourceSha}: ${moduleScripts[0]}, ${stylesheets.length} stylesheet(s).`);
