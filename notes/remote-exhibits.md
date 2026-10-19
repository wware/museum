# Remote exhibits: design decisions and next steps

**Status:** design in progress, nothing implemented. Replaces the old HYBRID_ARCHITECTURE.md (Proxmox/Terraform plan), which was deleted.

A remote exhibit is one whose behavior comes from an outside service (for now, a FastAPI service running locally). The museum stays static. All heavy machinery (containers, clusters, VMs) lives in the service.

## Decided

- **Manifest, not shipped code** ("manifest until proven otherwise"). The service describes controls, the endpoints they call, and the data views to draw. The museum's own TypeScript builds and renders everything. No service-supplied HTML/JS/CSS runs in the page. A sandboxed iframe stays available as an escape hatch for an exhibit that can't be described this way (for example a real terminal), but only once one proves it needs it.
- **The manifest is the service's OpenAPI 3.1 document**, with museum-specific `x-museum*` extensions (see "Manifest format" below). FastAPI generates it, so it's always in sync with the routes, and it can be browsed at `/docs`.
- **Fixed URL conventions.** Actions are `POST /exhibits/{id}/actions/{name}`; state is `GET /exhibits/{id}/state`.
- **Server owns state and logic.** Each state response says which actions are currently allowed. The museum never evaluates conditions.
- **Museum renders data, not markup.** Views consume typed JSON (tree, log, key-value, and so on), so service-supplied strings are inserted as text.
- **One service can host several exhibits.** Health and contract version are per service. Each exhibit lives under its own id (`/exhibits/{id}/...`), and one `openapi.json` describes them all.
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

## Manifest format

No single existing format covers controls, views and layout together (OpenAPI covers endpoints, JSON Forms covers control layout, Siren covers hypermedia actions, Vega-Lite covers charts). OpenAPI is the container, and presentation goes in extensions, which other tools ignore.

- **Actions** are ordinary operations. Their parameter types and Pydantic constraints (`ge`/`le`, `Literal[...]` for a select, defaults) come from the generated request-body schemas.
- **`x-museum-control` on each action operation** gives the control type (button, slider, select, text editor), label, and ordering. A slider is an action with one numeric parameter, sent when it changes. A button has no parameters.
- **A top-level `x-museum` section, keyed by exhibit id,** holds things that belong to no single endpoint: the views (name, type such as chart/tree/log/key-value, and which part of the state feeds each one) and layout.
- **The state's shape is documented** by the response model of `GET /exhibits/{id}/state` in the same document.
- **One service, several exhibits:** one `openapi.json`, and the museum picks out each exhibit's operations by path prefix.
- **The museum's OpenAPI reader can be small.** Support what FastAPI emits: request-body schemas and local `$ref` resolution. Not a general OpenAPI implementation.

### The state response

Every action returns the new state, and the museum also fetches it on load and on a polling timer. It carries:

- **View data:** what each view draws. Views have no URLs of their own.
- **Enabled actions:** which actions are available right now, with an optional reason when one is disabled, shown as a tooltip ("can't promote: staging failed").
- **Current control values:** for example a slider's setting, so a reload or a second tab shows controls that match the service.

The museum fetches the manifest once to build the page, then keeps the page in sync with the state. The simplest wiring rule is "after any action, redraw every view from the returned state", so the manifest may not need to describe refresh relationships at all.

### Browsing the manifest

FastAPI serves `/docs` (Swagger UI with "Try it out", useful for driving an exhibit by hand before the museum side exists), `/redoc`, and the raw `/openapi.json`. Swagger UI hides `x-` fields unless the app sets `swagger_ui_parameters={"showExtensions": True}`.

## Contract files (draft)

- `contract/x-museum.schema.json`: JSON Schema (2020-12, same dialect as OpenAPI 3.1) for the root `x-museum` object, with `$defs` for `x-museum-control`, the `/healthz` and `/exhibits` responses, the state envelope, and the data shape of each view type. Strict about unknown keys, so typos fail.
- `contract/examples/queue.openapi.json`: a realistic manifest for the toy exhibit, generated from a throwaway FastAPI app (FastAPI 0.149, Pydantic 2.14) rather than written by hand, so it shows exactly what FastAPI emits.
- `contract/examples/queue.state.json`: a matching state response, at a moment where arrivals exceed capacity.

### What drafting them settled

