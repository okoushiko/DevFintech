const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, ".artifacts");
fs.mkdirSync(output, { recursive: true });
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
const reports = [];
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.TEST_BROWSER_PATH
      ? { executablePath: process.env.TEST_BROWSER_PATH }
      : {}),
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    const submissions = [];
    let backend = "success";
    page.on("pageerror", (error) => errors.push(error.message));
    // No registration or notification reaches a real recipient during testing.
    await context.route("https://script.google.com/**", async (route) => {
      submissions.push(JSON.parse(route.request().postData()));
      if (backend === "offline") return route.abort("failed");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          backend === "failure"
            ? { ok: false, error: "Rejected test" }
            : { ok: true },
        ),
      });
    });
    await context.route("https://discord.com/**", (route) => {
      throw new Error("Unexpected Discord request");
    });
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["tablet", 768, 1024],
      ["mobile", 390, 844],
      ["small-mobile", 320, 740],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() =>
        [...document.querySelectorAll("main *,header *,footer *")]
          .filter((el) => {
            if (el.closest('[aria-hidden="true"]')) return false;
            const rect = el.getBoundingClientRect();
            return (
              rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1)
            );
          })
          .map((el) => ({
            tag: el.tagName,
            class: el.className,
            right: el.getBoundingClientRect().right,
          })),
      );
      assert.deepEqual(overflow, [], `${name}: horizontal overflow`);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
      );
      assert.equal(
        await page
          .locator(".hero-photo img")
          .evaluate((img) => img.complete && img.naturalWidth > 0),
        true,
      );
      await page.screenshot({
        animations: "disabled",
        path: path.join(output, name + ".png"),
        fullPage: true,
      });
      if (name === "desktop" || name === "mobile") {
        await page
          .locator("#compound-hacks")
          .screenshot({
            path: path.join(output, name + "-compound-hacks.png"),
            animations: "disabled",
          });
      }
      if (width <= 960) {
        await page
          .getByRole("button", { name: "Open navigation", exact: true })
          .click();
        assert.equal(
          await page.locator(".menu-btn").getAttribute("aria-expanded"),
          "true",
        );
        await page
          .locator("#primary-nav")
          .getByRole("link", { name: "Chapters", exact: true })
          .click();
        assert.equal(
          await page.locator(".menu-btn").getAttribute("aria-expanded"),
          "false",
        );
        assert.equal(new URL(page.url()).hash, "#chapters");
      }
      reports.push(
        name +
          ": no overflow; photograph loaded" +
          (width <= 960 ? "; menu works" : ""),
      );
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base);
    const brokenAnchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map((link) => link.hash.slice(1))
        .filter((id) => id && !document.getElementById(id)),
    );
    assert.deepEqual(
      brokenAnchors,
      [],
      "Every section link has a real destination",
    );
    await page.locator(".catalog>summary").click();
    await page.getByRole("button", { name: "Finance", exact: true }).click();
    assert.equal(await page.locator(".catalog-course:visible").count(), 5);
    await page
      .getByRole("button", { name: "Coding basics", exact: true })
      .click();
    assert.equal(await page.locator(".catalog-course:visible").count(), 2);
    await page
      .getByRole("button", { name: "All courses", exact: true })
      .click();
    assert.equal(await page.locator(".catalog-course:visible").count(), 9);
    await page.locator(".catalog-course").first().locator("summary").click();
    assert.equal(
      await page.locator(".catalog-course").first().getAttribute("open"),
      "",
    );
    await page.screenshot({
      animations: "disabled",
      path: path.join(output, "catalog.png"),
    });
    reports.push(
      "Catalog: 9 courses; 5 finance and 2 coding filters; course details expand",
    );

    const next = () => page.locator("#wizNext").click();
    const fill = async (values) => {
      for (const [id, value] of Object.entries(values))
        await page.locator("#" + id).fill(value);
    };
    const choose = async (values) => {
      for (const [id, value] of Object.entries(values))
        await page.locator("#" + id).selectOption({ label: value });
    };
    const start = async (mode) => {
      await page
        .locator('button[data-join="' + mode + '"]')
        .filter({ visible: true })
        .first()
        .click();
    };
    await page.goto(base);
    await start("class");
    assert.equal(
      await page.locator("[role=dialog]").getAttribute("aria-modal"),
      "true",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "wiz-title",
    );
    await next();
    assert.equal(
      await page.locator("#studentFirst").getAttribute("aria-invalid"),
      "true",
    );
    await fill({
      studentFirst: "Alex <img src=x onerror=alert(1)>",
      studentLast: "Example",
    });
    await next();
    await fill({
      guardianFirst: "Sam",
      guardianLast: "Example",
      guardianEmail: "sam@example.test",
      guardianPhone: "5555550100",
    });
    await page.locator("#wizBack").click();
    assert.equal(
      await page.locator("#studentFirst").inputValue(),
      "Alex <img src=x onerror=alert(1)>",
    );
    assert.equal(await page.locator("#wizContent img").count(), 0);
    await next();
    assert.equal(await page.locator("#guardianFirst").inputValue(), "Sam");
    await next();
    await fill({ country: "United States", state_: "California" });
    await next();
    await choose({ heard: "School or teacher" });
    await fill({ experience: "New to budgeting." });
    await next();
    await page.getByRole("button", { name: /Monday/ }).click();
    // Enter on a choice button selects it without unexpectedly advancing.
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("#wiz-title").textContent(),
      "What days will you attend?",
    );
    await next();
    assert.equal(
      await page.locator(".wiz-step-count").textContent(),
      "Step 6 of 6",
    );
    assert.match(await page.locator(".wiz-summary").textContent(), /Alex <img/);
    assert.equal(await page.locator("#wizContent img").count(), 0);
    await page.screenshot({
      path: path.join(output, "registration-review.png"),
      animations: "disabled",
    });
    backend = "failure";
    await next();
    await page.locator("#wizStatus:not([hidden])").waitFor();
    assert.match(
      await page.locator("#wizStatus").textContent(),
      /couldn’t confirm/,
    );
    assert.equal(await page.locator("#wizNext").isEnabled(), true);
    backend = "offline";
    await next();
    await page.locator("#wizStatus:not([hidden])").waitFor();
    backend = "success";
    await next();
    await page
      .getByRole("heading", { name: "Registration sent.", exact: true })
      .waitFor();
    assert.equal(
      submissions.at(-1).studentFirst,
      "Alex <img src=x onerror=alert(1)>",
    );
    assert.equal(submissions.at(-1).schedule, "Monday 4:30PM to 5:30PM PST");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#wizOverlay").isVisible(), false);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.join),
      "class",
    );
    reports.push(
      "Class registration: validation, back navigation, input escaping, keyboard behavior, accurate progress, failure/offline recovery and mocked success",
    );

    await start("chapter");
    await page
      .getByRole("button", { name: /Start a chapter at my school/ })
      .click();
    await next();
    await fill({ schoolName: "Example School", location: "Test City" });
    await choose({ yourRole: "Student", grades: "High school (9–12)" });
    await next();
    await choose({ teamSize: "2 to 4 students", advisor: "Yes, we have one" });
    await next();
    await page.getByRole("button", { name: /Personal Finance/ }).click();
    await next();
    await choose({
      format: "A short workshop series",
      delivery: "Video calls",
      start: "This semester",
    });
    await next();
    await fill({
      first: "Alex",
      last: "Example",
      email: "alex@example.test",
      phone: "5555550100",
    });
    await next();
    await fill({ message: 'A <b>literal</b> message & "quoted" text.' });
    await next();
    assert.equal(await page.locator(".wiz-summary b").count(), 0);
    assert.match(
      await page.locator(".wiz-summary").textContent(),
      /A <b>literal<\/b> message/,
    );
    await next();
    await page
      .getByRole("heading", { name: "Request sent.", exact: true })
      .waitFor();
    assert.equal(submissions.at(-1).source, "devfintech-chapter-request");
    assert.equal(submissions.at(-1).topics, "Personal Finance");
    await page.keyboard.press("Escape");
    reports.push(
      "New chapter: full eight-step flow, literal review text and correct mocked payload",
    );

    await page.goto(base + "/#/start-a-chapter");
    await page.getByRole("button", { name: /Teach inside a club/ }).click();
    await next();
    await fill({ schoolName: "Existing Club School", location: "Test City" });
    await choose({ yourRole: "Teacher", grades: "Mixed ages" });
    await next();
    assert.equal(await page.locator("#clubName").isVisible(), true);
    await fill({ clubName: "Example Finance Club" });
    await choose({ clubSize: "10 to 25", meets: "Weekly" });
    await next();
    await page.getByRole("button", { name: /Banking/ }).click();
    await next();
    await choose({
      format: "A short workshop series",
      delivery: "Video calls",
      start: "This semester",
    });
    await next();
    await fill({
      first: "Teacher",
      last: "Example",
      email: "teacher@example.test",
      phone: "5555550100",
    });
    await next();
    await next();
    await next();
    await page
      .getByRole("heading", { name: "Request sent.", exact: true })
      .waitFor();
    assert.equal(submissions.at(-1).path, "existing");
    assert.equal(submissions.at(-1).clubName, "Example Finance Club");
    await page.keyboard.press("Escape");
    await page.goto(base + "/#/class");
    assert.equal(await page.locator("#studentFirst").isVisible(), true);
    await fill({ studentFirst: "Alternate", studentLast: "Example" });
    await next();
    await fill({
      guardianFirst: "Sam",
      guardianLast: "Example",
      guardianEmail: "sam@example.test",
      guardianPhone: "5555550100",
    });
    await next();
    await fill({ country: "United States", state_: "California" });
    await next();
    await choose({ heard: "School or teacher" });
    await fill({ experience: "New to coding." });
    await next();
    await page
      .getByRole("button", { name: /Other.*Tell us your time zone/ })
      .click();
    await next();
    await fill({ other: "GMT+1, Wednesday, 6 PM" });
    await next();
    assert.equal(
      await page.locator(".wiz-step-count").textContent(),
      "Step 7 of 7",
    );
    await next();
    await page
      .getByRole("heading", { name: "Registration sent.", exact: true })
      .waitFor();
    assert.equal(submissions.at(-1).schedule, "Other: GMT+1, Wednesday, 6 PM");
    await page.keyboard.press("Escape");
    await page.goto(base + "/#/curriculum:fintech");
    assert.equal(await page.locator(".catalog-course:visible").count(), 2);
    reports.push(
      "Compatibility: complete existing-club and alternate-schedule flows; legacy class/chapter/curriculum hashes work",
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    await page.locator(".mobile-join").click();
    await page.screenshot({
      path: path.join(output, "mobile-registration.png"),
      animations: "disabled",
    });
    const dialogOverflow = await page
      .locator(".wiz-card")
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    assert.equal(dialogOverflow, false);
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "wizNext",
    );
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "wizClose",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      "menu-btn",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).scrollBehavior,
      ),
      "auto",
    );
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    const enlargedOverflow = await page.evaluate(() =>
      [...document.querySelectorAll("main *,header *,footer *")]
        .filter((el) => {
          if (el.closest('[aria-hidden="true"]')) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
        })
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          text: el.textContent.slice(0, 50),
          right: el.getBoundingClientRect().right,
        })),
    );
    assert.deepEqual(enlargedOverflow, [], "200% text should not overflow");
    reports.push(
      "Accessibility: mobile dialog fits, focus traps/restores, reduced motion and 200% text enlargement",
    );
    assert.deepEqual(errors, [], "No uncaught browser errors");
    reports.push(
      "No uncaught browser errors; all submissions intercepted locally",
    );
    fs.writeFileSync(
      path.join(output, "test-results.json"),
      JSON.stringify({ passed: true, reports }, null, 2),
    );
    console.log(reports.join("\n"));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
