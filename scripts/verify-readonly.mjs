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

const worknodes = JSON.parse(read('src/data/worknodes.json'));
if (!Array.isArray(worknodes) || worknodes.length < 5) {
  throw new Error('Expected src/data/worknodes.json to contain at least 5 WorkNodes');
}
const realSourceCount = worknodes.filter((node) => node.realSource).length;
if (realSourceCount < 2) {
  throw new Error(`Expected at least 2 real read-only WorkNodes in JSON, found ${realSourceCount}`);
}
for (const node of worknodes) {
  if (!requiredStatuses.includes(node.canonicalStatus)) {
    throw new Error(`${node.id} has invalid status ${node.canonicalStatus}`);
  }
  for (const evidence of node.evidenceLinks ?? []) {
    if (evidence.redacted !== true) {
      throw new Error(`${node.id}: evidence ${evidence.label} is not marked redacted`);
    }
  }
}

const jsonAdapter = read('src/adapters/jsonWorkNodeAdapter.ts');
for (const required of ['mode: \'read-only\'', 'src/data/worknodes.json']) {
  if (!jsonAdapter.includes(required)) {
    throw new Error(`JSON adapter missing required read-only marker: ${required}`);
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

const visibleSources = ['src/App.tsx', 'src/components/Board.tsx', 'src/components/WorkCard.tsx'];
for (const file of visibleSources) {
  const source = read(file);
  if (source.includes("join(' → ')") || source.includes('status-vocabulary')) {
    throw new Error(`${file} contains workflow legend/subtitle residue`);
  }
}

const readme = read('README.md');
for (const required of ['read-only', 'Non-goals', 'Future approval gates', 'TRIAGE', 'RESIDUE', 'workflow legends/subtitles are intentionally absent']) {
  if (!readme.includes(required)) {
    throw new Error(`README missing ${required}`);
  }
}

console.log(JSON.stringify({
  status: 'passed',
  statuses: requiredStatuses,
  jsonWorkNodes: worknodes.length,
  realReadOnlyWorkNodes: realSourceCount,
  adapterFiles,
}, null, 2));
