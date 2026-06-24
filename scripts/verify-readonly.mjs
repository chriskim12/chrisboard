import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredStatuses = ['TRIAGE', 'TODO', 'DOING', 'WAITING', 'REVIEW', 'DONE', 'RESIDUE'];
const read = (path) => readFileSync(join(root, path), 'utf8');

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((entry) => {
    const rel = join(dir, entry);
    const stat = statSync(join(root, rel));
    return stat.isDirectory() ? walk(rel) : [rel];
  });
}

const domain = read('src/domain/worknode.ts');
for (const status of requiredStatuses) {
  if (!domain.includes(`'${status}'`)) {
    throw new Error(`Missing status vocabulary entry ${status}`);
  }
}

const localAdapter = read('src/adapters/localProofAdapter.ts');
const realSourceCount = (localAdapter.match(/realSource:/g) ?? []).length;
if (realSourceCount < 2) {
  throw new Error(`Expected at least 2 real read-only WorkNodes, found ${realSourceCount}`);
}
for (const required of [
  '/home/ubuntu/.hermes/omh/task-management-dashboard/plans/2026-06-24-chrisboard-v1-readonly-proof.md',
  '.gjc/ultragoal/goals.json',
  "mode: 'read-only'",
  'redaction:',
]) {
  if (!localAdapter.includes(required)) {
    throw new Error(`Local proof adapter missing required allowlist/redaction marker: ${required}`);
  }
}

const adapterFiles = walk('src/adapters').filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
const forbiddenMethod = /(?:async\s+)?(?:post|put|patch|delete|dispatch|resume|pause|assign|markDone|mark_done)\s*\(|\b(?:post|put|patch|delete|dispatch|resume|pause|assign|markDone|mark_done)\s*:/i;
for (const file of adapterFiles) {
  const source = read(file);
  const match = source.match(forbiddenMethod);
  if (match) {
    throw new Error(`${file} exposes mutation-like adapter member ${match[0]}`);
  }
}

const appSource = walk('src').filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => [file, read(file)]);
for (const [file, source] of appSource) {
  if (/fetch\s*\([^)]*method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i.test(source)) {
    throw new Error(`${file} contains mutation HTTP fetch`);
  }
}

const readme = read('README.md');
for (const required of ['read-only', 'Non-goals', 'Future approval gates', 'TRIAGE', 'RESIDUE']) {
  if (!readme.includes(required)) {
    throw new Error(`README missing ${required}`);
  }
}

console.log(JSON.stringify({
  status: 'passed',
  statuses: requiredStatuses,
  realReadOnlyWorkNodes: realSourceCount,
  adapterFiles,
}, null, 2));
