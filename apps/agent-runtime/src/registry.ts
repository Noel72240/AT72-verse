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
import { handleTask as echoHandleTask, ECHO_AGENT_ID } from "@at72-verse/agent-echo";
import { handleTask as kiraHandleTask, KIRA_AGENT_ID } from "@at72-verse/agent-kira";
import { handleTask as neoHandleTask, NEO_AGENT_ID } from "@at72-verse/agent-neo";
import { handleTask as nexusHandleTask, NEXUS_AGENT_ID } from "@at72-verse/agent-nexus";
import { handleTask as novaHandleTask, NOVA_AGENT_ID } from "@at72-verse/agent-nova";
import { handleTask as nyxHandleTask, NYX_AGENT_ID } from "@at72-verse/agent-nyx";
import { handleTask as orionHandleTask, ORION_AGENT_ID } from "@at72-verse/agent-orion";
import { handleTask as pixelHandleTask, PIXEL_AGENT_ID } from "@at72-verse/agent-pixel";
import { handleTask as pulseHandleTask, PULSE_AGENT_ID } from "@at72-verse/agent-pulse";
import { handleTask as vegaHandleTask, VEGA_AGENT_ID } from "@at72-verse/agent-vega";
import {
  ANALYSIS_SKILL_SPEC,
  execute as analysisExecute,
  SKILL_ID as ANALYSIS_SKILL_ID,
} from "@at72-verse/skill-analysis";
import {
  AUTOMATION_PLAN_SKILL_SPEC,
  execute as automationPlanExecute,
  SKILL_ID as AUTOMATION_PLAN_SKILL_ID,
} from "@at72-verse/skill-automation-plan";
import {
  CRM_ASSIST_SKILL_SPEC,
  execute as crmAssistExecute,
  SKILL_ID as CRM_ASSIST_SKILL_ID,
} from "@at72-verse/skill-crm-assist";
import {
  execute as imageGenSkillExecute,
  IMAGE_GENERATION_SKILL_SPEC,
  SKILL_ID as IMAGE_GEN_SKILL_ID,
} from "@at72-verse/skill-image-generation";
import {
  execute as localPresenceExecute,
  LOCAL_PRESENCE_SKILL_SPEC,
  SKILL_ID as LOCAL_PRESENCE_SKILL_ID,
} from "@at72-verse/skill-local-presence";
import {
  execute as seoExecute,
  SEO_SKILL_SPEC,
  SKILL_ID as SEO_SKILL_ID,
} from "@at72-verse/skill-seo";
import {
  execute as socialSchedulingExecute,
  SKILL_ID as SOCIAL_SCHEDULING_SKILL_ID,
  SOCIAL_SCHEDULING_SKILL_SPEC,
} from "@at72-verse/skill-social-scheduling";
import {
  execute as supportTriageExecute,
  SKILL_ID as SUPPORT_TRIAGE_SKILL_ID,
  SUPPORT_TRIAGE_SKILL_SPEC,
} from "@at72-verse/skill-support-triage";
import {
  execute as videoBriefExecute,
  SKILL_ID as VIDEO_BRIEF_SKILL_ID,
  VIDEO_BRIEF_SKILL_SPEC,
} from "@at72-verse/skill-video-brief";
import {
  execute as watchBriefExecute,
  SKILL_ID as WATCH_BRIEF_SKILL_ID,
  WATCH_BRIEF_SKILL_SPEC,
} from "@at72-verse/skill-watch-brief";
import {
  execute as writingExecute,
  SKILL_ID as WRITING_SKILL_ID,
  WRITING_SKILL_SPEC,
} from "@at72-verse/skill-writing";
import {
  CRM_SYNC_TOOL_SPEC,
  execute as crmSyncExecute,
  TOOL_ID as CRM_SYNC_TOOL_ID,
} from "@at72-verse/tool-crm-sync";
import {
  execute as fileRwExecute,
  TOOL_ID as FILE_RW_TOOL_ID,
  FILE_READ_WRITE_TOOL_SPEC,
} from "@at72-verse/tool-file-read-write";
import {
  execute as gmbSyncExecute,
  GMB_SYNC_TOOL_SPEC,
  TOOL_ID as GMB_SYNC_TOOL_ID,
} from "@at72-verse/tool-gmb-sync";
import {
  execute as httpRequestExecute,
  HTTP_REQUEST_TOOL_SPEC,
  TOOL_ID as HTTP_REQUEST_TOOL_ID,
} from "@at72-verse/tool-http-request";
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
  execute as socialPublishExecute,
  SOCIAL_PUBLISH_TOOL_SPEC,
  TOOL_ID as SOCIAL_PUBLISH_TOOL_ID,
} from "@at72-verse/tool-social-publish";
import {
  execute as videoPipelineExecute,
  TOOL_ID as VIDEO_PIPELINE_TOOL_ID,
  VIDEO_PIPELINE_TOOL_SPEC,
} from "@at72-verse/tool-video-pipeline";
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
    [
      PULSE_AGENT_ID,
      {
        id: PULSE_AGENT_ID,
        tools_allowlist: ["social-publish"],
        can_consult: ["nova", "astra"],
        handleTask: pulseHandleTask,
      },
    ],
    [
      ECHO_AGENT_ID,
      {
        id: ECHO_AGENT_ID,
        tools_allowlist: ["gmb-sync"],
        can_consult: ["astra"],
        handleTask: echoHandleTask,
      },
    ],
    [
      NEXUS_AGENT_ID,
      {
        id: NEXUS_AGENT_ID,
        tools_allowlist: ["http-request"],
        can_consult: [],
        handleTask: nexusHandleTask,
      },
    ],
    [
      VEGA_AGENT_ID,
      {
        id: VEGA_AGENT_ID,
        tools_allowlist: ["web-search"],
        can_consult: ["orion"],
        handleTask: vegaHandleTask,
      },
    ],
    [
      NEO_AGENT_ID,
      {
        id: NEO_AGENT_ID,
        tools_allowlist: ["crm-sync"],
        can_consult: ["nova"],
        handleTask: neoHandleTask,
      },
    ],
    [
      KIRA_AGENT_ID,
      {
        id: KIRA_AGENT_ID,
        tools_allowlist: [],
        can_consult: ["neo"],
        handleTask: kiraHandleTask,
      },
    ],
    [
      NYX_AGENT_ID,
      {
        id: NYX_AGENT_ID,
        tools_allowlist: ["video-pipeline"],
        can_consult: ["nova", "pixel"],
        handleTask: nyxHandleTask,
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
    [
      SOCIAL_SCHEDULING_SKILL_ID,
      {
        id: SOCIAL_SCHEDULING_SKILL_ID,
        version: SOCIAL_SCHEDULING_SKILL_SPEC.version,
        spec: SOCIAL_SCHEDULING_SKILL_SPEC,
        execute: socialSchedulingExecute,
      },
    ],
    [
      LOCAL_PRESENCE_SKILL_ID,
      {
        id: LOCAL_PRESENCE_SKILL_ID,
        version: LOCAL_PRESENCE_SKILL_SPEC.version,
        spec: LOCAL_PRESENCE_SKILL_SPEC,
        execute: localPresenceExecute,
      },
    ],
    [
      AUTOMATION_PLAN_SKILL_ID,
      {
        id: AUTOMATION_PLAN_SKILL_ID,
        version: AUTOMATION_PLAN_SKILL_SPEC.version,
        spec: AUTOMATION_PLAN_SKILL_SPEC,
        execute: automationPlanExecute,
      },
    ],
    [
      WATCH_BRIEF_SKILL_ID,
      {
        id: WATCH_BRIEF_SKILL_ID,
        version: WATCH_BRIEF_SKILL_SPEC.version,
        spec: WATCH_BRIEF_SKILL_SPEC,
        execute: watchBriefExecute,
      },
    ],
    [
      CRM_ASSIST_SKILL_ID,
      {
        id: CRM_ASSIST_SKILL_ID,
        version: CRM_ASSIST_SKILL_SPEC.version,
        spec: CRM_ASSIST_SKILL_SPEC,
        execute: crmAssistExecute,
      },
    ],
    [
      SUPPORT_TRIAGE_SKILL_ID,
      {
        id: SUPPORT_TRIAGE_SKILL_ID,
        version: SUPPORT_TRIAGE_SKILL_SPEC.version,
        spec: SUPPORT_TRIAGE_SKILL_SPEC,
        execute: supportTriageExecute,
      },
    ],
    [
      VIDEO_BRIEF_SKILL_ID,
      {
        id: VIDEO_BRIEF_SKILL_ID,
        version: VIDEO_BRIEF_SKILL_SPEC.version,
        spec: VIDEO_BRIEF_SKILL_SPEC,
        execute: videoBriefExecute,
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
    [
      SOCIAL_PUBLISH_TOOL_ID,
      {
        id: SOCIAL_PUBLISH_TOOL_ID,
        version: SOCIAL_PUBLISH_TOOL_SPEC.version,
        spec: SOCIAL_PUBLISH_TOOL_SPEC,
        execute: socialPublishExecute,
      },
    ],
    [
      GMB_SYNC_TOOL_ID,
      {
        id: GMB_SYNC_TOOL_ID,
        version: GMB_SYNC_TOOL_SPEC.version,
        spec: GMB_SYNC_TOOL_SPEC,
        execute: gmbSyncExecute,
      },
    ],
    [
      HTTP_REQUEST_TOOL_ID,
      {
        id: HTTP_REQUEST_TOOL_ID,
        version: HTTP_REQUEST_TOOL_SPEC.version,
        spec: HTTP_REQUEST_TOOL_SPEC,
        execute: httpRequestExecute,
      },
    ],
    [
      CRM_SYNC_TOOL_ID,
      {
        id: CRM_SYNC_TOOL_ID,
        version: CRM_SYNC_TOOL_SPEC.version,
        spec: CRM_SYNC_TOOL_SPEC,
        execute: crmSyncExecute,
      },
    ],
    [
      VIDEO_PIPELINE_TOOL_ID,
      {
        id: VIDEO_PIPELINE_TOOL_ID,
        version: VIDEO_PIPELINE_TOOL_SPEC.version,
        spec: VIDEO_PIPELINE_TOOL_SPEC,
        execute: videoPipelineExecute,
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
