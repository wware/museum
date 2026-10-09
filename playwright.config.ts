import { defineConfig } from "@playwright/test";

// Tests run against the built site (run `mkdocs build -f mkdocs.test.yml` first)
export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: "http://127.0.0.1:8123",
        trace: "retain-on-failure",
        // Opt-in for machines behind a TLS-intercepting proxy; CI stays strict
        ignoreHTTPSErrors: !!process.env.PW_IGNORE_HTTPS_ERRORS,
    },
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
    webServer: {
        command: "python3 -m http.server 8123 --bind 127.0.0.1 --directory site",
        url: "http://127.0.0.1:8123",
        reuseExistingServer: !process.env.CI,
    },
});
