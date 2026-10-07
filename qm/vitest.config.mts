import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

config({ path: ".env" });

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["./vitest.global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      ALLOW_DEMO_RESET: "1",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
