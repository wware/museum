import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";

const MANIFEST = readFileSync("docs/lab/service/openapi.json", "utf8");
const EXAMPLE_STATE = readFileSync("contract/examples/queue.state.json", "utf8");
const LAB_PAGE = "/lab/checkout-line/";

function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    return errors;
}

async function statValue(page: Page, label: string): Promise<string> {
    const row = page.locator('[data-view="stats"] .remote-kv-row', { hasText: label });
    return (await row.locator(".remote-kv-value").innerText()).trim();
}

test.describe("in-museum service (service worker)", () => {
    test("exhibit runs on a first visit, before any worker is installed", async ({ page }) => {
        const errors = collectPageErrors(page);
        await page.goto(LAB_PAGE);

        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "ready", { timeout: 10_000 });
        expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

        await expect(exhibit.locator(".remote-control")).toHaveCount(7);
        await expect(exhibit.locator(".remote-view")).toHaveCount(3);
        await expect(exhibit.locator('[data-view="queue_length"] path.remote-series')).toHaveCount(1);
        await expect(exhibit.locator('[data-view="events"] li').first()).toContainText("The exhibit opened");

        expect(errors).toEqual([]);
    });

    test("actions change the state, and disabled actions explain why", async ({ page }) => {
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "ready", { timeout: 10_000 });

        await exhibit.getByRole("button", { name: "Pause" }).click();
        await expect(exhibit.getByRole("button", { name: "Pause" })).toBeDisabled();
        await expect(exhibit.getByRole("button", { name: "Resume" })).toBeEnabled();
        await expect(exhibit.locator('[data-action="pause"] .remote-reason')).toHaveText("The simulation is already paused");

        // Paused, so nobody is served while we count
        const before = Number(await statValue(page, "People waiting"));
        await exhibit.getByRole("button", { name: /Rush hour/ }).click();
        await expect.poll(async () => Number(await statValue(page, "People waiting"))).toBeGreaterThanOrEqual(before + 9);

        await exhibit.locator('[data-action="set_servers"] select').selectOption("3");
        await expect(exhibit.locator('[data-view="events"] li').first()).toContainText("3 servers now working");

        page.once("dialog", (dialog) => void dialog.accept());
        await exhibit.getByRole("button", { name: "Reset" }).click();
        await expect(exhibit.locator('[data-action="set_servers"] select')).toHaveValue("1");
        await expect(exhibit.locator('[data-view="events"] li').first()).toContainText("Reset");
        await expect(exhibit.getByRole("button", { name: "Pause" })).toBeEnabled();
    });

    test("slider values reach the service, which validates them like FastAPI would", async ({ page }) => {
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "ready", { timeout: 10_000 });

        await exhibit.locator('[data-action="set_arrival_rate"] input[type=range]').evaluate((input: HTMLInputElement) => {
            input.value = "2.5";
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await expect.poll(() => statValue(page, "Utilization")).toBe("250%");
        await expect(exhibit.locator('[data-view="events"] li', { hasText: "exceed capacity" })).toHaveCount(1);

        const refused = await page.evaluate(async () => {
            const res = await fetch("/lab/service/exhibits/queue/actions/set_arrival_rate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rate: 12 }),
            });
            return { status: res.status, body: await res.json() };
        });
        expect(refused.status).toBe(422);
        expect(refused.body.detail[0].loc).toEqual(["body", "rate"]);
    });
});

