import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  // Workspace packages export raw TypeScript (main: ./src/index.ts) with no build
  // step, so they MUST be inlined into the bundle — otherwise `node dist/index.js`
  // would try to import .ts at runtime. External npm deps stay external.
  noExternal: [/^@talasa\//],
  // Bundling those packages drags in transitive CJS deps (e.g. equasis → iconv-lite
  // → safer-buffer) that call require(). An ESM bundle has no require, so esbuild's
  // shim throws "Dynamic require of X is not supported". Inject a real require so it
  // delegates instead.
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
})
