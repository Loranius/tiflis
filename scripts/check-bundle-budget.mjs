import { gzipSync } from 'node:zlib';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const ENTRY_GZIP_LIMIT = 130 * 1024;
const LARGEST_CHUNK_GZIP_LIMIT = 155 * 1024;
const TOTAL_JS_GZIP_LIMIT = 320 * 1024;

function kb(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

const html = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8');
const files = await readdir(ASSETS_DIR);
const jsFiles = files.filter((file) => file.endsWith('.js'));

if (jsFiles.length === 0) {
  throw new Error('Bundle budget: у dist/assets немає JavaScript-файлів.');
}

const metrics = await Promise.all(jsFiles.map(async (file) => {
  const buffer = await readFile(path.join(ASSETS_DIR, file));
  return {
    file,
    raw: buffer.byteLength,
    gzip: gzipSync(buffer).byteLength,
  };
}));

const entryMatch = html.match(/assets\/[^"']+\.js/);
if (!entryMatch) {
  throw new Error('Bundle budget: не вдалося визначити entry JavaScript у dist/index.html.');
}

const entryName = path.basename(entryMatch[0]);
const entry = metrics.find((metric) => metric.file === entryName);
if (!entry) {
  throw new Error(`Bundle budget: entry ${entryName} не знайдено у dist/assets.`);
}

const largest = [...metrics].sort((left, right) => right.gzip - left.gzip)[0];
const totalGzip = metrics.reduce((sum, metric) => sum + metric.gzip, 0);

console.log(`Entry: ${entry.file} — ${kb(entry.raw)} raw / ${kb(entry.gzip)} gzip`);
console.log(`Largest JS chunk: ${largest.file} — ${kb(largest.gzip)} gzip`);
console.log(`Total JS gzip: ${kb(totalGzip)} across ${metrics.length} chunks`);

const failures = [];
if (entry.gzip > ENTRY_GZIP_LIMIT) {
  failures.push(`entry gzip ${kb(entry.gzip)} > ${kb(ENTRY_GZIP_LIMIT)}`);
}
if (largest.gzip > LARGEST_CHUNK_GZIP_LIMIT) {
  failures.push(`largest chunk gzip ${kb(largest.gzip)} > ${kb(LARGEST_CHUNK_GZIP_LIMIT)}`);
}
if (totalGzip > TOTAL_JS_GZIP_LIMIT) {
  failures.push(`total JS gzip ${kb(totalGzip)} > ${kb(TOTAL_JS_GZIP_LIMIT)}`);
}

if (failures.length) {
  console.error(`Bundle performance budget failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Bundle performance budget passed.');
