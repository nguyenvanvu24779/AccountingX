// Copies the Node.js on this machine into src-tauri/resources/node so the
// installer carries its own Node and a customer's PC does not need one.
// Runs from tauri.conf.json `beforeBuildCommand`.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fileName = process.platform === 'win32' ? 'node.exe' : 'node';
const target = join(root, 'src-tauri', 'resources', 'node', fileName);

function findNode() {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  const out = execFileSync(finder, ['node'], { encoding: 'utf8' });
  const first = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!first) throw new Error('node was not found on PATH');
  return first;
}

try {
  const source = findNode();
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  const mb = (statSync(target).size / 1024 / 1024).toFixed(0);
  console.log(`prepare-node: copied ${source} (${mb} MB) -> ${target}`);
} catch (error) {
  console.error(`prepare-node: ${error.message}. Install Node.js, then build again.`);
  process.exit(1);
}