- **The toy exhibit (tentative): "The checkout line"**, a queue with random arrivals and one to three servers. Sliders for arrival and service rate, a select for the number of servers, buttons for a rush-hour burst, pause, resume and reset. Views: a chart of people waiting, current stats, an event log. It exercises every v1 control type except text and number, disabled actions with reasons, and confirmation.
- **The state envelope has fixed keys:** `views` (keyed by view name; each view draws `state.views[view.name]`), `actions` (`{enabled, reason}`; an action missing from the map is disabled), and `values` (keyed by action name, then parameter name).
- **v1 vocabulary.** Controls: button, slider, select, number, text (`multiline` optional). Views: chart (`[x, y]` series), kv (label/value/unit items), log (entries with optional time and level). Tree, code and embed wait for the gitops exhibit.
- **Layout for v1 is fixed:** controls in ascending `order`, above the views in manifest order. Anything fancier waits until an exhibit needs it.
- **`confirm`** on a control makes the museum ask before sending (used for Reset).
- **Slider steps live in `x-museum-control.step`, not in the request schema.** FastAPI turns `multiple_of=0.1` into `multipleOf: 0.1`, and while Pydantic accepts 0.3 against it, standard JSON Schema validators reject 0.3, 0.7, 2.3 and so on because of floating point. `multipleOf` is only safe for integers.
- **FastAPI emits what the design needs:** `ge`/`le` as `minimum`/`maximum`, `Literal[...]` as an `enum`, request bodies as `$ref`s into `components.schemas`, and both kinds of extension pass through. Root-level `x-museum` requires overriding `app.openapi`; per-operation fields use `openapi_extra`.

### Rules the schema can't express

These span documents, so the museum (and any contract test for a service) must check them in code. All were exercised against the examples with a throwaway checker, including bad inputs that each rule caught.

- Every `POST /exhibits/{exhibit}/actions/{name}` has an `x-museum-control`, and `{exhibit}` is declared under `x-museum.exhibits`.
- A control's `param` exists in the operation's request body. A button's operation has no request-body properties.
- A select's param has an `enum`. A slider's param has `minimum` and `maximum`.
- Every declared view has data in `state.views`, and there's no data for undeclared views. Each view's data matches the shape for its type.
- `state.actions` and `state.values` only name real actions, and `state.values` respects each parameter's published type and limits.

## Contract sketch (to be designed properly)

- `GET /healthz`: status, contract version, service name.
- `GET /exhibits`: the exhibits this service offers.
- `GET /openapi.json`: the manifest, covering every exhibit the service hosts.
- `GET /exhibits/{id}/state`: current data for views, plus which actions are allowed.
- `POST /exhibits/{id}/actions/{action}`: perform an action with parameters, returning the new state.

## Open questions

- **The `x-museum` vocabulary for v1.** Starting point: controls are button, select, number/slider, text editor. Views are tree, log/timeline, key-value, code/diff, chart, embed (a URL the service names).
- **How to detect the Pages build.** Probably simplest at build time: the Pages workflow builds with a config (for example a `mkdocs.pages.yml` that inherits `mkdocs.yml`) that sets no service URLs, so pages show "not configured". Hiding those pages from navigation on Pages is possible the same way, but may not be worth it, since the closed placard plus the page text is still a reasonable thing to see.
- **Sessions.** Shared state is fine on localhost. Reserve an optional session id in the contract so per-visitor state stays possible later.
- **Versioning: deferred** until the design settles. When it's revisited, the idea is to version the `x-museum` extension format separately from each exhibit's own version and from the OpenAPI version. Until then the "Incompatible" placard state has nothing to check.
- **Does Swagger UI display root-level extensions?** With `showExtensions` on it shows extensions on operations and parameters. Unclear whether the top-level `x-museum` section shows anywhere but the raw JSON.
- **How the museum validates the manifest.** Probably a JSON Schema for the `x-museum` extensions, kept in this repo.
- **CORS and Chrome's Private Network Access.** A page on one origin calling `http://localhost` needs CORS headers and, in Chrome, a private-network preflight answer. Serving the museum and the service behind one nginx (`/lab/` proxied to the service, via docker compose) avoids both.
- **Testing.** Playwright stubs the service endpoints so CI covers every placard state and a working exhibit without running Python. A tiny fake FastAPI service is for local development.
- **Should the contract checker be committed?** The cross-document rules above could become a script (or a pytest plugin) that services run in their own CI against their generated `openapi.json`.

## Next steps

1. ~~Pick the toy exhibit.~~ Tentatively "The checkout line" (see "Contract files").
2. ~~Specify the `x-museum` extensions and the v1 vocabulary, with an example `openapi.json`.~~ Drafted in `contract/`; revisit after the museum side exists.
3. Build the museum side: a placeholder element, site config for service URLs, placard states, and the renderer for the v1 vocabulary.
4. Build the toy FastAPI service and the Playwright stubs.
