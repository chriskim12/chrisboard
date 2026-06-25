import { existsSync, statSync } from 'node:fs';
import { assertAllowedSourcePath, sourcePathLabel, REPO_ROOT, ULTRAGOAL_RUN_ROOT } from './pathAllowlist.mjs';
import { createObservation } from './sourceObservation.mjs';

export function readGjcObservations(anchor, observedAt = new Date().toISOString()) {
  const candidatePaths = [
    ...(anchor.evidence_paths ?? []).filter((path) => assertAllowedSourcePath(path).startsWith(`${REPO_ROOT}/.gjc`)),
  ];
  if (anchor.id === 'cb-ultragoal-execution') candidatePaths.push(ULTRAGOAL_RUN_ROOT);

  return candidatePaths.flatMap((path) => {
    const sourcePath = assertAllowedSourcePath(path);
    const label = sourcePathLabel(sourcePath);
    const base = {
      worknodeId: anchor.id,
      sourceKind: 'GJC',
      sourcePath,
      sourcePathLabel: label,
      observedAt,
      redaction: 'redacted',
    };
    if (!existsSync(sourcePath)) {
      return [createObservation({
        ...base,
        id: `${anchor.id}:gjc:missing:${label}`,
        observationType: 'reader_error',
        strength: 'error',
        confidence: 'low',
        summary: `Allowlisted GJC/Hermes source is missing: ${label}`,
      })];
    }
    const stat = statSync(sourcePath);
    const observationType = anchor.id === 'cb-ultragoal-execution' ? 'execution_active' : 'artifact_present';
    return [createObservation({
      ...base,
      id: `${anchor.id}:gjc:${observationType}:${label}`,
      observationType,
      strength: observationType === 'execution_active' ? 'strong' : 'medium',
      confidence: 'high',
      summary: observationType === 'execution_active' ? 'Hermes Ultragoal run root is present for current execution.' : `Allowlisted GJC artifact is present: ${label}`,
      metadata: { kind: stat.isDirectory() ? 'directory' : 'file' },
    })];
  });
}
