/**
 * Deterministic Persona merge (Phase 17 / ADR-010).
 * Layers: system → agent → organization → workspace.
 */
import type {
  PersonaMergeLayer,
  PersonaProvenanceEntry,
  PersonaSpec,
  PersonaSpecPatch,
  ResolvedPersona,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import { FIRST_PARTY_PERSONAS, SYSTEM_PERSONA_BASE } from "./seeds.js";

export type PersonaOverridePort = {
  load(
    organizationId: string,
    workspaceId: string,
    agentId: string,
  ): Promise<{
    organization?: PersonaSpecPatch | null;
    workspace?: PersonaSpecPatch | null;
  }>;
};

function sortedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge objects with sorted key application for determinism. */
function mergeObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): { result: Record<string, unknown>; changed: string[] } {
  const result: Record<string, unknown> = { ...base };
  const changed: string[] = [];
  for (const key of sortedKeys(patch)) {
    const pv = patch[key];
    if (pv === undefined) continue;
    const bv = result[key];
    if (isPlainObject(bv) && isPlainObject(pv)) {
      const nested = mergeObjects(bv, pv);
      result[key] = nested.result;
      for (const c of nested.changed) {
        changed.push(`${key}.${c}`);
      }
    } else {
      result[key] = Array.isArray(pv) ? [...pv] : pv;
      changed.push(key);
    }
  }
  return { result, changed };
}

function applyPatch(
  spec: PersonaSpec,
  patch: PersonaSpecPatch | null | undefined,
  layer: PersonaMergeLayer,
  sourceId?: string,
): { spec: PersonaSpec; entry: PersonaProvenanceEntry | null } {
  if (!patch || Object.keys(patch).length === 0) {
    return { spec, entry: null };
  }
  const { result, changed } = mergeObjects(
    spec as unknown as Record<string, unknown>,
    patch as unknown as Record<string, unknown>,
  );
  if (changed.length === 0) {
    return { spec, entry: null };
  }
  const next = result as unknown as PersonaSpec;
  // Preserve identity fields from agent base
  next.id = spec.id;
  next.version = spec.version;
  next.agent_id = spec.agent_id;
  return {
    spec: next,
    entry: {
      layer,
      source_id: sourceId,
      contributed_fields: [...changed].sort(),
    },
  };
}

export function resolveAgentPersonaId(agentId: string): string {
  return `persona.${agentId}.default`;
}

/**
 * Pure merge — same inputs ⇒ same ResolvedPersona (JSON-stable).
 */
export function mergePersonaLayers(input: {
  agentId: string;
  agentPersona: PersonaSpec;
  organization?: PersonaSpecPatch | null;
  workspace?: PersonaSpecPatch | null;
}): ResolvedPersona {
  const layers: PersonaProvenanceEntry[] = [];

  let spec: PersonaSpec = {
    ...SYSTEM_PERSONA_BASE,
    id: input.agentPersona.id,
    version: input.agentPersona.version,
    agent_id: input.agentId,
  } as PersonaSpec;

  const sysChanged = sortedKeys(
    SYSTEM_PERSONA_BASE as unknown as Record<string, unknown>,
  ).filter((k) => k !== "id" && k !== "version" && k !== "agent_id");
  layers.push({
    layer: "system",
    source_id: "persona.system.base",
    contributed_fields: sysChanged,
  });

  const agentMerge = mergeObjects(
    spec as unknown as Record<string, unknown>,
    input.agentPersona as unknown as Record<string, unknown>,
  );
  spec = agentMerge.result as unknown as PersonaSpec;
  layers.push({
    layer: "agent",
    source_id: input.agentPersona.id,
    contributed_fields: [...agentMerge.changed].sort(),
  });

  const orgApplied = applyPatch(spec, input.organization, "organization", "org-override");
  spec = orgApplied.spec;
  if (orgApplied.entry) layers.push(orgApplied.entry);

  const wsApplied = applyPatch(spec, input.workspace, "workspace", "workspace-override");
  spec = wsApplied.spec;
  if (wsApplied.entry) layers.push(wsApplied.entry);

  // Freeze nested objects shallowly via structuredClone + freeze
  const frozen = Object.freeze({
    agent_id: input.agentId,
    persona_id: input.agentPersona.id,
    version: input.agentPersona.version,
    spec: Object.freeze(structuredClone(spec)),
    provenance: Object.freeze({
      layers: Object.freeze(layers.map((l) => Object.freeze({ ...l, contributed_fields: Object.freeze([...l.contributed_fields]) }))),
    }),
  }) as ResolvedPersona;

  return frozen;
}

export class PersonaEngine {
  constructor(
    private readonly seeds: ReadonlyMap<string, PersonaSpec> = FIRST_PARTY_PERSONAS,
    private readonly overrides?: PersonaOverridePort,
  ) {}

  getSeed(agentId: string): PersonaSpec | undefined {
    return this.seeds.get(resolveAgentPersonaId(agentId)) ?? this.seeds.get(agentId);
  }

  async resolve(
    agentId: string,
    organizationId: string,
    workspaceId: string,
  ): Promise<ResolvedPersona> {
    const agentPersona = this.getSeed(agentId);
    if (!agentPersona) {
      throw new KernelError("NOT_FOUND", `No first-party persona for agent: ${agentId}`, {
        details: { agent_id: agentId, expected: resolveAgentPersonaId(agentId) },
      });
    }

    let organization: PersonaSpecPatch | null | undefined;
    let workspace: PersonaSpecPatch | null | undefined;
    if (this.overrides) {
      const loaded = await this.overrides.load(organizationId, workspaceId, agentId);
      organization = loaded.organization;
      workspace = loaded.workspace;
    }

    return mergePersonaLayers({
      agentId,
      agentPersona,
      organization,
      workspace,
    });
  }
}
