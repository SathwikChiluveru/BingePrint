import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// DOM tests opt in by filename (*.dom.test.ts[x]) or by living under
// tests/integration/components/. Everything else runs in plain node.
const domTests = [
  "tests/**/*.dom.test.{ts,tsx}",
  "tests/integration/components/**/*.test.{ts,tsx}",
];

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    setupFiles: ["tests/setup/vitest.setup.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["node_modules/**", ...domTests],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: domTests,
          exclude: ["node_modules/**"],
        },
      },
    ],
  },
});
