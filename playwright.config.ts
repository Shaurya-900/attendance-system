import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Pixel 7"] },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATA_BACKEND: "memory",
      APP_SECRET: "e2e-secret",
      WEBAUTHN_RP_ID: "localhost",
      WEBAUTHN_ORIGIN: `http://localhost:${PORT}`,
    },
  },
});
