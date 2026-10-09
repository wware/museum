# Orbits and the Space Elevator

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
<strong>🎯 Demonstration Goal:</strong> See why escape velocity is exactly $\sqrt{2}$ times circular speed, and discover that a space elevator can fling a payload out of orbit without a rocket.
</div>

## Orbit sandbox

Launch a ship from above a planet and watch what gravity does with it. The dashed line is the orbit the ship is on *right now*, computed from its current position and velocity. Its color tells you the outcome: red falls back, yellow is a closed ellipse, blue is a circle, and green escapes.

<div id="orbit-sim" style="width: 100%; margin: 20px 0;"></div>

**Things to try:**

- Press **Circular** and note the launch speed. Then press **Escape**: the ship needs only about 1.4 times that speed to leave for good.
- Slide the launch speed from 1.00 up to 1.42 and watch the ellipse stretch until the far end of the orbit runs off the screen. At exactly $\sqrt{2} \approx 1.414$ the orbit is a parabola: the boundary between trapped and free.
- Launch at an angle instead of horizontally. The orbit's lowest point drops, and with enough angle it dips below the surface.
- Raise the launch altitude. Escape speed is lower the farther out you start.

### The two numbers that matter

At distance $r$ from a planet with gravitational parameter $\mu$, a circular orbit has speed

$$
v_{circ} = \sqrt{\frac{\mu}{r}}
$$

and the escape speed is

$$
v_{esc} = \sqrt{\frac{2\mu}{r}} = \sqrt{2}\, v_{circ}
$$

Both follow from the *vis-viva* equation, which relates speed to position on any orbit with semi-major axis $a$:

$$
v^2 = \mu \left( \frac{2}{r} - \frac{1}{a} \right)
$$

A circular orbit has $a = r$. Escape means $a \to \infty$: the orbit is no longer closed.

## Space elevator

A tether anchored on the equator and extending out past geostationary orbit (GEO) rotates with the planet. A climber riding up the tether is carried around at speed $\omega r$, where $\omega$ is the planet's rotation rate. Let go, and the climber is simply a free object at that height with that speed.

<div id="elevator-sim" style="width: 100%; margin: 20px 0;"></div>

**Things to try:**

- Drag the climber slider and watch the color of the tether. Each color says what happens if you let go *there*.
- Release low: the climber is moving far slower than orbital speed and falls back to the ground.
- Release at **GEO** and you get a circular orbit that keeps pace with the planet's rotation, so the climber hovers over the same spot.
- Release between GEO and the outer dotted ring and you get an ellipse whose lowest point is the release point.
- Release **above the outer ring** and the climber escapes the planet entirely. No rocket, no fuel.

### Where the numbers come from

At GEO the orbital period equals the planet's rotation period, so circular speed equals tether speed:

$$
\omega^2 r_{GEO}^3 = \mu
$$

Releasing at radius $r$ gives speed $\omega r$. That is enough to escape when it exceeds $\sqrt{2\mu/r}$, which works out to

$$
r > \left( \frac{2\mu}{\omega^2} \right)^{1/3} = 2^{1/3}\, r_{GEO} \approx 1.26\, r_{GEO}
$$

For Earth that is about 53,000 km from the center, 47,000 km above the surface.

## What the model leaves out

- **Two dimensions only.** There is no orbital inclination and nothing like a rendezvous problem.
- **Point-mass planet.** No atmosphere, no oblateness, no moons, no other bodies.
- **An ideal tether.** It is rigid and massless, and releasing the climber does not disturb it. A real tether would sag, swing, and transfer momentum.
- **Earth-scaled readouts.** Distances are in planet radii internally and shown in kilometers for an Earth-like planet. The geostationary radius is 6.62 planet radii.
- **Adaptive time steps.** The integrator is Velocity Verlet with smaller steps near the planet, which keeps orbits stable at the accuracy this needs.

## Coming next: delta-v

This exhibit shows what a given launch velocity *does*. The natural follow-up is what it *costs* to change velocity, which is **delta-v**. Here is how it would be built on this foundation.

- **Thrust and fuel.** The ship gets a dry mass, a fuel mass, and an exhaust velocity. Prograde and retrograde burn buttons add acceleration along the velocity vector, and remaining delta-v comes from the rocket equation:

$$
\Delta v = v_e \ln\frac{m_0}{m_f}
$$

- **Maneuver nodes.** Because the orbit preview is already computed analytically from position and velocity, a planned burn is cheap to show: add the burn's $\Delta v$ to the velocity at a chosen point on the orbit and call `analyze` again. The user would drag a node along the orbit and a prograde/retrograde handle to see the new orbit before committing.
- **Hohmann transfer planner.** Between circular orbits of radius $r_1$ and $r_2$, a planner would show the two burns and their total, and compare them with the elevator's free ride to the same altitude. That makes the point that the elevator trades fuel for infrastructure. The formulas are below.
- **Numerics.** Burns would be applied as impulses for planning and as short finite burns during flight. Thrust breaks the exact energy conservation of Velocity Verlet, which is fine because the long coasting arcs between burns are what need to stay accurate, and those are conservative.
- **Testing.** The Hohmann and rocket-equation formulas are pure functions, so they get unit tests against known values (for example, the Earth low-orbit-to-GEO transfer needs about 3.9 km/s total).

The Hohmann burns, at the start and end of the transfer ellipse:

$$
\Delta v_1 = \sqrt{\frac{\mu}{r_1}}\left(\sqrt{\frac{2r_2}{r_1+r_2}} - 1\right), \qquad
\Delta v_2 = \sqrt{\frac{\mu}{r_2}}\left(1 - \sqrt{\frac{2r_1}{r_1+r_2}}\right)
$$

---

*This is a two-dimensional teaching model, not a mission planner.*
