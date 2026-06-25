import { existsSync, readFileSync } from 'node:fs';
import { assertAllowedSourcePath, sourcePathLabel } from './pathAllowlist.mjs';
import { createObservation } from './sourceObservation.mjs';

export function readFixtureObservations(anchor, observedAt = new Date().toISOString()) {
  return (anchor.evidence_paths ?? [])
    .filter((path) => path.includes('scripts/read-model/fixtures/'))
    .flatMap((path) => {
      const sourcePath = assertAllowedSourcePath(path);
      const label = sourcePathLabel(sourcePath);
      if (!existsSync(sourcePath)) {
        return [createObservation({
          id: `${anchor.id}:fixture:missing:${label}`,
          worknodeId: anchor.id,
          sourceKind: 'GJC',
          sourcePath,
          sourcePathLabel: label,
          observedAt,
          observationType: 'reader_error',
          strength: 'error',
          confidence: 'low',
          summary: `Named verifier fixture is missing: ${label}`,
          redaction: 'redacted',
        })];
      }
      const fixture = JSON.parse(readFileSync(sourcePath, 'utf8'));
      return (fixture.observations ?? []).map((observation, index) => createObservation({
        id: `${anchor.id}:fixture:${index}:${observation.observationType}`,
        worknodeId: anchor.id,
        sourceKind: observation.sourceKind ?? 'GJC',
        sourcePath,
        sourcePathLabel: label,
        observedAt: observation.observedAt ?? observedAt,
        observationType: observation.observationType,
        strength: observation.strength,
        confidence: observation.confidence,
        summary: observation.summary,
        redaction: observation.redaction ?? 'redacted',
        metadata: observation.metadata ?? { fixture: fixture.name ?? label },
      }));
    });
}
