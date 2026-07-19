/**
 * Logical Core modules (ARCHITECTURE §5.4). Orchestrated by the façade — not agent logic.
 */
export type CoreModuleId =
  | "orchestration"
  | "routing"
  | "events"
  | "llm"
  | "profiles"
  | "memory"
  | "permissions"
  | "security"
  | "cost"
  | "persona"
  | "skills"
  | "tools"
  | "workflows"
  | "registry"
  | "adapters";

export type CoreModuleManifestEntry = {
  id: CoreModuleId;
  status: "registered" | "planned";
  description: string;
};

export const CORE_MODULE_MANIFEST: readonly CoreModuleManifestEntry[] = [
  {
    id: "orchestration",
    status: "registered",
    description: "Run planner / step scheduler (skeleton)",
  },
  {
    id: "routing",
    status: "registered",
    description: "Intent → agents/skills routing (skeleton)",
  },
  {
    id: "events",
    status: "registered",
    description: "Event emit policies (skeleton)",
  },
  {
    id: "llm",
    status: "registered",
    description: "Provider manager + model router (noop adapter)",
  },
  {
    id: "profiles",
    status: "registered",
    description: "AI model profiles (skeleton)",
  },
  {
    id: "memory",
    status: "registered",
    description: "Memory Gateway L1/L2 (Phase 18)",
  },
  {
    id: "permissions",
    status: "registered",
    description: "Permission / Policy Engine (Phase 20)",
  },
  {
    id: "security",
    status: "registered",
    description: "Security policies (skeleton)",
  },
  {
    id: "cost",
    status: "registered",
    description: "Cost Engine — run budget + Rate Card (Phase 21)",
  },
  {
    id: "persona",
    status: "registered",
    description: "Persona engine (Phase 17)",
  },
  {
    id: "skills",
    status: "registered",
    description: "Skill engine (skeleton)",
  },
  {
    id: "tools",
    status: "registered",
    description: "Tool runtime (Phase 19)",
  },
  {
    id: "workflows",
    status: "registered",
    description: "Workflow engine — declarative DAGs via Kernel orchestration (Phase 26)",
  },
  {
    id: "registry",
    status: "registered",
    description: "Package Registry metadata (Phase 22)",
  },
  {
    id: "adapters",
    status: "registered",
    description: "Infra adapters (noop in Phase 08)",
  },
] as const;
