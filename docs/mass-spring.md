# Interactive Mass-Spring-Damper System

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
<strong>🎯 Demonstration Goal:</strong> Explore the behavior of a damped harmonic oscillator using symplectic Velocity Verlet integration.
</div>

## The Physics

A mass-spring-damper system follows the differential equation:

$$
m\frac{d^2x}{dt^2} = -kx - f\frac{dx}{dt}
$$

**Where:**

- $m$ = mass
- $k$ = spring stiffness constant
- $f$ = friction/damping coefficient
- $x$ = displacement from equilibrium
- $\frac{dx}{dt}$ = velocity (first derivative)
- $\frac{d^2x}{dt^2}$ = acceleration (second derivative)

## Why Velocity Verlet?

The **Velocity Verlet** integration method is **symplectic**, meaning it conserves energy over long time periods. Unlike simple Euler integration, which accumulates error and causes the system to gain or lose energy over time, Velocity Verlet maintains the Hamiltonian structure of the system.

**Try this**: Set the friction coefficient to `0.00` and watch the system oscillate indefinitely without losing amplitude — perfect energy conservation!

## Interactive Simulation

<div id="mass-spring-exhibit" style="width: 100%; margin: 20px 0;">
    <div class="control-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; padding: 15px; background: rgba(0, 0, 0, 0.02); border: 1px solid #ddd; border-radius: 8px;">
        <div class="control-group">
            <label for="massSlider" style="font-size: 0.85em; font-weight: bold; margin-bottom: 4px; display: block;">Mass (m): <span id="massVal">2.0</span></label>
            <input type="range" id="massSlider" min="0.5" max="10.0" step="0.1" value="2.0" style="width: 100%;">
        </div>
        <div class="control-group">
            <label for="stiffSlider" style="font-size: 0.85em; font-weight: bold; margin-bottom: 4px; display: block;">Spring Stiffness (k): <span id="stiffVal">15.0</span></label>
            <input type="range" id="stiffSlider" min="1.0" max="50.0" step="0.5" value="15.0" style="width: 100%;">
        </div>
        <div class="control-group">
            <label for="frictionSlider" style="font-size: 0.85em; font-weight: bold; margin-bottom: 4px; display: block;">Friction Coefficient (f): <span id="frictionVal">0.4</span></label>
            <input type="range" id="frictionSlider" min="0.0" max="5.0" step="0.05" value="0.4" style="width: 100%;">
        </div>
    </div>
    <div id="simulation-space" style="border: 1px solid #ccc; border-radius: 8px; background: #fff;"></div>
    <div style="margin-top: 10px;">
        <button id="resetBtn" style="padding: 6px 12px; cursor: pointer; border-radius: 4px; border: 1px solid #ccc; background: #fff; font-weight: bold;">💥 Disrupt / Reset System</button>
    </div>
</div>

**Interaction Tips:**
- **Drag the blue block** to displace it from equilibrium
- **Adjust the sliders** to change system parameters in real-time
- **Set f=0.00** to see perfect energy conservation
- **Increase stiffness (k)** to make oscillations faster
- **Increase mass (m)** to make oscillations slower

## The Algorithm

The Velocity Verlet method works in these steps:

```javascript
// Step 1: Calculate current acceleration
const a_current = Force(x, v) / m;

// Step 2: Advance position using current velocity and acceleration
x_new = x + v*dt + 0.5*a_current*dt²;

// Step 3: Calculate next acceleration at new position
const a_next = Force(x_new, v_predicted) / m;

// Step 4: Advance velocity using average of accelerations
v_new = v + 0.5*(a_current + a_next)*dt;
```

This symmetric treatment of acceleration ensures time-reversibility and energy conservation.

## Technical Notes

- **Integration timestep**: 16ms (~60 FPS)
- **Rendering**: D3.js SVG manipulation
- **Physics accuracy**: Machine precision limited only by floating-point arithmetic

## Further Exploration

Try answering these questions by experimenting with the simulation:

1. What combination of m, k, and f produces critical damping (returns to equilibrium fastest without overshooting)?
2. How does the oscillation frequency change with mass and stiffness?
3. At what friction level does the system become overdamped (slow return, no oscillation)?

---

*This exhibit demonstrates why interactive visualizations beat static diagrams for learning dynamics.*
