import { existsSync, readFileSync } from 'node:fs';
import { assertAllowedSourcePath, sourcePathLabel, OMH_ROOT, TRIAGE_INBOX } from './pathAllowlist.mjs';
import { createObservation } from './sourceObservation.mjs';

export function readOmhObservations(anchor, observedAt = new Date().toISOString()) {
  return (anchor.evidence_paths ?? [])
    .filter((path) => {
      const sourcePath = assertAllowedSourcePath(path);
      return sourcePath.startsWith(OMH_ROOT) && sourcePath !== TRIAGE_INBOX;
    })
    .flatMap((path) => {
      const sourcePath = assertAllowedSourcePath(path);
      const label = sourcePathLabel(sourcePath);
      const base = {
        worknodeId: anchor.id,
        sourceKind: 'OMH',
        sourcePath,
        sourcePathLabel: label,
        observedAt,
        redaction: 'redacted',
      };
      if (!existsSync(sourcePath)) {
        return [createObservation({
          ...base,
          id: `${anchor.id}:omh:missing:${label}`,
          observationType: 'reader_error',
          strength: 'error',
          confidence: 'low',
          summary: `Allowlisted OMH source is missing: ${label}`,
        })];
      }
      const text = readFileSync(sourcePath, 'utf8');
      const observations = [createObservation({
        ...base,
        id: `${anchor.id}:omh:present:${label}`,
        observationType: 'plan_present',
        strength: 'medium',
        confidence: 'high',
        summary: `Allowlisted OMH evidence is present: ${label}`,
        metadata: { byteLength: Buffer.byteLength(text) },
      })];
      if (text.includes('execution_approved') || text.includes('execution approval') || text.includes('approved_ceiling')) {
        observations.push(createObservation({
          ...base,
          id: `${anchor.id}:omh:approval-boundary:${label}`,
          observationType: 'approval_boundary',
          strength: 'medium',
          confidence: 'high',
          summary: `OMH evidence records an approval boundary: ${label}`,
        }));
      }
      return observations;
    });
}
