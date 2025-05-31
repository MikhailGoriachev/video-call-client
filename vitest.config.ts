import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/sdk/__tests__/setup/MockWebSocket.ts"],
  },
});
