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
