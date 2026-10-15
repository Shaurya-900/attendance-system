import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/** Give this page a phone-like platform authenticator with fingerprint (user verification). */
async function addFingerprint(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
}

async function devLogin(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(name) }).click();
}

async function asAdmin(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "dev_uid", value: "user-0", url: baseURL }]);
  return context.newPage();
}

test("proxy-proof check-in flow", async ({ browser, baseURL }) => {
  // Alice registers her phone.
  const alicePhone = await (await browser.newContext()).newPage();
  await addFingerprint(alicePhone);
  await devLogin(alicePhone, "Alice");
  await expect(alicePhone).toHaveURL(/\/onboard/);
  await alicePhone.getByRole("button", { name: "Register this phone" }).click();
  await expect(alicePhone).toHaveURL(/\/me/);

  // Admin creates and starts a meeting; projector shows a rotating QR.
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  await admin.goto("/admin/meetings");
  await admin.getByPlaceholder("Meeting title").fill("Weekly sync");
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  await admin.getByLabel("Starts at").fill(`${today}T00:00`);
  await admin.getByLabel("Mark late after (minutes)").fill("120");
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.getByRole("button", { name: "Start check-in" }).click();
  await expect(admin).toHaveURL(/\/live$/);
  const qr = admin.getByAltText("Check-in QR code");
  await expect(qr).toBeVisible();
  const qrUrl = new URL((await qr.getAttribute("data-qr-url"))!);

  // A tampered / stale token is refused as soon as the page opens.
  await alicePhone.goto(`${qrUrl.pathname}?m=${qrUrl.searchParams.get("m")}&t=0.forged`);
  await expect(alicePhone.locator("p[role=alert]")).toContainText("QR code has expired");
  await expect(alicePhone.getByRole("button", { name: "Check in" })).toHaveCount(0);

  // The real token + Alice's fingerprint works, even if she takes longer than the QR's lifetime to tap.
  await alicePhone.goto(qrUrl.pathname + qrUrl.search);
  await alicePhone.waitForTimeout(21_000);
  await alicePhone.getByRole("button", { name: "Check in" }).click();
  await expect(alicePhone.getByRole("status")).toContainText("Checked in to Weekly sync");
  await expect(admin.getByTestId("live-count")).toHaveText("1 / 3", { timeout: 10_000 });

  // Checking in again just reports the existing record.
  const fresh = new URL((await qr.getAttribute("data-qr-url"))!);
  await alicePhone.goto(fresh.pathname + fresh.search);
  await alicePhone.getByRole("button", { name: "Check in" }).click();
  await expect(alicePhone.getByRole("status")).toContainText("already checked in");

  // Bob tries to register on Alice's phone so she can check in for him: refused.
  await alicePhone.getByRole("button", { name: "Sign out" }).click();
  await devLogin(alicePhone, "Bob");
  await expect(alicePhone).toHaveURL(/\/onboard/);
  await alicePhone.getByRole("button", { name: "Register this phone" }).click();
  await expect(alicePhone.locator("p[role=alert]")).toContainText("already registered to another member");

  // Closing the meeting marks everyone else absent → 1 strike for Bob.
  await admin.getByRole("link", { name: "Manage meeting" }).click();
  await admin.getByRole("button", { name: /Close meeting/ }).click();
  await expect(admin.getByRole("row", { name: /Bob Member/ })).toContainText("absent");
  await expect(admin.getByRole("row", { name: /Alice Member/ })).toContainText("present");
  await alicePhone.goto("/me");
  await expect(alicePhone.getByText("1 pts, good standing")).toBeVisible();

  // Suspected proxy shows on the admin dashboard.
  await admin.goto("/admin");
  await expect(admin.getByText("register shared device")).toBeVisible();
});

