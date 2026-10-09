import { test, expect, type Page } from "@playwright/test";

// Fail on uncaught JS errors so a broken exhibit script is caught
function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    return errors;
}

test("mass-spring exhibit and math render after clicking through from home", async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto("/");
    await page.locator('article a[href$="mass-spring/"]').first().click();

    await expect(page.locator("#simulation-space svg")).toBeVisible();
    await expect(page.locator("mjx-container").first()).toBeVisible();
    await expect(page.locator("#museum-utilities")).toBeVisible();

    expect(errors).toEqual([]);
});

test("mass-spring still renders when returning via browser back", async ({ page }) => {
    await page.goto("/mass-spring/");
    await expect(page.locator("#simulation-space svg")).toBeVisible();

    await page.goto("/about/");
    await page.goBack();

    await expect(page.locator("#simulation-space svg")).toBeVisible();
    await expect(page.locator("mjx-container").first()).toBeVisible();
});

test("mass-spring block animates", async ({ page }) => {
    await page.goto("/mass-spring/");
    const block = page.locator("#simulation-space svg rect[rx]").first();
    await expect(block).toBeVisible();

    const x1 = await block.getAttribute("x");
    await page.waitForTimeout(300);
    const x2 = await block.getAttribute("x");

    expect(x2).not.toBe(x1);
});

test("gitops visualizer renders nodes", async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto("/gitops-visualizer/");
    await expect(page.locator("#d3-cluster-museum-piece svg")).toBeVisible();
    await expect(page.locator("#d3-cluster-museum-piece .node")).toHaveCount(6);

    expect(errors).toEqual([]);
});

test("orbit sandbox: presets change the trajectory and a circular orbit stays circular", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/orbital-mechanics/");

    const sandbox = page.locator("#orbit-sim");
    const readout = sandbox.locator(".orbit-readout");
    await expect(sandbox.locator("svg")).toBeVisible();
    await expect(readout).toContainText("Circular orbit");

    // Eccentricity should stay near zero if the integrator conserves energy
    await page.waitForTimeout(1500);
    const eccText = await sandbox.locator(".orbit-readout div", { hasText: "Eccentricity" }).innerText();
    expect(parseFloat(eccText.replace("Eccentricity:", ""))).toBeLessThan(0.01);

    await sandbox.getByRole("button", { name: "Escape", exact: true }).click();
    await expect(readout).toContainText("Escapes");

    await sandbox.getByRole("button", { name: "Elliptical", exact: true }).click();
    await expect(readout).toContainText("Elliptical orbit");

    await sandbox.getByRole("button", { name: "Falls back", exact: true }).click();
    await expect(readout).toContainText(/Falls back|Crashed/);

    expect(errors).toEqual([]);
});

test("space elevator: release outcome depends on climber height", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/orbital-mechanics/");

    const sim = page.locator("#elevator-sim");
    const readout = sim.locator(".orbit-readout");
    const slider = sim.locator("input[type=range]").first();
    await expect(sim.locator("svg")).toBeVisible();

    const setHeight = (value: number) =>
        slider.evaluate((el, v) => {
            const input = el as HTMLInputElement;
            input.value = String(v);
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }, value);

    await setHeight(3);
    await expect(readout).toContainText(/Falls back/i);
    await setHeight(5);
    await expect(readout).toContainText(/Elliptical orbit/i);
    await setHeight(6.62);
    await expect(readout).toContainText(/Circular orbit/i);
    await setHeight(9);
    await expect(readout).toContainText(/Escapes/i);

    const release = sim.getByRole("button", { name: "Release climber" });
    await release.click();
    await expect(release).toBeDisabled();
    await page.waitForTimeout(500);
    await expect(readout).toContainText(/Released: escapes/i);

    await sim.getByRole("button", { name: "Reset" }).click();
    await expect(release).toBeEnabled();

    expect(errors).toEqual([]);
});

// MkDocs gives every heading an id; an exhibit container with the same id makes
// getElementById return the heading and the exhibit renders inside it.
test("exhibit pages have no duplicate element ids", async ({ page }) => {
    for (const path of ["/mass-spring/", "/gitops-visualizer/", "/orbital-mechanics/"]) {
        await page.goto(path);
        const duplicates = await page.evaluate(() => {
            const seen = new Set<string>();
            const dupes: string[] = [];
            document.querySelectorAll("[id]").forEach((node) => {
                if (seen.has(node.id)) dupes.push(node.id);
                seen.add(node.id);
            });
            return dupes;
        });
        expect(duplicates, path).toEqual([]);
    }
});
