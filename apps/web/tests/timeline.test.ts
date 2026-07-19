import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTimelineForest, deriveActiveAgent } from "../src/lib/timeline";
import type { ApiRunStep } from "../src/lib/api";

const steps: ApiRunStep[] = [
  {
    id: "a",
    run_id: "r",
    parent_step_id: null,
    seq: 1,
    name: "adam.orchestrate",
    kind: "agent",
    agent_id: "adam",
    status: "completed",
    output: null,
  },
  {
    id: "n",
    run_id: "r",
    parent_step_id: "a",
    seq: 2,
    name: "nova.delegated",
    kind: "agent",
    agent_id: "nova",
    status: "running",
    output: null,
  },
];

describe("timeline helpers", () => {
  it("builds parent/child forest", () => {
    const forest = buildTimelineForest(steps);
    assert.equal(forest.length, 1);
    assert.equal(forest[0]!.step.id, "a");
    assert.equal(forest[0]!.children[0]!.step.id, "n");
  });

  it("shows parallel siblings under the same parent_step_id (Phase 24 / DR9)", () => {
    const parallel: ApiRunStep[] = [
      ...steps,
      {
        id: "s",
        run_id: "r",
        parent_step_id: "a",
        seq: 3,
        name: "astra.delegated",
        kind: "agent",
        agent_id: "astra",
        status: "running",
        output: null,
      },
      {
        id: "p",
        run_id: "r",
        parent_step_id: "a",
        seq: 4,
        name: "pixel.delegated",
        kind: "agent",
        agent_id: "pixel",
        status: "queued",
        output: null,
      },
      {
        id: "c",
        run_id: "r",
        parent_step_id: "n",
        seq: 5,
        name: "astra.consulted",
        kind: "consult",
        agent_id: "astra",
        status: "completed",
        output: null,
      },
    ];
    const forest = buildTimelineForest(parallel);
    assert.equal(forest[0]!.children.length, 3);
    assert.deepEqual(
      forest[0]!.children.map((n) => n.step.agent_id),
      ["nova", "astra", "pixel"],
    );
    assert.equal(forest[0]!.children[0]!.children[0]!.step.kind, "consult");
  });

  it("derives active agent from running step", () => {
    assert.equal(deriveActiveAgent(steps), "nova");
  });
});
