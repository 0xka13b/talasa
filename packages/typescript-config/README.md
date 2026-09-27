# @talasa/typescript-config

Shared `tsconfig` bases for the monorepo — ES2022, `strict`, and
`noUncheckedIndexedAccess`, so no workspace restates compiler options. Consumed
by 11 workspaces (`apps/api`, `apps/jobs`, and every `packages/*` client) via
`extends`.

## Usage

Add the dep, then extend the base by **file path** in the consumer's `tsconfig.json`:

```jsonc
// packages/gdelt/tsconfig.json
{
  "extends": "@talasa/typescript-config/base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src", "test"]
}
```

```jsonc
// package.json
"devDependencies": { "@talasa/typescript-config": "workspace:*" }
```

## Bases

| Base | Use for |
|---|---|
| `@talasa/typescript-config/base.json` | everything in the repo — ES2022, NodeNext, strict, declaration emit |
| `@talasa/typescript-config/nextjs.json` | Next.js apps — extends `base.json`, retargets ES2017 + DOM libs, `jsx: react-jsx`, `moduleResolution: bundler`, `noEmit` |

## Notes

- `extends` resolves the **literal file**, `.json` extension included — this package has no `exports` map, just a `files` allowlist. `.../base` won't resolve.
- `nextjs.json` has **no consumers**; there is no Next.js app in the repo (the frontends are Astro and TanStack/Vite, each with a standalone tsconfig).
- base.json's `module`/`moduleResolution: NodeNext` is overridden to `ESNext`/`Bundler` by every consumer except `@talasa/shared`, and its `declaration`/`declarationMap`/`incremental` flags never fire — packages are imported as TS source (`main: ./src/index.ts`) and checked with `tsc --noEmit`.
- `noUncheckedIndexedAccess` is on: `arr[0]` is `T | undefined`.
