// Mass-Spring-Damper Simulation

// === TYPE DEFINITIONS ===
interface SimulationState {
    position: number;  // Displacement from equilibrium point
    velocity: number;  // Velocity (dx/dt)
    mass: number;      // Mass
    stiffness: number; // Spring stiffness constant
    damping: number;   // Friction/Damping factor
}

type Point = [number, number];

// Only initialize if the simulation container is present on this page
document.addEventListener("DOMContentLoaded", () => {
    console.log("[MASS-SPRING] DOMContentLoaded fired");
    const container = document.getElementById("simulation-space");
    console.log("[MASS-SPRING] Container:", container);
    if (!container) {
        console.error("[MASS-SPRING] simulation-space not found!");
        return; // Exit if not on the simulation page
    }
    console.log("[MASS-SPRING] Starting initialization...");
    console.log("[MASS-SPRING] d3 available:", typeof d3);

    // 1. Setup Environment Space Configuration
    const width = container.clientWidth || 700;
    const height = 220;
    const wallX = 60;          // X position of the fixed left wall
    const equilibriumX = 350;  // Center point where spring forces are 0
    const massWidth = 70;
    const massHeight = 50;
    const floorY = 160;

    // 2. Instantiate State Constants
    const state: SimulationState = {
        position: 120,  // Displacement from equilibrium point
        velocity: 0,    // Velocity (dx/dt)
        mass: 2.0,      // Mass
        stiffness: 15.0,// Spring stiffness constant
        damping: 0.4    // Friction/Damping factor
    };

    // 3. Mount SVG Viewport Context
    console.log("[MASS-SPRING] Creating SVG with width:", width, "height:", height);
    try {
        const svg = d3.select(container)
            .append("svg")
            .attr("width", "100%")
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`);
        console.log("[MASS-SPRING] SVG created successfully");

    // Draw Floor Line
    svg.append("line")
        .attr("x1", 0)
        .attr("y1", floorY)
        .attr("x2", width)
        .attr("y2", floorY)
        .attr("stroke", "#555")
        .attr("stroke-width", 2);

    // Draw Stable Anchor (The Wall)
    svg.append("rect")
        .attr("x", wallX - 20)
        .attr("y", floorY - 110)
        .attr("width", 20)
        .attr("height", 110)
        .attr("fill", "#999")
        .attr("stroke", "#333");

    // Draw Wall Cross-hatch Details
    for (let y = floorY - 105; y < floorY; y += 15) {
        svg.append("line")
            .attr("x1", wallX - 20)
            .attr("y1", y)
            .attr("x2", wallX)
            .attr("y2", y - 10)
            .attr("stroke", "#666")
            .attr("stroke-width", 1.5);
    }

    // Generate Structural Elements for Dynamic Components
    const springPath = svg.append("path")
        .attr("fill", "none")
        .attr("stroke", "#444")
        .attr("stroke-width", 2.5);

    const block = svg.append("rect")
        .attr("width", massWidth)
        .attr("height", massHeight)
        .attr("fill", "#0288d1")
        .attr("stroke", "#01579b")
        .attr("stroke-width", 2)
        .attr("rx", 4);

    // 4. Spring Geometry Generator (Coils Engine)
    function updateSpringGeometry(startX: number, endX: number): string | null {
        const coils = 12;
        const yCenter = floorY - (massHeight / 2);
        const amplitude = 15;
        const points: Point[] = [];

        points.push([startX, yCenter]);
        const leadIn = 15;
        points.push([startX + leadIn, yCenter]);

        const dynamicWidth = (endX - startX) - (leadIn * 2);
        for (let i = 0; i <= coils; i++) {
            const fraction = i / coils;
            const ptX = startX + leadIn + fraction * dynamicWidth;
            let ptY = yCenter;
            if (i > 0 && i < coils) {
                ptY += (i % 2 === 0) ? -amplitude : amplitude;
            }
            points.push([ptX, ptY]);
        }

        points.push([endX, yCenter]);
        return d3.line()(points);
    }

    // 5. Velocity Verlet Physics Loop Engine
    let isDragging = false;
    const timeStep = 0.016; // Fixed timestep representing ~60fps frame interval

    const physicsTimer = d3.timer(() => {
        if (!isDragging) {
            // Step 1: Calculate current acceleration
            const currentAcceleration = (-state.stiffness * state.position - state.damping * state.velocity) / state.mass;

            // Step 2: Advance position a full step using half-step acceleration components
            state.position += state.velocity * timeStep + 0.5 * currentAcceleration * timeStep * timeStep;

            // Step 3: Calculate next acceleration at the new position (using a predicted half-step velocity for friction)
            const predictedVelocity = state.velocity + 0.5 * currentAcceleration * timeStep;
            const nextAcceleration = (-state.stiffness * state.position - state.damping * predictedVelocity) / state.mass;

            // Step 4: Advance velocity a full step using the average of current and next acceleration
            state.velocity += 0.5 * (currentAcceleration + nextAcceleration) * timeStep;
        }

        // Resolve Absolute Coordinates
        const massLeftX = equilibriumX + state.position - (massWidth / 2);

        // Update D3 Graphic Transforms
        block.attr("x", massLeftX)
            .attr("y", floorY - massHeight);

        springPath.attr("d", updateSpringGeometry(wallX, massLeftX));
    });

    // Stop timer when page becomes hidden to prevent memory leaks
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && physicsTimer) {
            physicsTimer.stop();
        }
    });

    // 6. Hook Interactive Drag and Drop Handlers
    const dragHandler = d3.drag()
        .on("start", () => {
            isDragging = true;
            state.velocity = 0; // Clear residual velocities on grab
        })
        .on("drag", (event: any) => {
            const pointerX = event.x;
            const targetX = Math.max(wallX + 30, Math.min(width - massWidth, pointerX));
            state.position = targetX - equilibriumX + (massWidth / 2);
        })
        .on("end", () => {
            isDragging = false;
        });

    block.call(dragHandler);

    console.log("[MASS-SPRING] Simulation fully initialized!");

    // 7. Dynamic Knob Event Routing Controls
    d3.select("#massSlider").on("input", function (this: HTMLInputElement) {
        state.mass = +this.value;
        d3.select("#massVal").text(state.mass.toFixed(1));
    });

    d3.select("#stiffSlider").on("input", function (this: HTMLInputElement) {
        state.stiffness = +this.value;
        d3.select("#stiffVal").text(state.stiffness.toFixed(1));
    });

    d3.select("#frictionSlider").on("input", function (this: HTMLInputElement) {
        state.damping = +this.value;
        d3.select("#frictionVal").text(state.damping.toFixed(2));
    });

    d3.select("#resetBtn").on("click", () => {
        state.position = 150; // Give the block a distinct right displacement nudge
        state.velocity = 0;   // Force stop residual kinetics
    });

    } catch (error) {
        console.error("[MASS-SPRING] Error during initialization:", error);
    }
}); // End of DOMContentLoaded
