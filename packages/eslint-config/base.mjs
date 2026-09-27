import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turbo from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";

/**
 * Shared flat ESLint config for non-Next packages in the monorepo.
 * Next.js apps should use the `./next` entry instead.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: { turbo },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  {
    ignores: ["dist/**", ".next/**", "node_modules/**"],
  },
];
