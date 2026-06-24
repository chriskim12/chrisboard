# Chrisboard

Private read-only WorkNode dashboard proof for Chris.

## What v1 proves

- Vite + React + TypeScript local app.
- Exact status vocabulary: TRIAGE, TODO, DOING, WAITING, REVIEW, DONE, RESIDUE.
- WorkNode kinds remain distinct: ParentGoal, ChildWork, StandaloneTask.
- Parent Done is not inferred from child Done alone; parent acceptance requires explicit source evidence.
- Static `src/data/worknodes.json` read model rendered through a read-only adapter.
- Minimal board chrome: status columns are structure; workflow legends/subtitles are intentionally absent.

## Read-only boundary

Adapters expose `loadWorkNodes()` only and declare `mode: 'read-only'` plus allowlisted sources. They do not include write, dispatch, resume, pause, assign, mark-done, POST, PUT, PATCH, or DELETE behavior.

## Hosting authority

Deployment SSOT is Cloudflare Pages, not GitHub Pages.

- Production URL: `https://chriskim12.work`
- Cloudflare Pages project: `chrisboard`
- Access boundary: Cloudflare Access allows Chris only on `chriskim12.work`, `www.chriskim12.work`, and `chrisboard.pages.dev`.
- DNS must route through Cloudflare proxy for Access enforcement.
- GitHub Pages is intentionally disabled and has no workflow/CNAME authority.

## Non-goals

- No control-panel behavior, task creation, assignment, status movement, mark-done, dispatch, pause, or resume controls.
- No writable Discord, Kanban, GitHub, worker, production, customer, provider, env, or secret mutation from the app.
- No broad historical backfill or automatic correlation claim.

## Future approval gates

Separate Chris approval is required before turning Chrisboard into a control panel, connecting writable systems, restarting gateways, or dispatching/resuming workers.

## Local commands

```sh
npm install
npm run build
npm run test
npm run verify:readonly
npm run dev
```
