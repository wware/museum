# Notes: a museum exhibit for gitops_reconciler

**Status:** ideas and open questions, not a plan. Read this when it's time to build the exhibit.

Source project: `../gitops_reconciler` (see its `README.md`, `DEMO.md`, `PROMOTION.md`, and `UI_OPTIONS.md`).

## Conclusion so far

A manifest-driven exhibit (no exhibit code shipped to the browser) can cover everything interesting here. The heavy lifting belongs in the service, not the contract.

## What a visitor should be able to do

- **Change desired state.** Edit a port or image tag in a compose file, commit, revert. This is DEMO.md's `sed` + `git commit` steps as controls.
- **Watch convergence.** Each tick and its result (`changed`, `no_change`, `failed`), with git SHA and message.
- **Control timing.** "Tick now" and a poll-interval setting.
- **Drill into the resource tree.** The `ResourceNode` shape from UI_OPTIONS.md, with `meta` in a detail panel.
- **Promote.** Staging and prod side by side with a promote action (PROMOTION.md).
- **Cause drift.** Stop a container behind the reconciler's back.
- **See the deployed app.** An embedded view of the example CRUD app.

## What the manifest vocabulary needs for this

- **Controls:** button, select, number/slider, multi-line text editor (for editing the compose file).
- **Views:** tree (`ResourceNode` JSON), event log/timeline, key-value detail panel, code/diff view, embed of a URL the service names.
- **Wiring:** "after this action, refresh these views", and polling intervals. SSE is optional later.

## Design rules this exhibit motivated

1. **Server owns state and logic.** Each state response says which actions are currently allowed. The museum never evaluates conditions like "disable Promote while staging failed".
2. **Museum renders data, not markup.** The service returns `ResourceNode` JSON and the museum draws it with D3. This replaces UI_OPTIONS.md's DOT-to-SVG plan and removes its escaping problem, since labels are inserted as text. The existing simulated GitOps visualizer can be the fallback when the service is down.

## Work on the service side

- **Wrap the one-shot model.** `tick()` plus `watch_and_reconcile.sh` must become a long-running FastAPI process that holds state and event history.
- **Report progress within a tick** ("acquired lock", "hash differs", "running compose up") if step-by-step animation is wanted.
- **Scratch workspace.** Its own git repo and compose files, never a real checkout, plus a reset action.
- **Docker access.** Needs the Docker socket, so it belongs in a separate lab container.
- **`resource_tree()` doesn't exist yet.** For Compose it's straightforward via `docker compose ps --format json` (UI_OPTIONS.md, step 3).

## A finding worth building an exhibit beat around

`ComposeBackend.apply()` only compares a hash of the compose file. If a container is stopped out of band, the next tick reports `NO_CHANGE` and nothing heals. That is the README's "faked idempotency" caveat, demonstrated live. Show drift being ignored, then contrast with a backend that diffs real state.

## Open questions

- **Terminal or not?** A real shell needs the iframe escape hatch and a much bigger security story. The text editor may be enough.
- **Polling or SSE?** Polling about once a second is probably fine for tick-level updates.
- **Which backends?** Compose first. Terraform would show the contrast (real diffing, drift that does heal) but needs credentials or a local provider.
- **Promotion in the first version, or later?**
- **Should the exhibit add a drift-detecting Compose variant**, or only show the current behavior and explain it?
