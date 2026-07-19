/**
 * Dependency-cruiser — architecture graph guards (Phase 09 / N3).
 * Complements ESLint import rules. See docs/boundaries.md.
 * @type {import("dependency-cruiser").IConfiguration}
 */
export default {
  forbidden: [
    {
      name: "agents-skills-only-contracts-and-kernel-workspace",
      severity: "error",
      comment:
        "Architecture (Phase 09 / P2 · O3): agents/** and skills/** may only depend on workspace packages contracts and verse-kernel (deny by default).",
      from: { path: "^(agents|skills)/" },
      to: {
        path: "^packages/",
        pathNot: "^packages/(contracts|verse-kernel)/",
      },
    },
    {
      name: "agents-skills-no-apps",
      severity: "error",
      comment: "Architecture (Phase 09 / O3): agents/** and skills/** must not depend on apps/**.",
      from: { path: "^(agents|skills)/" },
      to: { path: "^apps/" },
    },
    {
      name: "agents-skills-npm-allowlist",
      severity: "error",
      comment:
        "Architecture (Phase 09 / P2): agents/** and skills/** npm deps are deny-by-default; only @at72-verse/contracts and @at72-verse/verse-kernel are allowed. Exceptions need an architecture decision.",
      from: { path: "^(agents|skills)/" },
      to: {
        path: "^node_modules/",
        pathNot: "^node_modules/@at72-verse/(contracts|verse-kernel)(/|$)",
      },
    },
    {
      name: "verse-core-no-agents",
      severity: "error",
      comment: "Architecture (Phase 09 / O3): packages/verse-core must never depend on agents/**.",
      from: { path: "^packages/verse-core/" },
      to: { path: "^agents/" },
    },
    {
      name: "api-no-verse-core-internals",
      severity: "error",
      comment:
        "Architecture (Phase 09 / O3 · ADR-001): apps/api must not import packages/verse-core internals (only the public entry via @at72-verse/verse-core).",
      from: { path: "^apps/api/" },
      to: {
        path: "^packages/verse-core/src/",
        pathNot: "^packages/verse-core/src/index\\.ts$",
      },
    },
    {
      name: "agent-runtime-no-db",
      severity: "error",
      comment:
        "Architecture (Phase 12 / AI3): agent-runtime must never depend on packages/db (no Prisma).",
      from: { path: "^apps/agent-runtime/" },
      to: { path: "^packages/db/" },
    },
    {
      name: "agent-runtime-no-verse-core-internals",
      severity: "error",
      comment:
        "Architecture (Phase 13 / AR1): agent-runtime may depend on @at72-verse/verse-core façade only (not packages/verse-core/src internals).",
      from: { path: "^apps/agent-runtime/" },
      to: {
        path: "^packages/verse-core/src/",
        pathNot: "^packages/verse-core/src/index\\.ts$",
      },
    },
    {
      name: "openai-sdk-only-in-verse-core",
      severity: "error",
      comment:
        "Architecture (Phase 13 / AS1 · AZ1): the openai SDK may only be imported from packages/verse-core.",
      from: { pathNot: "^packages/verse-core/" },
      to: { path: "node_modules/openai" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
