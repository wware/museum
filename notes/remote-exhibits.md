# Remote exhibits: design decisions and next steps

**Status:** design in progress, nothing implemented. Replaces the old HYBRID_ARCHITECTURE.md (Proxmox/Terraform plan), which was deleted.

A remote exhibit is one whose behavior comes from an outside service (for now, a FastAPI service running locally). The museum stays static. All heavy machinery (containers, clusters, VMs) lives in the service.

## Decided

- **Manifest, not shipped code** ("manifest until proven otherwise"). The service describes controls, the endpoints they call, and the data views to draw. The museum's own TypeScript builds and renders everything. No service-supplied HTML/JS/CSS runs in the page. A sandboxed iframe stays available as an escape hatch for an exhibit that can't be described this way (for example a real terminal), but only once one proves it needs it.
- **Server owns state and logic.** Each state response says which actions are currently allowed. The museum never evaluates conditions.
- **Museum renders data, not markup.** Views consume typed JSON (tree, log, key-value, and so on), so service-supplied strings are inserted as text.
- **One service can host several exhibits.** Health and contract version are per service. Each exhibit lives under its own id, for example `/exhibits/{id}/manifest`.
- **Pages name services by logical id, never by URL.** The base URL for each service comes from site config, so changing where a service runs is a config change, not an edit to every page.
- **The public GitHub Pages site shows the exhibit as permanently unavailable**, in museum language (for example "This exhibit is only on display at a local branch of the museum"), and explains how to run it locally. The page's text content still shows.
- **First implementation is a toy remote exhibit** to prove the contract end to end, not the gitops reconciler. See `gitops-reconciler-exhibit.md` for that one.
- **Polling first.** SSE is deferred. Design the state response so it could later be pushed instead of polled without changing what views consume.

## Placard states the museum distinguishes

- **Unreachable:** nothing answers within a short timeout.
- **Unhealthy:** `/healthz` answers but reports a problem.
- **Incompatible:** the service speaks a manifest/contract version the museum doesn't support.
- **Not configured:** no base URL for this service in this build (the GitHub Pages case). Shown as permanently closed, with no retry.
- **Ready:** render the exhibit.

The first three get a "check again" button.

## Contract sketch (to be designed properly)

- `GET /healthz`: status, contract version, service name.
- `GET /exhibits`: the exhibits this service offers.
- `GET /exhibits/{id}/manifest`: controls, views, wiring, poll intervals.
- `GET /exhibits/{id}/state`: current data for views, plus which actions are allowed.
- `POST /exhibits/{id}/actions/{action}`: perform an action with parameters, returning the new state.

## Open questions

- **Manifest vocabulary for v1.** Starting point: controls are button, select, number/slider, text editor. Views are tree, log/timeline, key-value, code/diff, chart, embed (a URL the service names).
- **How to detect the Pages build.** Probably simplest at build time: the Pages workflow builds with a config (for example a `mkdocs.pages.yml` that inherits `mkdocs.yml`) that sets no service URLs, so pages show "not configured". Hiding those pages from navigation on Pages is possible the same way, but may not be worth it, since the closed placard plus the page text is still a reasonable thing to see.
- **Sessions.** Shared state is fine on localhost. Reserve an optional session id in the contract so per-visitor state stays possible later.
- **Versioning.** Version the manifest format separately from each exhibit's own version.
- **CORS and Chrome's Private Network Access.** A page on one origin calling `http://localhost` needs CORS headers and, in Chrome, a private-network preflight answer. Serving the museum and the service behind one nginx (`/lab/` proxied to the service, via docker compose) avoids both.
- **Testing.** Playwright stubs the service endpoints so CI covers every placard state and a working exhibit without running Python. A tiny fake FastAPI service is for local development.
- **What the toy exhibit is.** Something small, such as a queue or cache you poke with buttons and watch on a chart.

## Next steps

1. Pick the toy exhibit.
2. Write the contract down as a versioned JSON Schema in this repo, plus the v1 manifest vocabulary.
3. Build the museum side: a placeholder element, site config for service URLs, placard states, and the renderer for the v1 vocabulary.
4. Build the toy FastAPI service and the Playwright stubs.