test.describe("outside service (stubbed, no service worker)", () => {
    test.use({ serviceWorkers: "block" });

    // Point the page's "museum" service id at stub URLs instead of the in-museum worker
    async function useStubService(page: Page, handlers: Record<string, (route: Route) => unknown>): Promise<void> {
        await page.route("**/remote-services.json", (route) =>
            route.fulfill({ json: { services: { museum: { base_url: "stub-service/" } } } }),
        );
        await page.route("**/stub-service/**", (route) => {
            const path = new URL(route.request().url()).pathname.replace(/^.*\/stub-service\//, "");
            const handler = handlers[path];
            return handler ? handler(route) : route.fulfill({ status: 404, json: { detail: "Not Found" } });
        });
    }

    const ok = (route: Route) => route.fulfill({ json: { status: "ok", service: "Stub" } });
    const manifest = (route: Route) => route.fulfill({ contentType: "application/json", body: MANIFEST });
    const exampleState = (route: Route) => route.fulfill({ contentType: "application/json", body: EXAMPLE_STATE });

    test("not configured: a permanently closed placard with no retry", async ({ page }) => {
        await page.route("**/remote-services.json", (route) => route.fulfill({ json: { services: {} } }));
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "not_configured");
        await expect(exhibit).toContainText("only on display at a local branch");
        await expect(exhibit.getByRole("button", { name: "Check again" })).toHaveCount(0);
    });

    test("unreachable, then 'Check again' succeeds once the service is up", async ({ page }) => {
        let up = false;
        await useStubService(page, {
            healthz: (route) => (up ? ok(route) : route.abort("connectionrefused")),
            "openapi.json": manifest,
            "exhibits/queue/state": exampleState,
        });
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "unreachable");
        await expect(exhibit).toContainText("temporarily closed");

        up = true;
        await exhibit.getByRole("button", { name: "Check again" }).click();
        await expect(exhibit).toHaveAttribute("data-state", "ready");
    });

    test("unhealthy: the service's own explanation is shown", async ({ page }) => {
        await useStubService(page, {
            healthz: (route) => route.fulfill({ json: { status: "degraded", service: "Stub", detail: "The cash registers are offline" } }),
        });
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "unhealthy");
        await expect(exhibit).toContainText("The cash registers are offline");
    });

    test("incompatible: a manifest that doesn't describe this exhibit", async ({ page }) => {
        const other = JSON.parse(MANIFEST);
        other["x-museum"] = { exhibits: { something_else: other["x-museum"].exhibits.queue } };
        await useStubService(page, { healthz: ok, "openapi.json": (route) => route.fulfill({ json: other }) });
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "incompatible");
        await expect(exhibit).toContainText('doesn\'t describe an exhibit called "queue"');
    });

    test("the contract's example state renders: values, views, and disabled reasons", async ({ page }) => {
        const errors = collectPageErrors(page);
        await useStubService(page, { healthz: ok, "openapi.json": manifest, "exhibits/queue/state": exampleState });
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "ready");

        await expect(exhibit.locator('[data-action="set_servers"] select')).toHaveValue("2");
        await expect(exhibit.locator('[data-action="set_arrival_rate"] .remote-value')).toHaveText("2.5 per second");
        await expect(exhibit.getByRole("button", { name: "Resume" })).toBeDisabled();
        await expect(exhibit.locator('[data-action="resume"] .remote-reason')).toHaveText("The simulation is already running");
        expect(await statValue(page, "Utilization")).toBe("125%");
        await expect(exhibit.locator('[data-view="events"] li').first()).toContainText("exceed capacity");
        expect(errors).toEqual([]);
    });

    test("a refused action shows the service's validation message", async ({ page }) => {
        await useStubService(page, {
            healthz: ok,
            "openapi.json": manifest,
            "exhibits/queue/state": exampleState,
            "exhibits/queue/actions/add_burst": (route) =>
                route.fulfill({ status: 422, json: { detail: [{ loc: ["body"], msg: "The store is closed" }] } }),
        });
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "ready");
        await exhibit.getByRole("button", { name: /Rush hour/ }).click();
        await expect(exhibit.locator(".remote-error")).toHaveText("The exhibit refused that: The store is closed");
    });

    test("the exhibit closes after the service stops answering", async ({ page }) => {
        let up = true;
        await useStubService(page, {
            healthz: ok,
            "openapi.json": manifest,
            "exhibits/queue/state": (route) => (up ? exampleState(route) : route.abort("connectionrefused")),
        });
        await page.goto(LAB_PAGE);
        const exhibit = page.locator(".remote-exhibit");
        await expect(exhibit).toHaveAttribute("data-state", "ready");
        up = false;
        await expect(exhibit).toHaveAttribute("data-state", "unreachable", { timeout: 10_000 });
    });
});