test("group meetings only admit group members and keep their own strikes", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);

  // Admin creates a Leads group with Alice in it.
  await admin.goto("/admin/groups");
  await admin.getByPlaceholder(/e\.g\. Marketing/).fill("Leads");
  await admin.getByLabel("Type").selectOption("leads");
  await admin.getByRole("button", { name: "Create" }).click();
  await expect(admin.getByRole("heading", { name: "Leads" })).toBeVisible();
  await admin.getByLabel(/Alice Member/).check();
  await admin.getByRole("button", { name: "Add to group" }).click();
  await expect(admin.getByRole("status")).toContainText("Added 1 member");

  // Leads meeting.
  await admin.goto("/admin/meetings");
  await admin.getByPlaceholder("Meeting title").fill("Leads sync");
  await admin.getByLabel("For").selectOption({ label: "Leads" });
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  await admin.getByLabel("Starts at").fill(`${today}T00:00`);
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.getByRole("button", { name: "Start check-in" }).click();
  const qr = admin.getByAltText("Check-in QR code");
  await expect(qr).toBeVisible();
  await expect(admin.getByTestId("live-count")).toHaveText("0 / 1");

  // Carol (not in Leads) registers her own phone, then is refused.
  const carolPhone = await (await browser.newContext()).newPage();
  await addFingerprint(carolPhone);
  await devLogin(carolPhone, "Carol");
  await carolPhone.getByRole("button", { name: "Register this phone" }).click();
  await expect(carolPhone).toHaveURL(/\/me/);
  const freshQr = new URL((await qr.getAttribute("data-qr-url"))!);
  await carolPhone.goto(freshQr.pathname + freshQr.search);
  await carolPhone.getByRole("button", { name: "Check in" }).click();
  await expect(carolPhone.locator("p[role=alert]")).toContainText("only for Leads");

  // Closing marks only Alice (the one group member) absent, under the Leads count.
  await admin.getByRole("link", { name: "Manage meeting" }).click();
  await admin.getByRole("button", { name: /Close meeting/ }).click();
  await expect(admin.getByRole("row", { name: /Alice Member/ })).toContainText("absent");
  await expect(admin.getByRole("row", { name: /Carol Member/ })).toHaveCount(0);
  await admin.goto("/admin/members");
  await expect(admin.getByRole("article", { name: "Alice Member" })).toContainText("Leads:");
});

test("semesters: overlap is refused, delete removes the row immediately", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  await admin.goto("/admin");
  const year = new Date().getFullYear();
  await admin.getByPlaceholder("e.g. Odd sem 2026").fill("Overlap");
  await admin.getByLabel("Starts on").fill(`${year}-03-01`);
  await admin.getByLabel("Ends on").fill(`${year}-04-01`);
  await admin.getByRole("button", { name: "Add semester" }).click();
  await expect(admin.locator("p[role=alert]")).toContainText("Overlaps");

  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: /Delete semester/ }).first().click();
  await expect(admin.getByText("No semesters yet.")).toBeVisible();
  await admin.reload();
  await expect(admin.getByText("No semesters yet.")).toBeVisible();
});

test("admin nav pages are prefetched, so clicking needs no server round trip", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  await admin.goto("/admin");
  await admin.waitForLoadState("networkidle");
  await admin.waitForTimeout(500); // let background prefetches finish

  const afterClick: string[] = [];
  admin.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path === "/admin/meetings" || path === "/admin/groups") afterClick.push(r.url());
  });
  await admin.getByRole("link", { name: "Meetings" }).click();
  await expect(admin.getByRole("heading", { name: "Meetings" })).toBeVisible();
  await admin.getByRole("link", { name: "Groups" }).click();
  await expect(admin.getByRole("heading", { name: "Groups" })).toBeVisible();
  expect(afterClick).toEqual([]);
});

test("several groups can be created and all show up straight away", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  // Unique names: --repeat-each runs in parallel against one shared in-memory server.
  const run = Math.random().toString(36).slice(2, 6);
  const groups = [["Marketing team", "team"], ["Core", "core"], ["All leads", "leads"], ["Hackathon 2026 team", "event"]]
    .map(([name, kind]) => ({ name: `${name} ${run}`, kind }));
  await admin.goto("/admin/groups");
  for (const { name, kind } of groups) {
    await admin.getByPlaceholder(/e\.g\. Marketing/).filter({ visible: true }).fill(name);
    await admin.getByLabel("Type").filter({ visible: true }).selectOption(kind);
    await admin.getByRole("button", { name: "Create" }).click();
    await expect(admin.getByRole("heading", { name, exact: true })).toBeVisible();
    await admin.getByRole("link", { name: "Groups" }).click();
    await expect(admin.getByRole("heading", { name: "Groups", exact: true })).toBeVisible();
  }
  for (const { name } of groups) await expect(admin.getByRole("link", { name, exact: true })).toBeVisible();
  await admin.getByRole("link", { name: "Meetings" }).click();
  for (const { name } of groups) await expect(admin.getByLabel("For").getByRole("option", { name, exact: true })).toBeAttached();
});

