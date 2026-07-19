import js from "@eslint/js";
import tseslint from "typescript-eslint";
import {
  agentsSkillsRestrictedImports,
  agentRuntimeRestrictedImports,
  apiRestrictedImports,
  openaiSdkRestrictedImports,
  verseCoreRestrictedImports,
} from "./boundaries.js";

/** @type {import("eslint").Linter.Config[]} */
export const config = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      // Q1: intentional violations — linted only by boundaries:prove
      "scripts/boundaries/fixtures/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // NestJS DI needs runtime class imports (emitDecoratorMetadata).
    files: ["apps/api/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "no-restricted-imports": apiRestrictedImports,
    },
  },
  {
    // Phase 13 / AR1 — Runtime hosts Core façade only.
    files: ["apps/agent-runtime/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": agentRuntimeRestrictedImports,
    },
  },
  {
    files: ["agents/**/*.{ts,tsx}", "skills/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": agentsSkillsRestrictedImports,
    },
  },
  {
    // Tests may use node:test / node:assert; production allow-list stays P2.
    files: ["agents/**/*.test.ts", "skills/**/*.test.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["packages/verse-core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": verseCoreRestrictedImports,
    },
  },
  {
    // AZ1 — openai forbidden outside verse-core (agents/skills already deny-by-default).
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "tools/**/*.{ts,tsx}"],
    ignores: ["packages/verse-core/**", "apps/api/**", "apps/agent-runtime/**"],
    rules: {
      "no-restricted-imports": openaiSdkRestrictedImports,
    },
  },
);

export default config;
