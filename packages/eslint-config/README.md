# @talasa/eslint-config

Shared **flat-config** ESLint presets for the monorepo — `@eslint/js` +
`typescript-eslint` recommended plus the Turbo undeclared-env-var rule, with
`eslint-config-prettier` last so lint rules never fight Prettier.

> **Nothing consumes this today.** It is a leftover from the `create-next-app`
> Turborepo scaffold, untouched since the initial commit. The three linted apps
> each define their own `eslint.config.js`: `blog` (Astro), `landing`
> (Vite/TanStack), `platform` (`@tanstack/eslint-config`).

## Usage

```js
// eslint.config.js
import { baseConfig } from "@talasa/eslint-config/base";

export default baseConfig;
```

```jsonc
// package.json
"devDependencies": { "@talasa/eslint-config": "workspace:*" }
```

Spread it to extend:

```js
export default [...baseConfig, { rules: { "turbo/no-undeclared-env-vars": "off" } }];
```

## Exports

| Export | Named export | Use for |
|---|---|---|
| `@talasa/eslint-config/base` | `baseConfig` | non-Next packages — JS + TS recommended, Turbo, Prettier; ignores `dist/`, `.next/`, `node_modules/` |
| `@talasa/eslint-config/next` | `nextConfig` | Next.js apps — `eslint-config-next` core-web-vitals + typescript, Turbo, Prettier |

## Notes

- Both entries are **named exports, not defaults** — a default import yields `undefined`.
- `./next` pulls `eslint-config-next` (pinned `16.2.9`), but no Next.js app exists here, so it is dead weight unless one lands.
- eslint 9, typescript-eslint 8 and the plugins are plain `devDependencies` with no peer ranges — a consumer inherits whatever versions this package pins.
