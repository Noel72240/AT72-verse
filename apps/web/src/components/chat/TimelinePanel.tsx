"use client";

import { useMemo } from "react";
import type { ApiRunStep } from "@/lib/api";
import { buildTimelineForest, deriveActiveAgent, type TimelineNode } from "@/lib/timeline";

function humanStatus(status: string): string {
  switch (status) {
    case "queued":
      return "en attente";
    case "running":
      return "en cours";
    case "completed":
      return "terminé";
    case "failed":
      return "échoué";
    case "waiting_approval":
      return "validation";
    default:
      return status;
  }
}

function humanStepName(name: string): string {
  const map: Record<string, string> = {
    "adam.orchestrate": "Adam orchestre",
    direct_reply: "Réponse directe",
    direct_write: "Rédaction du post",
    analyze_goal: "Analyse de la demande",
    draft_orchestration_plan: "Plan d'exécution",
    aggregate_result: "Synthèse",
    invoke_writing: "Rédaction",
    deliver_content: "Livraison du contenu",
    invoke_seo: "SEO",
    deliver_seo: "Livraison SEO",
    invoke_image_generation: "Image",
    deliver_visual: "Livraison visuelle",
  };
  if (map[name]) return map[name];
  if (name.startsWith("delegate_")) return `Délégation → ${name.slice("delegate_".length)}`;
  if (name.endsWith(".delegated")) return `Délégation ${name.replace(".delegated", "")}`;
  return name.replace(/_/g, " ");
}

function StepNode({ node, depth }: { node: TimelineNode; depth: number }) {
  const { step, children } = node;
  const approvalId =
    step.output && typeof step.output.approval_id === "string"
      ? step.output.approval_id
      : null;
  return (
    <div className={`step ${step.status}`} style={{ marginLeft: depth * 8 }}>
      <div>
        <strong>{humanStepName(step.name)}</strong>{" "}
        <span className="status-pill">{humanStatus(step.status)}</span>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        {step.agent_id ? `agent : ${step.agent_id}` : step.kind}
      </div>
      {approvalId ? (
        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          validation : <code>{approvalId}</code>
        </div>
      ) : null}
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
  busy,
  cost,
  traceId,
  grafanaTraceUrl,
}: {
  steps: ApiRunStep[];
  runStatus?: string | null;
  /** True while the chat is waiting on Adam. */
  busy?: boolean;
  cost?: {
    spent_usd: number;
    spent_tokens: number;
    max_usd: number | null;
    max_tokens: number | null;
  } | null;
  traceId?: string | null;
  grafanaTraceUrl?: string | null;
}) {
  // Hide leftover "queued" leaf noise once the run is finished.
  const visibleSteps = useMemo(() => {
    if (runStatus === "completed" || runStatus === "failed") {
      return steps.filter((s) => s.status !== "queued");
    }
    return steps;
  }, [steps, runStatus]);

  const forest = useMemo(() => buildTimelineForest(visibleSteps), [visibleSteps]);
  const active = useMemo(() => deriveActiveAgent(visibleSteps), [visibleSteps]);

  return (
    <aside className="timeline-panel">
      <h2>Suivi d&apos;exécution</h2>
      {busy && runStatus !== "completed" && runStatus !== "failed" ? (
        <div className="thinking-banner">Adam travaille…</div>
      ) : null}
      {runStatus ? (
        <div style={{ marginBottom: "0.5rem" }}>
          Statut : <span className="status-pill">{humanStatus(runStatus)}</span>
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
          Coût : <strong style={{ color: "var(--text)" }}>${cost.spent_usd.toFixed(4)}</strong>
          {cost.max_usd != null ? ` / $${cost.max_usd.toFixed(2)}` : null}
          <br />
          Tokens : <strong style={{ color: "var(--text)" }}>{cost.spent_tokens}</strong>
          {cost.max_tokens != null ? ` / ${cost.max_tokens}` : null}
        </div>
      ) : null}
      <div className="active-agent">
        Agent actif : <strong>{active ?? "—"}</strong>
      </div>
      {forest.length === 0 ? (
        <p className="empty" style={{ padding: 0, textAlign: "left" }}>
          {busy
            ? "Démarrage de la course…"
            : "Les étapes apparaissent quand tu envoies un message."}
        </p>
      ) : (
        forest.map((n) => <StepNode key={n.step.id} node={n} depth={0} />)
      )}
      {traceId ? (
        <details className="trace-details">
          <summary>Détails techniques</summary>
          <div>
            trace : <code>{traceId}</code>
            {grafanaTraceUrl ? (
              <>
                <br />
                <a href={grafanaTraceUrl} target="_blank" rel="noreferrer">
                  Ouvrir dans Grafana
                </a>
              </>
            ) : null}
          </div>
        </details>
      ) : null}
    </aside>
  );
}
