import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // 让 Vitest 也能解析 @ 指向 src
      "@": path.resolve(__dirname, "src")
    }
  },
  test: {
    coverage: {
      provider: "v8"
    }
  }
});
