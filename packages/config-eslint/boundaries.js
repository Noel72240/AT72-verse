/**
 * Shared architecture-boundary ESLint fragments (Phase 09).
 * Keep messages explicit — they name the violated invariant.
 */

/** P2 allow-list: only contracts + verse-kernel (+ relative in-package). */
export const agentsSkillsRestrictedImports = [
  "error",
  {
    patterns: [
      {
        regex: "^(?!\\.|@at72-verse/(?:contracts|verse-kernel)(?:/|$))",
        message:
          "Architecture boundary violated (Phase 09 / P2 allow-list): agents/** and skills/** may only import @at72-verse/contracts, @at72-verse/verse-kernel, or relative modules within the same package (deny by default). See docs/boundaries.md. New dependencies require an architecture decision.",
      },
    ],
  },
];

/** O3: API uses Core public façade only (package root). */
export const apiRestrictedImports = [
  "error",
  {
    paths: [
      {
        name: "openai",
        message:
          "Architecture boundary violated (Phase 13 / AS1 · AZ1): the openai SDK is confined to packages/verse-core adapters. See docs/boundaries.md.",
      },
    ],
    patterns: [
      {
        group: ["@at72-verse/verse-core/*"],
        message:
          "Architecture boundary violated (Phase 09 / O3 · ADR-001): apps/api must import @at72-verse/verse-core from the package root only (public façade). Deep imports into Core internals are forbidden. See docs/boundaries.md.",
      },
      {
        regex: "(?:^|/)(?:packages/)?verse-core/src(?:/|$)",
        message:
          "Architecture boundary violated (Phase 09 / O3 · ADR-001): apps/api must not reach packages/verse-core/src. Use the public package @at72-verse/verse-core. See docs/boundaries.md.",
      },
    ],
  },
];

/** Phase 13 / AR1: agent-runtime hosts Core façade only (same import surface as API). */
export const agentRuntimeRestrictedImports = apiRestrictedImports;

/** Catch-all: openai SDK forbidden outside verse-core. */
export const openaiSdkRestrictedImports = [
  "error",
  {
    paths: [
      {
        name: "openai",
        message:
          "Architecture boundary violated (Phase 13 / AS1 · AZ1): the openai SDK is confined to packages/verse-core adapters. See docs/boundaries.md.",
      },
    ],
  },
];

/** O3: Core never depends on agents. */
export const verseCoreRestrictedImports = [
  "error",
  {
    patterns: [
      {
        group: ["@at72-verse/agent-*", "@at72-verse/agent-*/**"],
        message:
          "Architecture boundary violated (Phase 09 / O3): packages/verse-core must never import an agent package. Core is the runtime host; agents are external Kernel consumers. See docs/boundaries.md.",
      },
      {
        regex: "(?:^|/)agents/",
        message:
          "Architecture boundary violated (Phase 09 / O3): packages/verse-core must never import from agents/**. See docs/boundaries.md.",
      },
    ],
  },
];
