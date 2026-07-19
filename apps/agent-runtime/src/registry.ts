/**
 * Extensible agent + skill + tool registries (Phase 12 / 14 / 19 / 23).
 * Runtime hosts all — Core never imports agents, skills, or tools.
 * Adding a specialist = register here (+ package/persona/skill); OrchestrationHost stays generic (DQ).
 */
import type {
  AgentPlan,
  BusMessage,
  KernelClient,
  ResolvedPersona,
  SkillPlugin,
  ToolPlugin,
} from "@at72-verse/contracts";
import { handleTask as adamHandleTask, ADAM_AGENT_ID } from "@at72-verse/agent-adam";
import { handleTask as astraHandleTask, ASTRA_AGENT_ID } from "@at72-verse/agent-astra";
import { handleTask as novaHandleTask, NOVA_AGENT_ID } from "@at72-verse/agent-nova";
import { handleTask as orionHandleTask, ORION_AGENT_ID } from "@at72-verse/agent-orion";
import { handleTask as pixelHandleTask, PIXEL_AGENT_ID } from "@at72-verse/agent-pixel";
import {
  ANALYSIS_SKILL_SPEC,
  execute as analysisExecute,
  SKILL_ID as ANALYSIS_SKILL_ID,
} from "@at72-verse/skill-analysis";
import {
  execute as imageGenSkillExecute,
  IMAGE_GENERATION_SKILL_SPEC,
  SKILL_ID as IMAGE_GEN_SKILL_ID,
} from "@at72-verse/skill-image-generation";
import {
  execute as seoExecute,
  SEO_SKILL_SPEC,
  SKILL_ID as SEO_SKILL_ID,
} from "@at72-verse/skill-seo";
import {
  execute as writingExecute,
  SKILL_ID as WRITING_SKILL_ID,
  WRITING_SKILL_SPEC,
} from "@at72-verse/skill-writing";
import {
  execute as fileRwExecute,
  TOOL_ID as FILE_RW_TOOL_ID,
  FILE_READ_WRITE_TOOL_SPEC,
} from "@at72-verse/tool-file-read-write";
import {
  execute as imageGenToolExecute,
  IMAGE_GENERATE_TOOL_SPEC,
  TOOL_ID as IMAGE_GENERATE_TOOL_ID,
} from "@at72-verse/tool-image-generate";
import {
  execute as seoAuditExecute,
  SEO_AUDIT_TOOL_SPEC,
  TOOL_ID as SEO_AUDIT_TOOL_ID,
} from "@at72-verse/tool-seo-audit";
import {
  execute as webSearchExecute,
  TOOL_ID as WEB_SEARCH_TOOL_ID,
  WEB_SEARCH_TOOL_SPEC,
} from "@at72-verse/tool-web-search";
import type { SkillHostPort, ToolHostPort } from "@at72-verse/verse-core";
import { KernelError } from "@at72-verse/verse-kernel";

export type AgentTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export type AgentPlugin = {
  id: string;
  /** From AgentManifest.tools_allowlist — stamped onto KernelContext (DM5). */
  tools_allowlist: string[];
  /** From AgentManifest.can_consult — Ask/Consult allow-list (Phase 24 / DR6). */
  can_consult?: string[];
  handleTask: (ctx: {
    kernel: KernelClient;
    message: BusMessage;
  }) => Promise<AgentPlan | AgentTaskResult>;
};

export type AgentRegistry = ReadonlyMap<string, AgentPlugin>;
export type SkillRegistry = ReadonlyMap<string, SkillPlugin>;
export type ToolRegistry = ReadonlyMap<string, ToolPlugin>;

export function normalizeAgentTaskResult(out: AgentPlan | AgentTaskResult): AgentTaskResult {
  if (
    out &&
    typeof out === "object" &&
    "plan" in out &&
    out.plan &&
    typeof out.plan === "object" &&
    Array.isArray(out.plan.steps)
  ) {
    return out;
  }
  return { plan: out as AgentPlan };
}

export function createDefaultAgentRegistry(): AgentRegistry {
  return new Map<string, AgentPlugin>([
    [
      ADAM_AGENT_ID,
      {
        id: ADAM_AGENT_ID,
        tools_allowlist: [],
        handleTask: adamHandleTask,
      },
    ],
    [
      NOVA_AGENT_ID,
      {
        id: NOVA_AGENT_ID,
        tools_allowlist: ["web-search", "file-read-write"],
        can_consult: ["astra"],
        handleTask: novaHandleTask,
      },
    ],
    [
      ORION_AGENT_ID,
      {
        id: ORION_AGENT_ID,
        tools_allowlist: ["web-search"],
        can_consult: [],
        handleTask: orionHandleTask,
      },
    ],
    [
      ASTRA_AGENT_ID,
      {
        id: ASTRA_AGENT_ID,
        tools_allowlist: ["seo-audit", "web-search"],
        can_consult: [],
        handleTask: astraHandleTask,
      },
    ],
    [
      PIXEL_AGENT_ID,
      {
        id: PIXEL_AGENT_ID,
        tools_allowlist: ["image-generate"],
        can_consult: [],
        handleTask: pixelHandleTask,
      },
    ],
  ]);
}

