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
  await admin.getByRole("spinbutton", { name: "Grace minutes" }).fill("120");
  await admin.getByRole("button", { name: "Create" }).click();
  await admin.getByRole("button", { name: "Start check-in" }).click();
  await expect(admin).toHaveURL(/\/live$/);
  const qr = admin.getByAltText("Check-in QR code");
  await expect(qr).toBeVisible();
  const qrUrl = new URL((await qr.getAttribute("data-qr-url"))!);

  // A tampered / stale token is refused.
  await alicePhone.goto(`${qrUrl.pathname}?m=${qrUrl.searchParams.get("m")}&t=0.forged`);
  await alicePhone.getByRole("button", { name: "Check in" }).click();
  await expect(alicePhone.locator("p[role=alert]")).toContainText("QR code expired");

  // The real token + Alice's fingerprint works.
  await alicePhone.goto(qrUrl.pathname + qrUrl.search);
  await alicePhone.getByRole("button", { name: "Check in" }).click();
  await expect(alicePhone.getByRole("status")).toContainText("Checked in to Weekly sync");
  await expect(admin.getByTestId("live-count")).toHaveText("1 / 3", { timeout: 10_000 });

  // Checking in again just reports the existing record.
  await alicePhone.goto(qrUrl.pathname + qrUrl.search);
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
  await expect(alicePhone.getByText("1 pts · Good standing")).toBeVisible();

  // Suspected proxy shows on the admin dashboard.
  await admin.goto("/admin");
  await expect(admin.getByText("register shared device")).toBeVisible();
});

test("group meetings only admit group members and keep their own strikes", async ({ browser, baseURL }) => {
  const admin = await asAdmin(await browser.newContext(), baseURL!);

  // Admin creates a Leads group with Alice in it.
  await admin.goto("/admin/groups");
  await admin.getByPlaceholder(/e\.g\. Leads/).fill("Leads");
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
  const qrUrl = new URL((await qr.getAttribute("data-qr-url"))!);

  // Carol (not in Leads) registers her own phone, then is refused.
  const carolPhone = await (await browser.newContext()).newPage();
  await addFingerprint(carolPhone);
  await devLogin(carolPhone, "Carol");
  await carolPhone.getByRole("button", { name: "Register this phone" }).click();
  await expect(carolPhone).toHaveURL(/\/me/);
  await carolPhone.goto(qrUrl.pathname + qrUrl.search);
  await carolPhone.getByRole("button", { name: "Check in" }).click();
  await expect(carolPhone.locator("p[role=alert]")).toContainText("only for Leads");

  // Closing marks only Alice (the one group member) absent, under the Leads count.
  await admin.getByRole("link", { name: "Manage meeting" }).click();
  await admin.getByRole("button", { name: /Close meeting/ }).click();
  await expect(admin.getByRole("row", { name: /Alice Member/ })).toContainText("absent");
  await expect(admin.getByRole("row", { name: /Carol Member/ })).toHaveCount(0);
  await admin.goto("/admin/members");
  await expect(admin.getByRole("row", { name: /Alice Member/ })).toContainText("Leads:");
});
