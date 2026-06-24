# Chrisboard

Local-only read-only WorkNode dashboard proof for Chris.

## What v1 proves

- Vite + React + TypeScript local app.
- Exact status vocabulary: TRIAGE, TODO, DOING, WAITING, REVIEW, DONE, RESIDUE.
- WorkNode kinds remain distinct: ParentGoal, ChildWork, StandaloneTask.
- Parent Done is not inferred from child Done alone; parent acceptance requires explicit source evidence.
- Mock WorkNodes cover planning, active, waiting, review, done, residue, conflict, evidence-missing, parent-partial, and standalone cases.
- Two real read-only WorkNodes are rendered from allowlisted/redacted local evidence:
  - `/home/ubuntu/.hermes/omh/task-management-dashboard/plans/2026-06-24-chrisboard-v1-readonly-proof.md`
  - `.gjc/ultragoal/goals.json`

## Read-only boundary

Adapters expose `loadWorkNodes()` only and declare `mode: 'read-only'` plus allowlisted sources. They do not include write, dispatch, resume, pause, assign, mark-done, POST, PUT, PATCH, or DELETE behavior.

## Non-goals

- No GitHub remote, push, PR, merge, release, or deploy.
- No DNS, auth, proxy, gateway restart/reload, or public URL exposure.
- No Discord, Kanban, GitHub, worker, production, customer, provider, env, or secret mutation.
- No task creation, assignment, status movement, mark-done, dispatch, pause, or resume controls.
- No broad historical backfill or automatic correlation claim.

## Future approval gates

Separate Chris approval is required before turning Chrisboard into a control panel, connecting writable systems, publishing `chriskim12.work`, creating a remote, deploying, restarting gateways, or dispatching/resuming workers.

## Local commands

```sh
npm install
npm run build
npm run test
npm run verify:readonly
npm run dev
```