export function createDefaultSkillRegistry(): SkillRegistry {
  return new Map<string, SkillPlugin>([
    [
      WRITING_SKILL_ID,
      {
        id: WRITING_SKILL_ID,
        version: WRITING_SKILL_SPEC.version,
        spec: WRITING_SKILL_SPEC,
        execute: writingExecute,
      },
    ],
    [
      ANALYSIS_SKILL_ID,
      {
        id: ANALYSIS_SKILL_ID,
        version: ANALYSIS_SKILL_SPEC.version,
        spec: ANALYSIS_SKILL_SPEC,
        execute: analysisExecute,
      },
    ],
    [
      SEO_SKILL_ID,
      {
        id: SEO_SKILL_ID,
        version: SEO_SKILL_SPEC.version,
        spec: SEO_SKILL_SPEC,
        execute: seoExecute,
      },
    ],
    [
      IMAGE_GEN_SKILL_ID,
      {
        id: IMAGE_GEN_SKILL_ID,
        version: IMAGE_GENERATION_SKILL_SPEC.version,
        spec: IMAGE_GENERATION_SKILL_SPEC,
        execute: imageGenSkillExecute,
      },
    ],
  ]);
}

export function createDefaultToolRegistry(): ToolRegistry {
  return new Map<string, ToolPlugin>([
    [
      WEB_SEARCH_TOOL_ID,
      {
        id: WEB_SEARCH_TOOL_ID,
        version: WEB_SEARCH_TOOL_SPEC.version,
        spec: WEB_SEARCH_TOOL_SPEC,
        execute: webSearchExecute,
      },
    ],
    [
      FILE_RW_TOOL_ID,
      {
        id: FILE_RW_TOOL_ID,
        version: FILE_READ_WRITE_TOOL_SPEC.version,
        spec: FILE_READ_WRITE_TOOL_SPEC,
        execute: fileRwExecute,
      },
    ],
    [
      SEO_AUDIT_TOOL_ID,
      {
        id: SEO_AUDIT_TOOL_ID,
        version: SEO_AUDIT_TOOL_SPEC.version,
        spec: SEO_AUDIT_TOOL_SPEC,
        execute: seoAuditExecute,
      },
    ],
    [
      IMAGE_GENERATE_TOOL_ID,
      {
        id: IMAGE_GENERATE_TOOL_ID,
        version: IMAGE_GENERATE_TOOL_SPEC.version,
        spec: IMAGE_GENERATE_TOOL_SPEC,
        execute: imageGenToolExecute,
      },
    ],
  ]);
}

/** Bridge Runtime skill registry → Core Kernel.skills.* (BB1). */
export function createSkillHost(registry: SkillRegistry): SkillHostPort {
  return {
    async invoke(skillId, input, kernel) {
      const plugin = registry.get(skillId);
      if (!plugin) {
        throw new KernelError("NOT_FOUND", `Skill not registered: ${skillId}`, {
          details: { skill_id: skillId },
        });
      }
      const output = await plugin.execute({ kernel, input });
      return { output };
    },
    async resolve(skillId) {
      const plugin = registry.get(skillId);
      if (!plugin) {
        throw new KernelError("NOT_FOUND", `Skill not registered: ${skillId}`, {
          details: { skill_id: skillId },
        });
      }
      return { id: plugin.id, version: plugin.version };
    },
  };
}

/** Bridge Runtime tool registry → Core ToolHostPort (DM3). */
export function createToolHost(registry: ToolRegistry): ToolHostPort {
  return {
    async resolve(toolId) {
      const plugin = registry.get(toolId);
      if (!plugin) {
        throw new KernelError("NOT_FOUND", `Tool not registered: ${toolId}`, {
          details: { tool_id: toolId },
        });
      }
      return { id: plugin.id, version: plugin.version, spec: plugin.spec };
    },
    async execute(toolId, ctx) {
      const plugin = registry.get(toolId);
      if (!plugin) {
        throw new KernelError("NOT_FOUND", `Tool not registered: ${toolId}`, {
          details: { tool_id: toolId },
        });
      }
      return plugin.execute(ctx);
    },
    async listRegistered() {
      return [...registry.keys()].sort();
    },
  };
}
