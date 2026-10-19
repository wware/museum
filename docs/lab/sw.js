"use strict";
// Service worker for the Lab wing: the museum's in-house exhibit service.
// It answers requests under <scope>service/ the way a FastAPI service implementing the
// remote-exhibit contract would, so the museum's client can't tell the difference.
// Every other request passes through to the network untouched. openapi.json is a real
// static file, so it passes through too.
//
// Browsers stop idle service workers after about 30 seconds, which resets the simulation.
// The museum polls about once a second while a lab page is visible, which keeps it alive.
const sw = self;
const SERVICE_NAME = "Queue toy service";
const EXHIBIT_ID = "queue";
const EXHIBIT_TITLE = "The checkout line";
// These limits must match the request schemas in docs/lab/service/openapi.json
const ARRIVAL_RATE = { min: 0, max: 10 };
const SERVICE_RATE = { min: 0.1, max: 5 };
const SERVER_CHOICES = [1, 2, 3];
const BURST_SIZE = 10;
const MAX_QUEUE = 999;
const MAX_CATCH_UP_SECONDS = 120;
const HISTORY_SECONDS = 60;
const MAX_LOG_ENTRIES = 40;
function wallSeconds() {
    return Date.now() / 1000;
}
function expSample(rate) {
    return rate > 0 ? -Math.log(1 - Math.random()) / rate : Infinity;
}
function clockTime() {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
}
function newSimulation() {
    const s = {
        arrivalRate: 0.8,
        serviceRate: 1.0,
        servers: [null],
        queue: [],
        simTime: 0,
        lastWall: wallSeconds(),
        paused: false,
        nextArrival: 0,
        nextSample: 0,
        history: [],
        served: 0,
        started: 0,
        totalWait: 0,
        overCapacity: false,
        lineFull: false,
        log: [],
    };
    s.nextArrival = expSample(s.arrivalRate);
    return s;
}
let sim = newSimulation();
function addLog(s, level, message) {
    s.log.push({ time: clockTime(), level, message });
    if (s.log.length > MAX_LOG_ENTRIES)
        s.log.shift();
}
// Logged when the worker starts, which includes a restart after the browser stopped it
addLog(sim, "info", "The exhibit opened");
function utilization(s) {
    return s.arrivalRate / (s.servers.length * s.serviceRate);
}
function checkCapacity(s) {
    const over = utilization(s) >= 1;
    if (over && !s.overCapacity) {
        addLog(s, "warn", "Arrivals now meet or exceed capacity: the line will keep growing");
    }
    else if (!over && s.overCapacity) {
        addLog(s, "info", "Capacity exceeds arrivals again: the line can shrink");
    }
    s.overCapacity = over;
}
function startService(s) {
    for (let i = 0; i < s.servers.length && s.queue.length > 0; i++) {
        if (s.servers[i] === null) {
            const arrived = s.queue.shift();
            s.totalWait += s.simTime - arrived;
            s.started += 1;
            s.servers[i] = s.simTime + expSample(s.serviceRate);
        }
    }
}
function enqueue(s, count) {
    for (let i = 0; i < count; i++) {
        if (s.queue.length >= MAX_QUEUE) {
            if (!s.lineFull)
                addLog(s, "warn", "The line is out the door: new arrivals are turned away");
            s.lineFull = true;
            return;
        }
        s.queue.push(s.simTime);
    }
    s.lineFull = false;
}
function advanceTo(s, target) {
    for (;;) {
        let nextFinish = Infinity;
        let finisher = -1;
        s.servers.forEach((t, i) => {
            if (t !== null && t < nextFinish) {
                nextFinish = t;
                finisher = i;
            }
        });
        const nextEvent = Math.min(s.nextArrival, nextFinish);
        while (s.nextSample <= Math.min(nextEvent, target)) {
            s.history.push([s.nextSample, s.queue.length]);
            s.nextSample += 1;
        }
        if (nextEvent > target)
            break;
        s.simTime = nextEvent;
        if (nextEvent === s.nextArrival) {
            enqueue(s, 1);
            s.nextArrival = s.simTime + expSample(s.arrivalRate);
        }
        else {
            s.servers[finisher] = null;
            s.served += 1;
        }
        startService(s);
    }
    s.simTime = target;
    while (s.history.length > HISTORY_SECONDS + 1)
        s.history.shift();
}
function catchUp(s) {
    const now = wallSeconds();
    if (!s.paused) {
        advanceTo(s, s.simTime + Math.min(now - s.lastWall, MAX_CATCH_UP_SECONDS));
    }
    s.lastWall = now;
}
// === CONTRACT RESPONSES ===
function stateResponse(s) {
    const busy = s.servers.filter((t) => t !== null).length;
    const disabled = (reason) => ({ enabled: false, reason });
    const util = utilization(s);
    return {
        views: {
            queue_length: {
                series: [
                    {
                        name: "waiting",
                        points: s.history.map(([t, n]) => [Math.round(t - s.simTime), n]),
                    },
                ],
            },
            stats: {
                items: [
                    { label: "People waiting", value: s.queue.length },
                    { label: "Being served", value: busy },
                    { label: "Served so far", value: s.served },
                    {
                        label: "Average wait",
                        value: s.started > 0 ? Math.round((s.totalWait / s.started) * 10) / 10 : "n/a",
                        unit: s.started > 0 ? "s" : "",
                    },
                    { label: "Utilization (arrivals / capacity)", value: `${Math.round(util * 100)}%` },
                    { label: "Simulation", value: s.paused ? "paused" : "running" },
                ],
            },
            events: { entries: s.log },
        },
        actions: {
            set_arrival_rate: { enabled: true },
            set_service_rate: { enabled: true },
            set_servers: { enabled: true },
            add_burst: { enabled: true },
            pause: s.paused ? disabled("The simulation is already paused") : { enabled: true },
            resume: s.paused ? { enabled: true } : disabled("The simulation is already running"),
            reset: { enabled: true },
        },
        values: {
            set_arrival_rate: { rate: s.arrivalRate },
            set_service_rate: { rate: s.serviceRate },
            set_servers: { servers: s.servers.length },
        },
    };
}
function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
// FastAPI-shaped validation error, so the museum handles both services the same way
function invalid(param, input, msg) {
    return json(422, { detail: [{ type: "value_error", loc: ["body", param], msg, input }] });
}
async function readBody(request) {
    try {
        const body = await request.json();
        if (body && typeof body === "object" && !Array.isArray(body))
            return body;
    }
    catch {
        // fall through
    }
    return json(422, { detail: [{ type: "json_invalid", loc: ["body"], msg: "JSON object expected" }] });
}
function rateFrom(body, limits) {
    const rate = body.rate;
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
        return invalid("rate", rate, "Input should be a valid number");
    }
    if (rate < limits.min)
        return invalid("rate", rate, `Input should be greater than or equal to ${limits.min}`);
    if (rate > limits.max)
        return invalid("rate", rate, `Input should be less than or equal to ${limits.max}`);
    return rate;
}
async function runAction(s, name, request) {
    switch (name) {
        case "set_arrival_rate": {
            const body = await readBody(request);
            if (body instanceof Response)
                return body;
            const rate = rateFrom(body, ARRIVAL_RATE);
            if (rate instanceof Response)
                return rate;
            s.arrivalRate = rate;
            // Exponential arrivals are memoryless, so redrawing the next arrival is exact
            s.nextArrival = s.simTime + expSample(rate);
            addLog(s, "info", `Arrival rate set to ${rate} per second`);
            break;
        }
        case "set_service_rate": {
            const body = await readBody(request);
            if (body instanceof Response)
                return body;
            const rate = rateFrom(body, SERVICE_RATE);
            if (rate instanceof Response)
                return rate;
            s.serviceRate = rate;
            s.servers = s.servers.map((t) => (t === null ? null : s.simTime + expSample(rate)));
            addLog(s, "info", `Service rate set to ${rate} per second per server`);
            break;
        }
        case "set_servers": {
            const body = await readBody(request);
            if (body instanceof Response)
                return body;
            const n = body.servers;
            if (typeof n !== "number" || !SERVER_CHOICES.includes(n)) {
                return invalid("servers", n, `Input should be ${SERVER_CHOICES.join(", ")}`);
            }
            while (s.servers.length < n)
                s.servers.push(null);
            while (s.servers.length > n) {
                // A removed server's customer goes back to the front of the line
                if (s.servers.pop() != null)
                    s.queue.unshift(s.simTime);
            }
            startService(s);
            addLog(s, "info", `${n} server${n === 1 ? "" : "s"} now working`);
            break;
        }
        case "add_burst":
            enqueue(s, BURST_SIZE);
            startService(s);
            addLog(s, "info", `Rush hour: ${BURST_SIZE} customers arrived`);
            break;
        case "pause":
            if (!s.paused) {
                s.paused = true;
                addLog(s, "info", "Simulation paused");
            }
            break;
        case "resume":
            if (s.paused) {
                s.paused = false;
                s.lastWall = wallSeconds();
                addLog(s, "info", "Simulation resumed");
            }
            break;
        case "reset":
            sim = newSimulation();
            addLog(sim, "info", "Reset: the line and all statistics were cleared");
            return json(200, stateResponse(sim));
        default:
            return json(404, { detail: "Not Found" });
    }
    checkCapacity(s);
    return json(200, stateResponse(s));
}
async function handle(route, request) {
    const method = request.method;
    const exhibitPrefix = `exhibits/${EXHIBIT_ID}/`;
    if (route === "healthz") {
        return method === "GET" ? json(200, { status: "ok", service: SERVICE_NAME }) : json(405, { detail: "Method Not Allowed" });
    }
    if (route === "exhibits") {
        return method === "GET" ? json(200, [{ id: EXHIBIT_ID, title: EXHIBIT_TITLE }]) : json(405, { detail: "Method Not Allowed" });
    }
    if (route === `${exhibitPrefix}state`) {
        if (method !== "GET")
            return json(405, { detail: "Method Not Allowed" });
        catchUp(sim);
        return json(200, stateResponse(sim));
    }
    if (route.startsWith(`${exhibitPrefix}actions/`)) {
        if (method !== "POST")
            return json(405, { detail: "Method Not Allowed" });
        catchUp(sim);
        return runAction(sim, route.slice(`${exhibitPrefix}actions/`.length), request);
    }
    return json(404, { detail: "Not Found" });
}
// === SERVICE WORKER LIFECYCLE ===
sw.addEventListener("install", () => {
    void sw.skipWaiting();
});
sw.addEventListener("activate", (event) => {
    event.waitUntil(sw.clients.claim());
});
// A page loaded without a controller (first visit, or a hard reload) asks to be claimed
sw.addEventListener("message", (event) => {
    if (event.data === "claim")
        event.waitUntil(sw.clients.claim());
});
sw.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const base = new URL("service/", sw.registration.scope);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        return;
    const route = url.pathname.slice(base.pathname.length);
    if (route === "openapi.json")
        return; // a real static file
    event.respondWith(handle(route, event.request));
});
//# sourceMappingURL=sw.js.map