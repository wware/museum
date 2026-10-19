"use strict";
// Remote exhibits: exhibits whose behavior comes from an outside service that describes
// itself with an OpenAPI 3.1 document plus x-museum extensions (notes/remote-exhibits.md,
// contract/x-museum.schema.json). A page marks a spot with
//     <div class="remote-exhibit" data-service="museum" data-exhibit="queue"></div>
// and docs/remote-services.json maps each service id to its base URL.
// Service-supplied strings are only ever inserted with textContent.
// Captured at load time: currentScript is null once the script has finished running
const SITE_ROOT = new URL("../", document.currentScript?.src ?? location.href);
const REQUEST_TIMEOUT_MS = 4000;
const WORKER_START_TIMEOUT_MS = 5000;
const FAILURES_BEFORE_CLOSING = 3;
const LOG_ROWS_SHOWN = 12;
class ServiceError extends Error {
    constructor(kind, message) {
        super(message);
        this.kind = kind;
    }
}
// === PLACARDS ===
const PLACARDS = {
    loading: { title: "Opening the exhibit…", text: "Checking that the exhibit's machinery is running.", retry: false },
    not_configured: {
        title: "Exhibit closed",
        text: "This exhibit is only on display at a local branch of the museum.",
        retry: false,
    },
    unreachable: {
        title: "Exhibit temporarily closed",
        text: "The exhibit's machinery isn't answering.",
        retry: true,
    },
    unhealthy: { title: "Under restoration", text: "The exhibit's machinery reports a problem.", retry: true },
    incompatible: {
        title: "Exhibit cannot be displayed",
        text: "The museum can't read this exhibit's description.",
        retry: true,
    },
};
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function showPlacard(container, kind, detail, onRetry) {
    const info = PLACARDS[kind];
    container.dataset.state = kind;
    const card = el("div", `remote-placard remote-placard--${kind}`);
    card.setAttribute("role", "status");
    card.append(el("div", "remote-placard-title", info.title), el("p", "remote-placard-text", info.text));
    if (detail)
        card.append(el("p", "remote-placard-detail", detail));
    if (info.retry && onRetry) {
        const retry = el("button", "remote-button", "Check again");
        retry.type = "button";
        retry.addEventListener("click", onRetry);
        card.append(retry);
    }
    container.replaceChildren(card);
}
async function fetchJson(url, init = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    }
    catch (err) {
        const why = controller.signal.aborted ? "it took too long to answer" : "the request failed";
        throw new ServiceError("unreachable", `${url.pathname}: ${why}`);
    }
    finally {
        clearTimeout(timer);
    }
    let body = null;
    try {
        body = await response.json();
    }
    catch {
        // not JSON; callers look at the status
    }
    return { status: response.status, body };
}
let configPromise = null;
function loadConfig() {
    configPromise ?? (configPromise = fetchJson(new URL("remote-services.json", SITE_ROOT))
        .then((r) => {
        const services = r.body?.services;
        return r.status === 200 && services ? services : {};
    })
        .catch(() => ({})));
    return configPromise;
}
// An in-museum service runs in a service worker, which only answers requests from pages
// inside its scope. The page must be controlled by it before the first request.
async function ensureWorker(scriptUrl, scope) {
    if (!("serviceWorker" in navigator)) {
        throw new ServiceError("unreachable", "This browser can't run the museum's in-house exhibit service.");
    }
    if (!location.href.startsWith(scope.href)) {
        throw new ServiceError("incompatible", `This page is outside the in-house service's scope (${scope.pathname}).`);
    }
    const container = navigator.serviceWorker;
    const controlled = new Promise((resolve) => {
        if (container.controller)
            resolve();
        container.addEventListener("controllerchange", () => resolve(), { once: true });
    });
    let registration;
    try {
        registration = await container.register(scriptUrl.href, { scope: scope.href });
    }
    catch {
        throw new ServiceError("unreachable", "The museum's in-house exhibit service couldn't be started.");
    }
    if (!container.controller) {
        // Already active (for example after a hard reload): ask it to take control of this page
        registration.active?.postMessage("claim");
    }
    const timeout = new Promise((resolve) => setTimeout(() => resolve("timeout"), WORKER_START_TIMEOUT_MS));
    if ((await Promise.race([controlled, timeout])) === "timeout") {
        throw new ServiceError("unreachable", "The museum's in-house exhibit service didn't start in time.");
    }
}
// === MANIFEST ===
function deref(doc, node) {
    let current = node;
    for (let hops = 0; current && typeof current.$ref === "string" && hops < 20; hops++) {
        const ref = current.$ref;
        if (!ref.startsWith("#/"))
            throw new ServiceError("incompatible", `Only local $refs are supported (${ref}).`);
        let target = doc;
        for (const part of ref.slice(2).split("/")) {
            target = target?.[part];
        }
        current = target;
    }
    return current ?? {};
}
const CONTROL_TYPES = ["button", "slider", "select", "number", "text"];
const VIEW_TYPES = ["chart", "kv", "log"];
function readManifest(body, exhibitId) {
    const doc = body;
    const fail = (why) => {
        throw new ServiceError("incompatible", why);
    };
    if (!doc || typeof doc !== "object" || typeof doc.openapi !== "string")
        fail("The service's openapi.json isn't an OpenAPI document.");
    const exhibits = doc["x-museum"]?.exhibits;
    const exhibit = exhibits?.[exhibitId];
    if (!exhibit)
        fail(`The service doesn't describe an exhibit called "${exhibitId}".`);
    if (!Array.isArray(exhibit.views) || exhibit.views.length === 0)
        fail(`Exhibit "${exhibitId}" has no views.`);
    for (const view of exhibit.views) {
        if (!VIEW_TYPES.includes(view.type))
            fail(`View "${view.name}" has unknown type "${view.type}".`);
    }
    const actionPath = new RegExp(`^/exhibits/${exhibitId}/actions/([a-z][a-z0-9_]*)$`);
    const actions = [];
    for (const [path, item] of Object.entries((doc.paths ?? {}))) {
        const match = actionPath.exec(path);
        if (!match)
            continue;
        const op = item.post;
        const control = op?.["x-museum-control"];
        if (!op || !control)
            fail(`Action "${match[1]}" has no x-museum-control.`);
        if (!CONTROL_TYPES.includes(control.type))
            fail(`Action "${match[1]}" has unknown control type "${control.type}".`);
        const content = op.requestBody?.content;
        const bodySchema = deref(doc, content?.["application/json"]?.schema);
        const props = (bodySchema.properties ?? {});
        let param;
        if (control.type !== "button") {
            if (!control.param || !(control.param in props))
                fail(`Action "${match[1]}" sets a parameter its request body doesn't have.`);
            param = deref(doc, props[control.param]);
            if (control.type === "select" && !Array.isArray(param.enum))
                fail(`Select "${match[1]}" has no list of choices.`);
            if (control.type === "slider" && (typeof param.minimum !== "number" || typeof param.maximum !== "number")) {
                fail(`Slider "${match[1]}" needs a minimum and maximum.`);
            }
        }
        actions.push({ name: match[1], control: control, param });
    }
    actions.sort((a, b) => (a.control.order ?? 0) - (b.control.order ?? 0));
    return { exhibit: exhibit, actions };
}
function roundToStep(value, step, min) {
    const decimals = (String(step).split(".")[1] ?? "").length;
    return Number((min + Math.round((value - min) / step) * step).toFixed(decimals));
}
function formatValue(value, unit) {
    return unit ? `${String(value)} ${unit}` : String(value);
}
function buildControl(action, send) {
    const { control, param } = action;
    const root = el("div", `control-group remote-control remote-control--${control.type}`);
    root.dataset.action = action.name;
    const reason = el("span", "remote-reason");
    const sendValue = (value) => send(action, { [control.param]: value });
    if (control.type === "button") {
        const button = el("button", "remote-button", control.label);
        button.type = "button";
        button.addEventListener("click", () => send(action));
        root.append(button, reason);
        return { action, root, inputs: [button], reason, editing: () => false };
    }
    const label = el("label");
    const valueText = el("span", "remote-value");
    label.append(`${control.label}`);
    if (control.type === "slider")
        label.append(": ", valueText);
    const id = `remote-${action.name}-${Math.random().toString(36).slice(2, 8)}`;
    label.htmlFor = id;
    if (param?.description)
        root.title = param.description;
    root.append(label);
    if (control.type === "slider" || control.type === "number") {
        const min = param?.minimum ?? 0;
        const max = param?.maximum ?? 100;
        const step = control.step ?? (control.type === "slider" ? (max - min) / 100 : 1);
        const input = el("input");
        input.id = id;
        input.type = control.type === "slider" ? "range" : "number";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        let dragging = false;
        const show = () => {
            valueText.textContent = formatValue(roundToStep(Number(input.value), step, min), control.unit);
        };
        input.addEventListener("input", () => {
            dragging = true;
            show();
        });
        input.addEventListener("change", () => {
            dragging = false;
            const value = Math.min(max, Math.max(min, roundToStep(Number(input.value), step, min)));
            sendValue(value);
        });
        root.append(input, reason);
        return {
            action,
            root,
            inputs: [input],
            reason,
            editing: () => dragging,
            setValue: (v) => {
                if (typeof v === "number") {
                    input.value = String(v);
                    show();
                }
            },
        };
    }
    if (control.type === "select") {
        const select = el("select");
        select.id = id;
        for (const choice of param?.enum ?? []) {
            const option = el("option", undefined, formatValue(choice, control.unit));
            option.value = String(choice);
            select.append(option);
        }
        select.addEventListener("change", () => {
            const choice = (param?.enum ?? []).find((c) => String(c) === select.value);
            sendValue(choice ?? select.value);
        });
        root.append(select, reason);
        return {
            action,
            root,
            inputs: [select],
            reason,
            editing: () => document.activeElement === select,
            setValue: (v) => {
                if (v !== undefined)
                    select.value = String(v);
            },
        };
    }
    // text
    const field = control.multiline ? el("textarea") : el("input");
    field.id = id;
    const submit = el("button", "remote-button", "Send");
    submit.type = "button";
    submit.addEventListener("click", () => sendValue(field.value));
    root.append(field, submit, reason);
    return {
        action,
        root,
        inputs: [field, submit],
        reason,
        editing: () => document.activeElement === field,
        setValue: (v) => {
            if (typeof v === "string")
                field.value = v;
        },
    };
}
function buildView(spec, parent) {
    const section = el("div", `remote-view remote-view--${spec.type}`);
    section.dataset.view = spec.name;
    if (spec.label)
        section.append(el("div", "remote-view-label", spec.label));
    const body = el("div", "remote-view-body");
    section.append(body);
    parent.append(section);
    if (spec.type === "kv") {
        return {
            spec,
            update: (data) => {
                const items = data?.items;
                if (!Array.isArray(items))
                    return void body.replaceChildren(el("span", "remote-empty", "No data yet"));
                const grid = el("div", "remote-kv");
                for (const item of items) {
                    const row = el("div", "remote-kv-row");
                    row.append(el("span", "remote-kv-label", item.label), el("span", "remote-kv-value", formatValue(item.value, item.unit || undefined)));
                    grid.append(row);
                }
                body.replaceChildren(grid);
            },
        };
    }
    if (spec.type === "log") {
        return {
            spec,
            update: (data) => {
                const entries = data?.entries;
                if (!Array.isArray(entries) || entries.length === 0) {
                    return void body.replaceChildren(el("span", "remote-empty", "Nothing yet"));
                }
                const list = el("ul", "remote-log");
                for (const entry of entries.slice(-LOG_ROWS_SHOWN).reverse()) {
                    const row = el("li", `remote-log-row remote-log--${entry.level ?? "info"}`);
                    if (entry.time)
                        row.append(el("span", "remote-log-time", entry.time));
                    row.append(el("span", "remote-log-message", entry.message));
                    list.append(row);
                }
                body.replaceChildren(list);
            },
        };
    }
    // chart
    const height = 220;
    const margin = { top: 12, right: 16, bottom: 36, left: 44 };
    const width = Math.max(320, body.clientWidth || parent.clientWidth || 640);
    const svg = d3
        .select(body)
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("class", "remote-chart");
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const xAxis = plot.append("g").attr("transform", `translate(0,${innerH})`);
    const yAxis = plot.append("g");
    const lines = plot.append("g");
    const empty = plot
        .append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .attr("class", "remote-empty")
        .text("No data yet");
    if (spec.x_label) {
        plot.append("text").attr("class", "remote-axis-label").attr("x", innerW / 2).attr("y", innerH + 32).attr("text-anchor", "middle").text(spec.x_label);
    }
    if (spec.y_label) {
        plot.append("text")
            .attr("class", "remote-axis-label")
            .attr("transform", `translate(-34,${innerH / 2}) rotate(-90)`)
            .attr("text-anchor", "middle")
            .text(spec.y_label);
    }
    const palette = ["#1e88e5", "#e53935", "#43a047", "#fb8c00"];
    return {
        spec,
        update: (data) => {
            const series = (data?.series ?? []).filter((s) => Array.isArray(s.points));
            const points = series.flatMap((s) => s.points);
            empty.style("display", points.length ? "none" : null);
            const xs = points.map((p) => p[0]);
            const ys = points.map((p) => p[1]);
            const xMin = spec.x_min ?? (xs.length ? Math.min(...xs) : 0);
            const xMax = spec.x_max ?? (xs.length ? Math.max(...xs) : 1);
            const x = d3.scaleLinear().domain([xMin, xMax === xMin ? xMin + 1 : xMax]).range([0, innerW]);
            const y = d3.scaleLinear().domain([0, Math.max(5, ...ys) * 1.1]).nice().range([innerH, 0]);
            xAxis.call(d3.axisBottom(x).ticks(6));
            yAxis.call(d3.axisLeft(y).ticks(5));
            const line = d3
                .line()
                .x((p) => x(p[0]))
                .y((p) => y(p[1]));
            lines
                .selectAll("path")
                .data(series)
                .join("path")
                .attr("class", "remote-series")
                .attr("fill", "none")
                .attr("stroke-width", 2)
                .attr("stroke", (_s, i) => palette[i % palette.length])
                .attr("d", (s) => line(s.points));
        },
    };
}
// === A RUNNING EXHIBIT ===
class RunningExhibit {
    constructor(container, base, exhibitId, spec, actions, remount) {
        this.container = container;
        this.base = base;
        this.exhibitId = exhibitId;
        this.spec = spec;
        this.remount = remount;
        this.controls = [];
        this.views = [];
        this.failures = 0;
        this.stopped = false;
        this.onVisibility = () => this.visibilityChanged();
        const shell = el("div", "remote-exhibit-shell");
        const header = el("div", "remote-exhibit-header");
        header.append(el("div", "remote-exhibit-title", spec.title));
        if (spec.summary)
            header.append(el("p", "remote-exhibit-summary", spec.summary));
        shell.append(header);
        if (actions.length) {
            const panel = el("div", "control-panel remote-controls");
            for (const action of actions) {
                const bound = buildControl(action, (a, body) => void this.send(a, body));
                this.controls.push(bound);
                panel.append(bound.root);
            }
            shell.append(panel);
        }
        this.errorLine = el("div", "remote-error");
        this.errorLine.setAttribute("role", "alert");
        shell.append(this.errorLine);
        const viewArea = el("div", "remote-views");
        shell.append(viewArea);
        container.dataset.state = "ready";
        container.replaceChildren(shell);
        for (const view of spec.views)
            this.views.push(buildView(view, viewArea));
    }
    start() {
        document.addEventListener("visibilitychange", this.onVisibility);
        void this.poll();
    }
    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        document.removeEventListener("visibilitychange", this.onVisibility);
    }
    visibilityChanged() {
        clearTimeout(this.timer);
        if (!document.hidden && !this.stopped)
            void this.poll();
    }
    schedule() {
        clearTimeout(this.timer);
        if (!this.stopped && !document.hidden) {
            this.timer = window.setTimeout(() => void this.poll(), this.spec.poll_interval_ms ?? 1000);
        }
    }
    url(path) {
        return new URL(`exhibits/${this.exhibitId}/${path}`, this.base);
    }
    async poll() {
        try {
            const res = await fetchJson(this.url("state"));
            if (res.status !== 200)
                throw new ServiceError("unreachable", `state returned HTTP ${res.status}`);
            this.failures = 0;
            this.apply(res.body);
        }
        catch (err) {
            this.failures += 1;
            if (this.failures >= FAILURES_BEFORE_CLOSING) {
                this.stop();
                const detail = err instanceof Error ? err.message : String(err);
                showPlacard(this.container, "unreachable", detail, this.remount);
                return;
            }
        }
        this.schedule();
    }
    async send(action, body) {
        if (action.control.confirm && !window.confirm(action.control.confirm))
            return;
        const bound = this.controls.find((c) => c.action.name === action.name);
        bound?.inputs.forEach((i) => (i.disabled = true));
        try {
            const res = await fetchJson(this.url(`actions/${action.name}`), {
                method: "POST",
                headers: body ? { "Content-Type": "application/json" } : {},
                body: body ? JSON.stringify(body) : undefined,
            });
            if (res.status === 200) {
                this.showError("");
                this.apply(res.body);
            }
            else {
                this.showError(describeRefusal(res));
                void this.poll();
            }
        }
        catch {
            this.showError("The exhibit didn't answer. Try again in a moment.");
            void this.poll();
        }
    }
    showError(message) {
        this.errorLine.textContent = message;
    }
    apply(state) {
        if (!state || typeof state !== "object")
            return;
        for (const bound of this.controls) {
            const actionState = state.actions?.[bound.action.name];
            const enabled = actionState?.enabled === true;
            bound.inputs.forEach((i) => (i.disabled = !enabled));
            const reason = !enabled ? actionState?.reason ?? "" : "";
            bound.reason.textContent = reason;
            bound.root.title = reason || bound.action.param?.description || "";
            const param = bound.action.control.param;
            if (param && bound.setValue && !bound.editing()) {
                bound.setValue(state.values?.[bound.action.name]?.[param]);
            }
        }
        for (const view of this.views)
            view.update(state.views?.[view.spec.name]);
    }
}
function describeRefusal(res) {
    const detail = res.body?.detail;
    if (Array.isArray(detail)) {
        const messages = detail.map((d) => d.msg).filter(Boolean);
        if (messages.length)
            return `The exhibit refused that: ${messages.join("; ")}`;
    }
    if (typeof detail === "string")
        return `The exhibit refused that: ${detail}`;
    return `The exhibit refused that (HTTP ${res.status}).`;
}
// === MOUNTING ===
async function mount(container) {
    const remount = () => void mount(container);
    const serviceId = container.dataset.service ?? "";
    const exhibitId = container.dataset.exhibit ?? "";
    showPlacard(container, "loading");
    const service = (await loadConfig())[serviceId];
    if (!service)
        return showPlacard(container, "not_configured");
    try {
        const base = new URL(service.base_url, SITE_ROOT);
        if (service.worker) {
            await ensureWorker(new URL(service.worker, SITE_ROOT), new URL(service.scope ?? "./", SITE_ROOT));
        }
        const health = await fetchJson(new URL("healthz", base));
        if (health.status !== 200)
            throw new ServiceError("unreachable", `The health check returned HTTP ${health.status}.`);
        const report = health.body;
        if (report?.status !== "ok") {
            throw new ServiceError("unhealthy", report?.detail || `It reports its status as "${report?.status ?? "unknown"}".`);
        }
        const manifest = await fetchJson(new URL("openapi.json", base));
        if (manifest.status !== 200)
            throw new ServiceError("incompatible", `Its openapi.json returned HTTP ${manifest.status}.`);
        const { exhibit, actions } = readManifest(manifest.body, exhibitId);
        new RunningExhibit(container, base, exhibitId, exhibit, actions, remount).start();
    }
    catch (err) {
        if (err instanceof ServiceError)
            return showPlacard(container, err.kind, err.message, remount);
        showPlacard(container, "incompatible", err instanceof Error ? err.message : String(err), remount);
    }
}
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".remote-exhibit").forEach((container) => void mount(container));
});
//# sourceMappingURL=remote-exhibits.js.map