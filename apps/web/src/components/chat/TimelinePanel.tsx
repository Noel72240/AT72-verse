"use client";

import { useMemo } from "react";
import type { ApiRunStep } from "@/lib/api";
import { buildTimelineForest, deriveActiveAgent, type TimelineNode } from "@/lib/timeline";

function StepNode({ node, depth }: { node: TimelineNode; depth: number }) {
  const { step, children } = node;
  return (
    <div className={`step ${step.status}`} style={{ marginLeft: depth * 8 }}>
      <div>
        <strong>{step.name}</strong>{" "}
        <span className="status-pill">{step.status}</span>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        {step.agent_id ? `agent: ${step.agent_id}` : step.kind}
      </div>
      {children.length > 0 ? (
        <div className="step-children">
          {children.map((c) => (
            <StepNode key={c.step.id} node={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TimelinePanel({
  steps,
  runStatus,
  cost,
}: {
  steps: ApiRunStep[];
  runStatus?: string | null;
  cost?: {
    spent_usd: number;
    spent_tokens: number;
    max_usd: number | null;
    max_tokens: number | null;
  } | null;
}) {
  const forest = useMemo(() => buildTimelineForest(steps), [steps]);
  const active = useMemo(() => deriveActiveAgent(steps), [steps]);

  return (
    <aside className="timeline-panel">
      <h2>Run timeline</h2>
      {runStatus ? (
        <div style={{ marginBottom: "0.5rem" }}>
          Run: <span className="status-pill">{runStatus}</span>
        </div>
      ) : null}
      {cost ? (
        <div
          style={{
            marginBottom: "0.75rem",
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            lineHeight: 1.45,
          }}
        >
          Cost: <strong style={{ color: "var(--text)" }}>${cost.spent_usd.toFixed(4)}</strong>
          {cost.max_usd != null ? ` / $${cost.max_usd.toFixed(2)}` : null}
          <br />
          Tokens: <strong style={{ color: "var(--text)" }}>{cost.spent_tokens}</strong>
          {cost.max_tokens != null ? ` / ${cost.max_tokens}` : null}
        </div>
      ) : null}
      <div className="active-agent">
        Active agent: <strong>{active ?? "—"}</strong>
      </div>
      {forest.length === 0 ? (
        <p className="empty" style={{ padding: 0, textAlign: "left" }}>
          Steps appear when a run starts.
        </p>
      ) : (
        forest.map((n) => <StepNode key={n.step.id} node={n} depth={0} />)
      )}
    </aside>
  );
}
