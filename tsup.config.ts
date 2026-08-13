import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    express: "src/middleware/express.ts",
    fastify: "src/middleware/fastify.ts",
    zod: "src/integrations/zod.ts",
  },
  format: ["esm", "cjs"],
  dts: false,
  sourcemap: false,
  clean: false,
  splitting: false,
  treeshake: true,
  target: "es2022",
  tsconfig: "./tsconfig.json",
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".js" };
  },
});
