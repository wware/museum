# The Checkout Line

<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
<strong>🎯 Demonstration Goal:</strong> See why a line that is "only" 90% busy is a long line, and why one that is 100% busy never stops growing.
</div>

Customers arrive at random and wait for one of the servers. Each server takes a random amount of time per customer. Nothing about the averages says a line should form, and yet it does.

<div class="remote-exhibit" data-service="museum" data-exhibit="queue"></div>

**Things to try:**

- Leave it alone for a minute. With arrivals at 80% of capacity, the line comes and goes, sometimes surprisingly long, purely from bad luck.
- Push **Arrival rate** up to 0.9 and then 0.95 with one server. Capacity is still higher than demand, but the line gets dramatically worse.
- Push arrivals to 1.0 or beyond. The event log warns you, and the chart climbs and keeps climbing.
- Press **Rush hour** and watch how long a burst of ten takes to clear, then add a second server and try again.
- Compare **one fast server** with **two slow ones** at the same total capacity (service rate 2.0 with one server, or 1.0 with two).

## Why the line explodes

Utilization is the fraction of capacity the arrivals use:

$$
\rho = \frac{\lambda}{c\,\mu}
$$

where $\lambda$ is the arrival rate, $\mu$ the rate one server finishes customers, and $c$ the number of servers. If $\rho \ge 1$, customers arrive at least as fast as they can be served, and the line grows without limit.

Below that, randomness alone causes waiting. For a single server with random arrivals and service times, the average number of people waiting is

$$
L_q = \frac{\rho^2}{1 - \rho}
$$

At 50% utilization that is half a person. At 90% it is 8.1, and at 95% it is 18. The last few percent of capacity are where all the waiting happens.

## About the Lab

Exhibits in the Lab wing don't run on this page. A separate exhibit service runs the simulation, describes its controls and views in an [OpenAPI](https://spec.openapis.org/oas/v3.1.0) document, and the museum builds the exhibit from that description.

This one is served by the museum itself: a service worker in your browser answers the exhibit's requests the same way an outside FastAPI service would. You can read its description at [service/openapi.json](service/openapi.json). If your browser stops the worker after a long idle period, the simulation starts over.
