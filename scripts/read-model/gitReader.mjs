import { execFileSync } from 'node:child_process';
import { assertAllowedSourcePath, sourcePathLabel } from './pathAllowlist.mjs';
import { createObservation } from './sourceObservation.mjs';

export function readGitObservations(anchor, observedAt = new Date().toISOString()) {
  if (!anchor.repo_path) return [];
  const repoPath = assertAllowedSourcePath(anchor.repo_path);
  const label = sourcePathLabel(repoPath);
  const base = {
    worknodeId: anchor.id,
    sourceKind: 'Git',
    sourcePath: repoPath,
    sourcePathLabel: label,
    observedAt,
    redaction: 'redacted',
  };

  try {
    const status = execFileSync('git', ['-C', repoPath, 'status', '--porcelain=v1', '--branch'], { encoding: 'utf8' });
    const lines = status.split('\n').filter(Boolean);
    const branchLine = lines.find((line) => line.startsWith('## ')) ?? '## unknown';
    const changedLines = lines.filter((line) => !line.startsWith('## '));
    const observations = [];
    observations.push(createObservation({
      ...base,
      id: `${anchor.id}:git:${changedLines.length === 0 ? 'clean' : 'dirty'}`,
      observationType: changedLines.length === 0 ? 'git_clean' : 'git_dirty',
      strength: changedLines.length === 0 ? 'strong' : 'medium',
      confidence: 'high',
      summary: changedLines.length === 0 ? 'Git worktree is clean.' : `Git worktree has ${changedLines.length} changed path(s).`,
      metadata: { changedPathCount: changedLines.length },
    }));
    if (/\[ahead \d+/.test(branchLine)) {
      observations.push(createObservation({
        ...base,
        id: `${anchor.id}:git:unpushed`,
        observationType: 'git_unpushed',
        strength: 'medium',
        confidence: 'high',
        summary: 'Local branch has unpushed commits.',
        metadata: { branchLine },
      }));
    }
    if (/main/.test(branchLine) && changedLines.length === 0) {
      observations.push(createObservation({
        ...base,
        id: `${anchor.id}:git:landed`,
        observationType: 'git_landed',
        strength: 'strong',
        confidence: 'medium',
        summary: 'Work is on the main local integration branch, but final proof is still separate.',
        metadata: { branchLine },
      }));
    }
    return observations;
  } catch (error) {
    return [createObservation({
      ...base,
      id: `${anchor.id}:git:reader-error`,
      observationType: 'reader_error',
      strength: 'error',
      confidence: 'low',
      summary: `Git reader failed closed: ${error instanceof Error ? error.message : String(error)}`,
    })];
  }
}
