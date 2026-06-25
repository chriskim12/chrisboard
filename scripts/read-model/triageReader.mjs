import { existsSync, readFileSync } from 'node:fs';
import { assertAllowedSourcePath, sourcePathLabel, TRIAGE_INBOX } from './pathAllowlist.mjs';
import { createObservation } from './sourceObservation.mjs';

export const TRIAGE_ALLOWED_FIELDS = ['id', 'title', 'note', 'source', 'created_at', 'created_by', 'status'];
export const TRIAGE_ALLOWED_SOURCE_FIELDS = ['type', 'thread_id', 'session_id'];

function assertStringField(entry, field) {
  if (typeof entry[field] !== 'string' || entry[field].length === 0) throw new Error(`missing ${field}`);
}

export function validateTriageEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('entry is not an object');

  for (const field of Object.keys(entry)) {
    if (!TRIAGE_ALLOWED_FIELDS.includes(field)) throw new Error(`forbidden field ${field}`);
  }
  for (const field of TRIAGE_ALLOWED_FIELDS.filter((candidate) => candidate !== 'source')) {
    assertStringField(entry, field);
  }
  if (entry.status !== 'TRIAGE') throw new Error('status must be TRIAGE');

  if (!entry.source || typeof entry.source !== 'object' || Array.isArray(entry.source)) throw new Error('missing source');
  for (const field of Object.keys(entry.source)) {
    if (!TRIAGE_ALLOWED_SOURCE_FIELDS.includes(field)) throw new Error(`forbidden source field ${field}`);
    if (typeof entry.source[field] !== 'string' || entry.source[field].length === 0) throw new Error(`missing source.${field}`);
  }
  if (typeof entry.source.type !== 'string' || entry.source.type.length === 0) throw new Error('missing source.type');
  return entry;
}

function parseLine(line, index) {
  try {
    return validateTriageEntry(JSON.parse(line));
  } catch (error) {
    throw new Error(`TRIAGE inbox line ${index + 1} is malformed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readTriageEntries(path = TRIAGE_INBOX) {
  const sourcePath = assertAllowedSourcePath(path);
  if (!existsSync(sourcePath)) return [];
  return readFileSync(sourcePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine);
}

export function triageEntryToAnchor(entry) {
  return {
    id: entry.id,
    title: entry.title,
    kind: 'StandaloneTask',
    evidence_paths: [TRIAGE_INBOX],
    source_labels: ['Hermes TRIAGE inbox'],
    thread_anchor: entry.source.type,
  };
}

export function readTriageObservations(anchor, observedAt = new Date().toISOString()) {
  if (!(anchor.evidence_paths ?? []).some((path) => assertAllowedSourcePath(path) === TRIAGE_INBOX)) return [];
  const sourcePath = assertAllowedSourcePath(TRIAGE_INBOX);
  const label = sourcePathLabel(sourcePath);
  if (!existsSync(sourcePath)) {
    return [createObservation({
      id: `${anchor.id}:triage:missing-inbox`,
      worknodeId: anchor.id,
      sourceKind: 'HermesTriage',
      sourcePath,
      sourcePathLabel: label,
      observedAt,
      observationType: 'reader_error',
      strength: 'error',
      confidence: 'low',
      summary: 'TRIAGE inbox is missing; generation fails closed for TRIAGE evidence.',
      redaction: 'redacted',
    })];
  }

  const entries = readTriageEntries(sourcePath);
  if (anchor.id === 'cb-triage-capture-contract') {
    return [createObservation({
      id: `${anchor.id}:triage:contract`,
      worknodeId: anchor.id,
      sourceKind: 'HermesTriage',
      sourcePath,
      sourcePathLabel: label,
      observedAt,
      observationType: 'artifact_present',
      strength: 'medium',
      confidence: 'high',
      summary: `TRIAGE inbox contract is readable with ${entries.length} contract-valid item(s).`,
      redaction: 'redacted',
      metadata: { itemCount: entries.length },
    })];
  }

  return entries
    .filter((entry) => entry.id === anchor.id)
    .map((entry) => createObservation({
      id: `${anchor.id}:triage:item`,
      worknodeId: anchor.id,
      sourceKind: 'HermesTriage',
      sourcePath,
      sourcePathLabel: label,
      sourceRef: entry.source.thread_id ?? entry.source.session_id ?? entry.source.type,
      observedAt: entry.created_at || observedAt,
      observationType: 'triage_item',
      strength: 'weak',
      confidence: 'medium',
      summary: `TRIAGE capture preserved: ${entry.title}`,
      rawExcerpt: entry.note,
      redaction: 'verifier_only',
      metadata: { createdBy: entry.created_by, sourceType: entry.source.type },
    }));
}

export function readTriageDynamicAnchors() {
  return readTriageEntries(TRIAGE_INBOX).map(triageEntryToAnchor);
}
