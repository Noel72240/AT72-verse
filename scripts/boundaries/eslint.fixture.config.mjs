/**
 * ESLint config used only by `pnpm boundaries:prove`.
 * Applies the agents/skills allow-list to the isolated Q1 fixture.
 */
import tseslint from "typescript-eslint";
import { agentsSkillsRestrictedImports } from "@at72-verse/config-eslint/boundaries";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    files: ["scripts/boundaries/fixtures/as-agent/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "no-restricted-imports": agentsSkillsRestrictedImports,
    },
  },
];
