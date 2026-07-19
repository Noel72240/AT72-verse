import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import type { BusMessage } from "@at72-verse/contracts";
import {
  ADAM_CAMPAIGN_TARGETS,
  buildAdamPlan,
  extractPublishDraft,
  handleTask,
  isLivePublishIntent,
  isPublishIntent,
  parseAdamLlmPlan,
} from "./index.js";

function messageWithGoal(goal: string): BusMessage {
  return {
    event_id: "e1",
    correlation_id: "55555555-5555-4555-8555-555555555555",
    causation_id: "e0",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    workspace_id: "33333333-3333-4333-8333-333333333333",
    run_id: "11111111-1111-4111-8111-111111111111",
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "agent.task",
    payload: {
      run_id: "11111111-1111-4111-8111-111111111111",
      step_id: "44444444-4444-4444-8444-444444444444",
      trace_id: "55555555-5555-4555-8555-555555555555",
      goal,
    },
  };
}

describe("agent-adam Phase 15/24", () => {
  it("parseAdamLlmPlan reads JSON mode single + delegate_to", () => {
    const plan = parseAdamLlmPlan(
      '{"mode":"single","delegate_to":"nova","brief":"Write a LinkedIn post","summary":"ok"}',
      "ignored",
    );
    assert.equal(plan.mode, "single");
    assert.equal(plan.delegate_to, "nova");
    assert.equal(plan.brief, "Write a LinkedIn post");
  });

  it("parseAdamLlmPlan falls back to writing heuristic", () => {
    const plan = parseAdamLlmPlan("not-json", "Rédige un post LinkedIn sur Verse");
    assert.equal(plan.mode, "single");
    assert.equal(plan.delegate_to, "nova");
  });

  it("parseAdamLlmPlan reads JSON campaign targets", () => {
    const plan = parseAdamLlmPlan(
      '{"mode":"campaign","targets":["nova","astra","pixel"],"brief":"Launch","summary":"fan-out"}',
      "ignored",
    );
    assert.equal(plan.mode, "campaign");
    assert.deepEqual(plan.targets, ["nova", "astra", "pixel"]);
  });

  it("parseAdamLlmPlan falls back to campaign heuristic", () => {
    const plan = parseAdamLlmPlan("not-json", "Lance une campagne article + SEO + visuel");
    assert.equal(plan.mode, "campaign");
    assert.deepEqual(plan.targets, [...ADAM_CAMPAIGN_TARGETS]);
  });

  it("parseAdamLlmPlan falls back to SEO heuristic", () => {
    const plan = parseAdamLlmPlan("not-json", "Fais un audit SEO de la homepage");
    assert.equal(plan.mode, "single");
    assert.equal(plan.delegate_to, "astra");
  });

  it("buildAdamPlan includes delegate_orion when planning to Orion", () => {
    const plan = buildAdamPlan({ mode: "single", delegate_to: "orion", brief: "x" });
    assert.ok(plan.steps.some((s) => s.name === "delegate_orion"));
  });

  it("buildAdamPlan includes campaign fan-out steps in target order", () => {
    const plan = buildAdamPlan({
      mode: "campaign",
      delegate_to: "none",
      targets: ["nova", "astra", "pixel"],
      brief: "x",
    });
    const names = plan.steps.map((s) => s.name);
    assert.ok(names.includes("delegate_nova"));
    assert.ok(names.includes("delegate_astra"));
    assert.ok(names.includes("delegate_pixel"));
    assert.ok(names.indexOf("delegate_nova") < names.indexOf("delegate_astra"));
    assert.ok(names.indexOf("delegate_astra") < names.indexOf("delegate_pixel"));
    assert.ok(plan.steps.some((s) => s.name === "aggregate_result"));
  });

  it("handleTask delegates analysis goals to Orion (stub Kernel)", async () => {
    const kernel = createKernelClient({
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "adam",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        step_id: "44444444-4444-4444-8444-444444444444",
      },
      backend: "stub",
    });

    const out = await handleTask({
      kernel,
      message: messageWithGoal("Analyse les métriques de vente du trimestre"),
    });
    assert.ok(out.plan.steps.some((s) => s.name === "delegate_orion"));
    assert.equal(out.result?.stub, true);
    assert.equal(out.result?.target_agent, "orion");
    assert.ok(out.resolved_persona);
    assert.equal(out.resolved_persona?.agent_id, "adam");
  });

  it("handleTask campaign uses delegateMany and aggregates by target order", async () => {
    const kernel = createKernelClient({
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "adam",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        step_id: "44444444-4444-4444-8444-444444444444",
      },
      backend: "stub",
    });

    const out = await handleTask({
      kernel,
      message: messageWithGoal("Campagne article + SEO + image pour le lancement"),
    });
    assert.equal(out.plan.steps.filter((s) => s.kind === "delegate").length, 3);
    assert.ok(out.result?.content);
    assert.equal((out.result?.nova as { target_agent?: string })?.target_agent, "nova");
    assert.equal((out.result?.astra as { target_agent?: string })?.target_agent, "astra");
    assert.equal((out.result?.pixel as { target_agent?: string })?.target_agent, "pixel");
  });

  it("handleTask replies directly for greetings (no campaign)", async () => {
    const kernel = createKernelClient({
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "adam",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        step_id: "44444444-4444-4444-8444-444444444444",
      },
      backend: "stub",
    });

    const out = await handleTask({
      kernel,
      message: messageWithGoal("salut"),
    });
    assert.ok(out.plan.steps.some((s) => s.name === "direct_reply"));
    assert.ok(!out.plan.steps.some((s) => s.kind === "delegate"));
    assert.equal(typeof out.result?.content, "string");
    assert.ok(String(out.result?.content).length > 0);
  });

  it("handleTask writes simple social posts directly (no Nova hop)", async () => {
    const kernel = createKernelClient({
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "adam",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        step_id: "44444444-4444-4444-8444-444444444444",
      },
      backend: "stub",
    });

    const out = await handleTask({
      kernel,
      message: messageWithGoal("Prépare un post facebook pour Allotech72"),
    });
    assert.ok(out.plan.steps.some((s) => s.name === "direct_write"));
    assert.ok(!out.plan.steps.some((s) => s.kind === "delegate"));
    assert.equal(typeof out.result?.content, "string");
  });

  it("extractPublishDraft reads ---DRAFT--- marker", () => {
    const draft = extractPublishDraft("publie\n\n---DRAFT---\nHello LinkedIn world from Verse");
    assert.equal(draft, "Hello LinkedIn world from Verse");
  });

  it("isPublishIntent detects French publish verbs", () => {
    assert.equal(isPublishIntent("publie"), true);
    assert.equal(isPublishIntent("publie en live"), true);
    assert.equal(isLivePublishIntent("publie"), false);
    assert.equal(isLivePublishIntent("publie en live"), true);
  });

  it("handleTask publish without draft asks for a post first", async () => {
    const kernel = createKernelClient({
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "adam",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        step_id: "44444444-4444-4444-8444-444444444444",
      },
      backend: "stub",
    });

    const out = await handleTask({
      kernel,
      message: messageWithGoal("publie"),
    });
    assert.ok(out.plan.steps.some((s) => s.name === "publish_need_draft"));
    assert.match(String(out.result?.content), /brouillon/i);
  });

  it("handleTask publish with draft delegates to Pulse", async () => {
    const kernel = createKernelClient({
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "adam",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        step_id: "44444444-4444-4444-8444-444444444444",
      },
      backend: "stub",
    });

    const out = await handleTask({
      kernel,
      message: messageWithGoal(
        "publie\n\n---DRAFT---\nVoici un post LinkedIn assez long pour Allotech72 #IA",
      ),
    });
    assert.ok(out.plan.steps.some((s) => s.name === "delegate_pulse"));
    assert.equal(out.result?.target_agent, "pulse");
  });
});
