"use strict";
// Orbital mechanics exhibits: a 2D orbit sandbox and a space elevator.
// Everything lives inside one DOMContentLoaded callback so no names leak into
// the global scope shared with the other exhibit scripts.
document.addEventListener("DOMContentLoaded", () => {
    const sandboxEl = document.getElementById("orbit-sim");
    const elevatorEl = document.getElementById("elevator-sim");
    if (!sandboxEl && !elevatorEl)
        return;
    // === UNITS ===
    // Lengths are in planet radii (R = 1) and gravity is MU = 1, so a circular
    // orbit at the surface has speed 1 and period 2*pi. The constants below scale
    // those numbers to Earth for the readouts.
    const MU = 1;
    const R_PLANET = 1;
    const R_GEO = 6.62; // geostationary radius, in planet radii
    const OMEGA = Math.sqrt(MU / R_GEO ** 3); // rotation rate that makes GEO synchronous
    const R_ESCAPE_RELEASE = Math.cbrt(2) * R_GEO; // release above this radius escapes
    const R_TETHER_TOP = 10;
    const R_FAR_AWAY = 60; // stop simulating beyond this
    const KM_PER_R = 6371;
    const KMS_PER_V = 7.905;
    const SECONDS_PER_T = 805.5;
    const KIND_LABEL = {
        impact: "Falls back (hits the planet)",
        circular: "Circular orbit",
        elliptical: "Elliptical orbit",
        escape: "Escapes (hyperbolic)",
    };
    const KIND_COLOR = {
        impact: "#ef5350",
        circular: "#4fc3f7",
        elliptical: "#ffd54f",
        escape: "#66bb6a",
    };
    // === ORBIT MATH ===
    function analyze(pos, vel) {
        const r = Math.hypot(pos.x, pos.y);
        const v2 = vel.x * vel.x + vel.y * vel.y;
        const rv = pos.x * vel.x + pos.y * vel.y;
        const energy = v2 / 2 - MU / r;
        const h = pos.x * vel.y - pos.y * vel.x;
        const k = (v2 - MU / r) / MU;
        const ex = k * pos.x - (rv * vel.x) / MU;
        const ey = k * pos.y - (rv * vel.y) / MU;
        const e = Math.hypot(ex, ey);
        const p = (h * h) / MU;
        const periapsis = p / (1 + e);
        const apoapsis = e < 1 ? p / (1 - e) : Infinity;
        const argPeri = e > 1e-9 ? Math.atan2(ey, ex) : Math.atan2(pos.y, pos.x);
        const bound = energy < 0;
        let kind;
        if (periapsis < R_PLANET && (bound || rv < 0)) {
            kind = "impact";
        }
        else if (!bound) {
            kind = "escape";
        }
        else if (e < 0.02) {
            kind = "circular";
        }
        else {
            kind = "elliptical";
        }
        return { kind, energy, e, p, periapsis, apoapsis, argPeri, direction: h >= 0 ? 1 : -1 };
    }
    // Points along the conic r = p / (1 + e cos(nu)), clipped at rMax for open orbits
    function conicPoints(orbit, rMax) {
        if (orbit.p <= 1e-9)
            return [];
        let nuMax = Math.PI;
        if (orbit.e >= 1) {
            const c = Math.max(-1, Math.min(1, (orbit.p / rMax - 1) / orbit.e));
            nuMax = Math.acos(c);
        }
        const points = [];
        const n = 240;
        for (let i = 0; i <= n; i++) {
            const nu = -nuMax + (2 * nuMax * i) / n;
            const r = orbit.p / (1 + orbit.e * Math.cos(nu));
            if (!(r > 0) || !Number.isFinite(r))
                continue;
            const angle = orbit.argPeri + orbit.direction * nu;
            points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
        }
        return points;
    }
    function gravity(pos) {
        const r = Math.hypot(pos.x, pos.y);
        const k = -MU / (r * r * r);
        return { x: k * pos.x, y: k * pos.y };
    }
    // Velocity Verlet, which suits conservative gravity. Returns false on impact.
    function advanceBody(b, simTime) {
        let remaining = simTime;
        while (remaining > 1e-9) {
            const r = Math.hypot(b.pos.x, b.pos.y);
            const h = Math.min(remaining, 0.02, 0.01 * r ** 1.5);
            const a0 = gravity(b.pos);
            b.pos = {
                x: b.pos.x + b.vel.x * h + 0.5 * a0.x * h * h,
                y: b.pos.y + b.vel.y * h + 0.5 * a0.y * h * h,
            };
            const a1 = gravity(b.pos);
            b.vel = {
                x: b.vel.x + 0.5 * (a0.x + a1.x) * h,
                y: b.vel.y + 0.5 * (a0.y + a1.y) * h,
            };
            remaining -= h;
            const rNew = Math.hypot(b.pos.x, b.pos.y);
            if (rNew <= R_PLANET) {
                b.pos = { x: (b.pos.x / rNew) * R_PLANET, y: (b.pos.y / rNew) * R_PLANET };
                b.vel = { x: 0, y: 0 };
                return false;
            }
        }
        return true;
    }
    // === FORMATTING ===
    const fmtAltitude = (r) => Number.isFinite(r) ? `${Math.round((r - R_PLANET) * KM_PER_R).toLocaleString("en-US")} km` : "unbounded";
    const fmtSpeed = (v) => `${(v * KMS_PER_V).toFixed(2)} km/s`;
    const fmtHours = (t) => `${((t * SECONDS_PER_T) / 3600).toFixed(1)} h`;
    // === DOM HELPERS ===
    let idCounter = 0;
    function makeEl(tag, className, text) {
        const node = document.createElement(tag);
        if (className)
            node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node;
    }
    function addSlider(parent, label, min, max, step, value, format, onInput) {
        const group = makeEl("div", "control-group");
        const lab = makeEl("label");
        const valueSpan = makeEl("span");
        const input = makeEl("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.id = `orbit-slider-${idCounter++}`;
        lab.htmlFor = input.id;
        lab.append(`${label}: `, valueSpan);
        const show = () => {
            valueSpan.textContent = format(Number(input.value));
        };
        input.addEventListener("input", () => {
            show();
            onInput(Number(input.value));
        });
        show();
        group.append(lab, input);
        parent.appendChild(group);
        return {
            input,
            set(v) {
                input.value = String(v);
                show();
            },
        };
    }
    function addButton(parent, text, onClick) {
        const button = makeEl("button", undefined, text);
        button.type = "button";
        button.addEventListener("click", onClick);
        parent.appendChild(button);
        return button;
    }
    function addReadout(parent, label) {
        const row = makeEl("div");
        const value = makeEl("span", "value");
        row.append(makeEl("span", "label", `${label}: `), value);
        parent.appendChild(row);
        return value;
    }
    function createReadouts(parent, kindLabel) {
        const grid = makeEl("div", "orbit-readout");
        parent.appendChild(grid);
        const kindRow = addReadout(grid, kindLabel);
        const kindSwatch = makeEl("span", undefined, "● ");
        const kindText = makeEl("span");
        kindRow.append(kindSwatch, kindText);
        return {
            kindSwatch,
            kindText,
            altitude: addReadout(grid, "Altitude"),
            speed: addReadout(grid, "Speed"),
            escapeSpeed: addReadout(grid, "Escape speed here"),
            periapsis: addReadout(grid, "Lowest point"),
            apoapsis: addReadout(grid, "Highest point"),
            eccentricity: addReadout(grid, "Eccentricity"),
            time: addReadout(grid, "Elapsed"),
        };
    }
    function updateReadouts(rd, orbit, state, t, kindText) {
        const r = Math.hypot(state.pos.x, state.pos.y);
        const v = Math.hypot(state.vel.x, state.vel.y);
        rd.kindSwatch.style.color = KIND_COLOR[orbit.kind];
        rd.kindText.textContent = kindText;
        rd.altitude.textContent = fmtAltitude(r);
        rd.speed.textContent = fmtSpeed(v);
        rd.escapeSpeed.textContent = fmtSpeed(Math.sqrt((2 * MU) / r));
        rd.periapsis.textContent = fmtAltitude(orbit.periapsis);
        rd.apoapsis.textContent = Number.isFinite(orbit.apoapsis) ? fmtAltitude(orbit.apoapsis) : "none (escapes)";
        rd.eccentricity.textContent = orbit.e.toFixed(3);
        rd.time.textContent = fmtHours(t);
    }
    function createScene(container, halfExtent, height) {
        const width = container.clientWidth || 700;
        const svg = d3
            .select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("background", "#0b1020")
            .style("border-radius", "8px")
            .style("display", "block");
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };
        for (let i = 0; i < 70; i++) {
            svg.append("circle")
                .attr("cx", rand() * width)
                .attr("cy", rand() * height)
                .attr("r", 0.4 + rand() * 1.1)
                .attr("fill", "#ffffff")
                .attr("opacity", 0.25 + rand() * 0.5);
        }
        return { svg, width, height, cx: width / 2, cy: height / 2, scale: Math.min(width, height) / 2 / halfExtent };
    }
    function toPath(points, scene) {
        return points
            .map((q, i) => `${i ? "L" : "M"}${(scene.cx + q.x * scene.scale).toFixed(1)},${(scene.cy - q.y * scene.scale).toFixed(1)}`)
            .join("");
    }
    function createOrbitPaths(scene) {
        const conic = scene.svg
            .append("path")
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "6,4");
        const trailPath = scene.svg
            .append("path")
            .attr("fill", "none")
            .attr("stroke", "#cfd8dc")
            .attr("stroke-width", 1.5)
            .attr("opacity", 0.75);
        return {
            update(orbit, trail) {
                if (orbit) {
                    const rMax = Math.max(scene.width, scene.height) / scene.scale;
                    conic
                        .attr("d", toPath(conicPoints(orbit, rMax), scene))
                        .attr("stroke", KIND_COLOR[orbit.kind])
                        .style("display", null);
                }
                else {
                    conic.style("display", "none");
                }
                trailPath.attr("d", toPath(trail, scene));
            },
        };
    }
    function createPlanet(scene, withMarks) {
        const body = scene.svg
            .append("circle")
            .attr("cx", scene.cx)
            .attr("cy", scene.cy)
            .attr("fill", "#2f6fb5")
            .attr("stroke", "#9fd0ff")
            .attr("stroke-width", 1.5);
        // Surface marks live in unit-circle coordinates so they scale with the planet
        const marks = scene.svg.append("g");
        if (withMarks) {
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3 + 0.5;
                marks
                    .append("line")
                    .attr("x1", 0.55 * Math.cos(a))
                    .attr("y1", 0.55 * Math.sin(a))
                    .attr("x2", Math.cos(a))
                    .attr("y2", Math.sin(a))
                    .attr("stroke", "#9fd0ff")
                    .attr("stroke-opacity", 0.45)
                    .attr("stroke-width", 1)
                    .style("vector-effect", "non-scaling-stroke");
            }
            marks.append("circle").attr("cx", 1).attr("cy", 0).attr("r", 0.12).attr("fill", "#ff9800");
        }
        return {
            update(angle) {
                const rPx = R_PLANET * scene.scale;
                body.attr("r", rPx);
                marks.attr("transform", `translate(${scene.cx},${scene.cy}) rotate(${(-angle * 180) / Math.PI}) scale(${rPx})`);
            },
        };
    }
    function createShipMarker(scene) {
        const arrow = scene.svg
            .append("line")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2)
            .attr("stroke-linecap", "round");
        const dot = scene.svg
            .append("circle")
            .attr("r", 5)
            .attr("fill", "#ffeb3b")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1);
        return {
            update(state) {
                if (!state) {
                    dot.style("display", "none");
                    arrow.style("display", "none");
                    return;
                }
                const sx = scene.cx + state.pos.x * scene.scale;
                const sy = scene.cy - state.pos.y * scene.scale;
                const r = Math.hypot(state.pos.x, state.pos.y);
                const v = Math.hypot(state.vel.x, state.vel.y);
                const len = v > 1e-6 ? 26 * Math.min(2, v / Math.sqrt(MU / r)) : 0;
                dot.attr("cx", sx).attr("cy", sy).style("display", null);
                if (len > 0) {
                    arrow
                        .attr("x1", sx)
                        .attr("y1", sy)
                        .attr("x2", sx + (state.vel.x / v) * len)
                        .attr("y2", sy - (state.vel.y / v) * len)
                        .style("display", null);
                }
                else {
                    arrow.style("display", "none");
                }
            },
        };
    }
    function startLoop(onFrame) {
        let last = null;
        const tick = (ms) => {
            const dt = last === null || ms < last ? 0 : Math.min((ms - last) / 1000, 0.05);
            last = ms;
            onFrame(dt);
        };
        const timer = d3.timer(tick);
        // Pause while the tab is hidden and resume (without a time jump) when visible
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                timer.stop();
            }
            else {
                last = null;
                timer.restart(tick);
            }
        });
    }
    const pushTrail = (trail, pos) => {
        trail.push({ x: pos.x, y: pos.y });
        if (trail.length > 1500)
            trail.shift();
    };
    // === EXHIBIT 1: ORBIT SANDBOX ===
    function initSandbox(container) {
        const controls = makeEl("div", "control-panel");
        container.appendChild(controls);
        const presets = makeEl("div", "orbit-buttons");
        container.appendChild(presets);
        const scene = createScene(container, 8, 440);
        const params = { r0: 2, ratio: 1, gamma: 0, warp: 1 };
        let body = { pos: { x: 0, y: params.r0 }, vel: { x: -1, y: 0 } };
        let trail = [];
        let status = "flying";
        let elapsed = 0;
        const launch = () => {
            const vCirc = Math.sqrt(MU / params.r0);
            const speed = params.ratio * vCirc;
            const gamma = (params.gamma * Math.PI) / 180;
            // Start above the planet; prograde is counter-clockwise, so "forward" is -x
            body = {
                pos: { x: 0, y: params.r0 },
                vel: { x: -speed * Math.cos(gamma), y: speed * Math.sin(gamma) },
            };
            trail = [{ x: body.pos.x, y: body.pos.y }];
            status = "flying";
            elapsed = 0;
        };
        let ratioSlider;
        addSlider(controls, "Launch altitude", 1.05, 8, 0.05, params.r0, (v) => fmtAltitude(v), (v) => {
            params.r0 = v;
            ratioSlider.set(params.ratio);
            launch();
        });
        ratioSlider = addSlider(controls, "Launch speed", 0, 1.8, 0.01, params.ratio, (v) => `${v.toFixed(2)}x circular (${fmtSpeed(v * Math.sqrt(MU / params.r0))})`, (v) => {
            params.ratio = v;
            launch();
        });
        addSlider(controls, "Launch angle", -90, 90, 1, params.gamma, (v) => `${v}° from horizontal`, (v) => {
            params.gamma = v;
            launch();
        });
        addSlider(controls, "View size", 4, 20, 1, 8, (v) => `${v} planet radii`, (v) => {
            scene.scale = Math.min(scene.width, scene.height) / 2 / v;
        });
        addSlider(controls, "Time warp", 0.25, 8, 0.25, params.warp, (v) => `${v.toFixed(2)}x`, (v) => {
            params.warp = v;
        });
        const setRatio = (ratio) => {
            params.ratio = ratio;
            ratioSlider.set(ratio);
            launch();
        };
        addButton(presets, "Circular", () => setRatio(1));
        addButton(presets, "Elliptical", () => setRatio(1.2));
        addButton(presets, "Escape", () => setRatio(1.5));
        addButton(presets, "Falls back", () => setRatio(0.6));
        addButton(presets, "Relaunch", launch);
        const orbitPaths = createOrbitPaths(scene);
        const planet = createPlanet(scene, false);
        const ship = createShipMarker(scene);
        const readouts = createReadouts(container, "Trajectory");
        launch();
        startLoop((dt) => {
            if (status === "flying") {
                const dtSim = dt * params.warp;
                elapsed += dtSim;
                if (!advanceBody(body, dtSim)) {
                    status = "crashed";
                }
                else if (Math.hypot(body.pos.x, body.pos.y) > R_FAR_AWAY) {
                    status = "gone";
                }
                pushTrail(trail, body.pos);
            }
            const orbit = analyze(body.pos, body.vel);
            const showConic = status === "flying";
            planet.update(0);
            orbitPaths.update(showConic ? orbit : null, trail);
            ship.update(body);
            let text = KIND_LABEL[orbit.kind];
            if (status === "crashed")
                text = "Crashed into the planet";
            if (status === "gone")
                text = "Escaped (out of view)";
            updateReadouts(readouts, orbit, body, elapsed, text);
        });
    }
    // === EXHIBIT 2: SPACE ELEVATOR ===
    function initElevator(container) {
        const CLIMB_RATE = 0.35; // planet radii per time unit
        const controls = makeEl("div", "control-panel");
        container.appendChild(controls);
        const buttons = makeEl("div", "orbit-buttons");
        container.appendChild(buttons);
        const scene = createScene(container, 11.5, 480);
        const params = { warp: 3 };
        const anchorAngle0 = Math.PI / 2;
        let t = 0;
        let climberR = R_PLANET;
        let climbing = false;
        let released = false;
        let body = { pos: { x: 0, y: R_PLANET }, vel: { x: 0, y: 0 } };
        let trail = [];
        let status = "flying";
        const anchorAngle = () => anchorAngle0 + OMEGA * t;
        // Inertial-frame state of the climber: it moves with the tether at speed OMEGA * r
        const climberState = () => {
            const a = anchorAngle();
            return {
                pos: { x: climberR * Math.cos(a), y: climberR * Math.sin(a) },
                vel: { x: -OMEGA * climberR * Math.sin(a), y: OMEGA * climberR * Math.cos(a) },
            };
        };
        const climbSlider = addSlider(controls, "Climber height", R_PLANET, R_TETHER_TOP, 0.01, climberR, (v) => `${fmtAltitude(v)} (${v.toFixed(2)} R)`, (v) => {
            climberR = v;
        });
        addSlider(controls, "Time warp", 0.5, 10, 0.5, params.warp, (v) => `${v.toFixed(1)}x`, (v) => {
            params.warp = v;
        });
        const climbButton = addButton(buttons, "Auto-climb", () => {
            if (released)
                return;
            climbing = !climbing;
            climbButton.textContent = climbing ? "Pause climb" : "Auto-climb";
        });
        const releaseButton = addButton(buttons, "Release climber", () => {
            if (released)
                return;
            body = climberState();
            trail = [{ x: body.pos.x, y: body.pos.y }];
            status = "flying";
            released = true;
            climbing = false;
            climbButton.textContent = "Auto-climb";
            climbSlider.input.disabled = true;
            releaseButton.disabled = true;
        });
        addButton(buttons, "Reset", () => {
            t = 0;
            climberR = R_PLANET;
            climbing = false;
            released = false;
            status = "flying";
            trail = [];
            climbButton.textContent = "Auto-climb";
            climbSlider.set(climberR);
            climbSlider.input.disabled = false;
            releaseButton.disabled = false;
        });
        // Layers, back to front: orbit paths, reference rings, planet, tether, ship
        const orbitPaths = createOrbitPaths(scene);
        const ring = (r, color, label, labelAngle) => {
            scene.svg
                .append("circle")
                .attr("cx", scene.cx)
                .attr("cy", scene.cy)
                .attr("r", r * scene.scale)
                .attr("fill", "none")
                .attr("stroke", color)
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "2,5")
                .attr("opacity", 0.8);
            scene.svg
                .append("text")
                .attr("x", scene.cx - r * scene.scale * Math.cos(labelAngle))
                .attr("y", scene.cy + r * scene.scale * Math.sin(labelAngle) - 4)
                .attr("text-anchor", "end")
                .attr("font-size", 11)
                .attr("fill", color)
                .text(label);
        };
        ring(R_GEO, KIND_COLOR.circular, `Geostationary orbit (${R_GEO} R)`, 0.75);
        ring(R_ESCAPE_RELEASE, KIND_COLOR.escape, `Escape-by-release radius (${R_ESCAPE_RELEASE.toFixed(2)} R)`, 0.15);
        const planet = createPlanet(scene, true);
        // The tether is drawn pointing along +x and rotated as one group
        const tetherGroup = scene.svg.append("g");
        const segments = 90;
        for (let i = 0; i < segments; i++) {
            const rA = R_PLANET + ((R_TETHER_TOP - R_PLANET) * i) / segments;
            const rB = R_PLANET + ((R_TETHER_TOP - R_PLANET) * (i + 1)) / segments;
            const rMid = (rA + rB) / 2;
            const kind = analyze({ x: rMid, y: 0 }, { x: 0, y: OMEGA * rMid }).kind;
            tetherGroup
                .append("line")
                .attr("x1", rA * scene.scale)
                .attr("x2", rB * scene.scale + 0.5)
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", KIND_COLOR[kind])
                .attr("stroke-width", 4);
        }
        // The circular-orbit band is only ~0.05 R wide, so mark it with a tick
        tetherGroup
            .append("line")
            .attr("x1", R_GEO * scene.scale)
            .attr("x2", R_GEO * scene.scale)
            .attr("y1", -8)
            .attr("y2", 8)
            .attr("stroke", KIND_COLOR.circular)
            .attr("stroke-width", 3);
        tetherGroup
            .append("rect")
            .attr("x", R_TETHER_TOP * scene.scale - 4)
            .attr("y", -6)
            .attr("width", 10)
            .attr("height", 12)
            .attr("fill", "#b0bec5");
        const climberDot = tetherGroup
            .append("circle")
            .attr("cy", 0)
            .attr("r", 6)
            .attr("fill", "#ffeb3b")
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5);
        const ship = createShipMarker(scene);
        const legend = makeEl("div", "orbit-legend");
        for (const kind of ["impact", "elliptical", "circular", "escape"]) {
            const item = makeEl("span");
            const swatch = makeEl("span", undefined, "■ ");
            swatch.style.color = KIND_COLOR[kind];
            item.append(swatch, `Release here: ${KIND_LABEL[kind].toLowerCase()}`);
            legend.appendChild(item);
        }
        container.appendChild(legend);
        const readouts = createReadouts(container, "Outcome");
        startLoop((dt) => {
            const dtSim = dt * params.warp;
            t += dtSim;
            if (climbing && !released) {
                climberR = Math.min(R_TETHER_TOP, climberR + CLIMB_RATE * dtSim);
                climbSlider.set(climberR);
                if (climberR >= R_TETHER_TOP) {
                    climbing = false;
                    climbButton.textContent = "Auto-climb";
                }
            }
            if (released && status === "flying") {
                if (!advanceBody(body, dtSim)) {
                    status = "crashed";
                }
                else if (Math.hypot(body.pos.x, body.pos.y) > R_FAR_AWAY) {
                    status = "gone";
                }
                pushTrail(trail, body.pos);
            }
            const angle = anchorAngle();
            planet.update(angle);
            tetherGroup.attr("transform", `translate(${scene.cx},${scene.cy}) rotate(${(-angle * 180) / Math.PI})`);
            climberDot.attr("cx", climberR * scene.scale).style("display", released ? "none" : null);
            const state = released ? body : climberState();
            const orbit = analyze(state.pos, state.vel);
            orbitPaths.update(status === "flying" ? orbit : null, trail);
            ship.update(released ? body : null);
            const outcome = KIND_LABEL[orbit.kind].toLowerCase();
            let text = released ? `Released: ${outcome}` : `If released now: ${outcome}`;
            if (status === "crashed")
                text = "Crashed into the planet";
            if (status === "gone")
                text = "Escaped (out of view)";
            updateReadouts(readouts, orbit, state, t, text);
        });
    }
    if (sandboxEl)
        initSandbox(sandboxEl);
    if (elevatorEl)
        initElevator(elevatorEl);
}); // End of DOMContentLoaded
//# sourceMappingURL=orbital-mechanics.js.map