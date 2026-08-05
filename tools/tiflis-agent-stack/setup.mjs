#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stackDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(stackDir, '../..');

function run(command, args, options = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed with status ${result.status}: ${command}`);
  }
}

function hasCommand(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

await mkdir(path.join(repoRoot, '.agent-data'), { recursive: true, mode: 0o700 });

run('npm', ['--prefix', 'tools/tiflis-agent-core-mcp', 'install', '--no-fund']);
run('npm', ['--prefix', 'tools/tiflis-visual-mcp', 'install', '--no-fund']);
run('npm', ['--prefix', 'tools/tiflis-visual-mcp', 'run', 'install:browser']);
run('npm', ['--prefix', 'tools/tiflis-agent-core-mcp', 'run', 'check']);
run('npm', ['--prefix', 'tools/tiflis-visual-mcp', 'run', 'check']);

if (!hasCommand('uvx')) {
  console.warn('\nSerena requires uv/uvx. Install uv from the official Astral documentation before starting the serena MCP entry.');
} else {
  console.log('\nuvx detected: Serena can start on demand.');
}

if (!hasCommand('npx')) {
  throw new Error('npx is required for Playwright MCP and MCP Compass.');
}

console.log('\nTiflis MCP agent stack is ready. Restart the MCP client so it reloads .mcp.json.');
