# Chrisboard

Private read-only WorkNode dashboard proof for Chris.

## What v1 proves

- Vite + React + TypeScript local app.
- Source-backed generated read model: Node scripts read allowlisted Git/GJC/OMH/TRIAGE evidence, normalize `SourceObservation` objects, reconcile conservative WorkNode judgments, and emit browser-safe JSON.
- Exact status vocabulary and board order: `TRIAGE / TODO / RUNNING / REVIEW / BLOCKED / LANDED / RESIDUE / DONE`.
- Legacy `DOING` and `WAITING` are not WorkNode statuses.
- `LANDED` is not `DONE`: landing/integration evidence still needs final proof before final completion.
- WorkNode kinds remain distinct: ParentGoal, ChildWork, StandaloneTask.
- Parent Done is not inferred from child Done alone; parent acceptance requires explicit source evidence.
- Agent self-report alone cannot produce final Done.
- Minimal board chrome: status columns are structure; workflow legends/subtitles are intentionally absent.

## Source-backed read model

Canonical files:

- Locator-only anchor registry: `src/read-model/anchors/worknode-anchors.json`.
- Node-only pipeline: `scripts/read-model/`.
- Generated browser data: `src/data/worknodes.generated.json`.
- Verifier provenance sidecar: `src/data/worknodes.provenance.json`.
- Named verifier fixtures: `scripts/read-model/fixtures/`.

The anchor registry stores identity and source locators only. It must not store canonical status, Done, blocked, residue, running, landed, final proof, or execution approval truth. Readers enforce a path allowlist before producing observations. Reader errors, malformed data, out-of-allowlist paths, conflicts, dirty/unpushed/stale evidence, and missing required evidence fail closed and cannot produce false Done.

Browser-visible generated data contains redacted source labels only. Raw excerpts, arbitrary filesystem paths, secrets, provider/customer data, and sensitive logs stay out of the React bundle.
The active checkout root defaults to `process.cwd()` and can be overridden with `CHRISBOARD_REPO_ROOT`. OMH, TRIAGE, and Hermes goal-run sources are workstation-local verifier inputs, configurable with `CHRISBOARD_OMH_ROOT`, `CHRISBOARD_TRIAGE_INBOX`, and `CHRISBOARD_ULTRAGOAL_RUN_ROOT`; browser data receives only generic redacted labels.


## TRIAGE inbox contract

TRIAGE capture is the only scoped write contract and is outside React/browser code.

- Default workstation-local path: `/home/ubuntu/.hermes/omh/chrisboard/triage/inbox.jsonl` (`CHRISBOARD_TRIAGE_INBOX` may override it for local verification).
- Writer authority: Hermes skill or Hermes skill-backed Node workflow only.
- Entry fields: `id`, `title`, `note`, `source.type`, optional `source.thread_id`, optional `source.session_id`, `created_at`, `created_by`, and `status: TRIAGE`.
- Non-authority: capture does not execute, create RALPLAN, promote to TODO, dispatch/resume/pause/assign workers, mark done, approve execution, or claim readiness.

## Read-only boundary

Adapters expose `loadWorkNodes()` only and declare `mode: 'read-only'` plus allowlisted generated/provenance sources. The React app consumes generated data through the read-only adapter and has no write, dispatch, resume, pause, assign, mark-done, POST, PUT, PATCH, DELETE, gateway, secret, provider, customer, production, or external-send behavior.

## Hosting authority

Deployment SSOT is Cloudflare Pages, not GitHub Pages.

- Production URL: `https://chriskim12.work`
- Cloudflare Pages project: `chrisboard`
- Access boundary: Cloudflare Access allows Chris only on `chriskim12.work`, `www.chriskim12.work`, `chrisboard.pages.dev`, and `*.chrisboard.pages.dev` preview deployments.
- DNS must route through Cloudflare proxy for Access enforcement.
- GitHub Pages is intentionally disabled and has no workflow/CNAME authority.

## Non-goals

- No control-panel behavior, task creation, assignment, status movement, mark-done, dispatch, pause, or resume controls.
- No writable Discord, external tracker, GitHub, worker, production, customer, provider, env, or secret mutation from the app.
- No broad Discord history ingestion or automatic all-repo discovery.
- No runtime service/control API beyond the build-time generated read model.
- Cloudflare Pages deployment/publish remains an explicit operator approval gate, separate from local implementation.

## Future approval gates

Separate Chris approval is required before turning Chrisboard into a control panel, connecting writable systems, adding runtime services, broad-ingesting Discord, restarting gateways, deploying/publishing Cloudflare Pages, mutating secrets/env/provider/customer/production state, or dispatching/resuming workers.

## Local commands

```sh
npm install
npm run generate:read-model
npm run test
npm run verify:readonly
npm run build
npm run dev
```
