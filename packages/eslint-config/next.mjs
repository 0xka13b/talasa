import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import turbo from "eslint-plugin-turbo";

/**
 * Shared flat ESLint config for Next.js apps in the monorepo.
 * Composes eslint-config-next (core-web-vitals + typescript) with the
 * Turbo env-var rule and Prettier compatibility.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const nextConfig = [
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  {
    plugins: { turbo },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
];