test("double-clicking Create makes one meeting; admin can excuse a member", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  await admin.goto("/admin/meetings");
  await admin.getByPlaceholder("Meeting title").fill("Double click test");
  await admin.getByLabel("Starts at").fill("2026-12-01T18:00");
  await admin.getByRole("button", { name: "Create" }).dblclick();
  await admin.waitForURL(/meetings\/[^/]+$/);
  await admin.getByRole("link", { name: "Meetings" }).click();
  await expect(admin.getByRole("link", { name: "Double click test" })).toHaveCount(1);

  // Close it so Carol is absent, then excuse her on her behalf.
  await admin.getByRole("link", { name: "Double click test" }).click();
  await admin.getByRole("button", { name: "Start check-in" }).click();
  await admin.getByRole("link", { name: "Manage meeting" }).click();
  await admin.getByRole("button", { name: /Close meeting/ }).click();
  await expect(admin.getByRole("row", { name: /Carol Member/ })).toContainText("absent");
  await admin.getByRole("link", { name: "Excuses" }).click();
  const meetingOption = (await admin.getByLabel("Meeting").locator("option").allTextContents()).find((t) => t.startsWith("Double click test"))!;
  await admin.getByLabel("Meeting").selectOption({ label: meetingOption });
  await admin.getByLabel("Member").selectOption({ label: "Carol Member" });
  await admin.getByLabel("Reason").fill("Medical");
  await admin.getByRole("button", { name: "Add excuse" }).click();
  await expect(admin.getByRole("status")).toContainText("approved");
  await admin.goto("/admin/meetings");
  await admin.getByRole("link", { name: "Double click test" }).click();
  await expect(admin.getByRole("row", { name: /Carol Member/ })).toContainText("excused");
});

test("admin can delete a group and a member", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  admin.on("dialog", (d) => d.accept());

  await admin.goto("/admin/groups");
  await admin.getByPlaceholder(/e\.g\. Marketing/).fill("Delete me team");
  await admin.getByRole("button", { name: "Create" }).click();
  await expect(admin.getByRole("heading", { name: "Delete me team" })).toBeVisible();
  await admin.getByRole("button", { name: "Delete group" }).click();
  await admin.waitForURL(/\/admin\/groups$/);
  await expect(admin.getByRole("link", { name: "Delete me team" })).toHaveCount(0);

  await admin.goto("/admin/members");
  await admin.getByRole("textbox").last().fill("temp@ecell.test,Temp Person,X1");
  await admin.getByRole("button", { name: "Import" }).click();
  await expect(admin.getByText("temp@ecell.test")).toBeVisible();
  await admin.getByRole("button", { name: "Remove" }).click();
  await expect(admin.getByText("temp@ecell.test")).toHaveCount(0);

  const bob = admin.getByRole("article", { name: "Bob Member" });
  await bob.getByRole("button", { name: "Delete" }).click();
  await expect(admin.getByRole("article", { name: "Bob Member" })).toHaveCount(0);
  await expect(admin.getByRole("article", { name: "Core Admin" }).getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("a member can be removed from a group", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  await admin.goto("/admin/groups");
  await admin.getByPlaceholder(/e\.g\. Marketing/).fill("Removal team");
  await admin.getByRole("button", { name: "Create" }).click();
  await expect(admin.getByRole("heading", { name: "Removal team" })).toBeVisible();
  await admin.getByLabel(/Carol Member/).check();
  await admin.getByRole("button", { name: "Add to group" }).click();
  await expect(admin.getByRole("status")).toContainText("Added 1 member");

  const carol = admin.getByRole("row", { name: /Carol Member/ });
  await expect(carol).toBeVisible();
  await carol.getByRole("button", { name: "Remove" }).click();
  await expect(admin.getByRole("row", { name: /Carol Member/ })).toHaveCount(0);
  // She can be added again.
  await expect(admin.getByLabel(/Carol Member/)).toBeVisible();
});

test("a meeting can be deleted", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);
  admin.on("dialog", (d) => d.accept());
  await admin.goto("/admin/meetings");
  await admin.getByPlaceholder("Meeting title").fill("Mistake meeting");
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  await admin.getByLabel("Starts at").fill(`${today}T09:00`);
  await admin.getByRole("button", { name: "Create" }).click();
  await expect(admin.getByRole("heading", { name: "Mistake meeting" })).toBeVisible();
  await admin.getByRole("button", { name: "Delete meeting" }).click();
  await admin.waitForURL(/\/admin\/meetings$/);
  await expect(admin.getByRole("link", { name: "Mistake meeting" })).toHaveCount(0);
});
