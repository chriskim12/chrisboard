import { isAbsolute, normalize, resolve, relative, sep } from 'node:path';

function resolveEnvPath(name, fallback) {
  const configured = process.env[name];
  const rawPath = configured && configured.trim().length > 0 ? configured : fallback;
  return normalize(isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath));
}

export const REPO_ROOT = resolveEnvPath('CHRISBOARD_REPO_ROOT', process.cwd());
export const OMH_ROOT = resolveEnvPath('CHRISBOARD_OMH_ROOT', '/home/ubuntu/.hermes/omh/chrisboard');
export const TRIAGE_INBOX = resolveEnvPath('CHRISBOARD_TRIAGE_INBOX', resolve(OMH_ROOT, 'triage/inbox.jsonl'));
export const ULTRAGOAL_RUN_ROOT = resolveEnvPath('CHRISBOARD_ULTRAGOAL_RUN_ROOT', '/home/ubuntu/.hermes/goal-runs/chrisboard');
export const LOCAL_REPOS_ROOT = resolveEnvPath('CHRISBOARD_LOCAL_REPOS_ROOT', '/home/ubuntu/repos');
export const LOCAL_WORKTREES_ROOT = resolveEnvPath('CHRISBOARD_LOCAL_WORKTREES_ROOT', '/home/ubuntu/worktrees');

const ALLOWED_ROOTS = [REPO_ROOT, OMH_ROOT, ULTRAGOAL_RUN_ROOT, LOCAL_REPOS_ROOT, LOCAL_WORKTREES_ROOT];
const FORBIDDEN_SEGMENTS = new Set(['.env', '.ssh', '.aws', '.config', 'secrets', 'secret', 'tokens', 'providers', 'customers', 'node_modules', 'dist']);

function toAbsolute(path) {
  return normalize(isAbsolute(path) ? path : resolve(REPO_ROOT, path));
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`${sep}..`) && !isAbsolute(rel));
}

function hasForbiddenSegment(candidate) {
  return candidate.split(sep).some((segment) => FORBIDDEN_SEGMENTS.has(segment.toLowerCase()));
}

export function normalizeSourcePath(path) {
  return toAbsolute(path);
}

export function isAllowedSourcePath(path) {
  const candidate = toAbsolute(path);
  if (hasForbiddenSegment(candidate)) return false;
  if (candidate === TRIAGE_INBOX) return true;
  return ALLOWED_ROOTS.some((root) => isInside(root, candidate));
}

export function assertAllowedSourcePath(path) {
  const candidate = toAbsolute(path);
  if (!isAllowedSourcePath(candidate)) {
    throw new Error(`Source path is outside the Chrisboard allowlist: ${path}`);
  }
  return candidate;
}

export function sourcePathLabel(path) {
  const candidate = toAbsolute(path);
  if (candidate === TRIAGE_INBOX) return 'omh:triage-inbox';
  if (isInside(REPO_ROOT, candidate)) {
    const rel = relative(REPO_ROOT, candidate) || '.';
    return rel.startsWith('.gjc') ? `repo:.gjc/${rel.split(sep).slice(1, 3).join('/')}` : `repo:${rel}`;
  }
  if (isInside(OMH_ROOT, candidate)) {
    const [top] = relative(OMH_ROOT, candidate).split(sep);
    return `omh:${[top, 'configured'].filter(Boolean).join('/')}`;
  }
  if (isInside(ULTRAGOAL_RUN_ROOT, candidate)) return process.env.CHRISBOARD_ULTRAGOAL_RUN_ROOT ? 'hermes-goal-run:configured' : 'hermes-goal-run:redacted';
  if (isInside(LOCAL_REPOS_ROOT, candidate)) return process.env.CHRISBOARD_LOCAL_REPOS_ROOT ? 'local-repo:configured' : 'local-repo:redacted';
  if (isInside(LOCAL_WORKTREES_ROOT, candidate)) return process.env.CHRISBOARD_LOCAL_WORKTREES_ROOT ? 'local-worktree:configured' : 'local-worktree:redacted';
  return 'redacted:allowlisted-source';
}

export function isBrowserSafePathLabel(label) {
  return /^(repo:(?!\.\.)(?:[\w./-]+)|omh:[\w./-]+|hermes-goal-run:(?:configured|redacted)|local-repo:(?:configured|redacted)|local-worktree:(?:configured|redacted)|redacted:allowlisted-source)$/.test(label);
}
