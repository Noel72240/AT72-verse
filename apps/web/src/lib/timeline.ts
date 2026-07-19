/** Derive active agent from RunSteps (CI1) — no dedicated event. */
import type { ApiRunStep } from "./api";

export function deriveActiveAgent(steps: ApiRunStep[]): string | null {
  const running = steps
    .filter((s) => s.status === "running" && s.agent_id)
    .sort((a, b) => b.seq - a.seq);
  if (running[0]?.agent_id) return running[0].agent_id;

  const recent = [...steps]
    .filter((s) => s.agent_id)
    .sort((a, b) => b.seq - a.seq);
  return recent[0]?.agent_id ?? null;
}

/** Build a simple tree for timeline display without mutating RunStep model. */
export type TimelineNode = {
  step: ApiRunStep;
  children: TimelineNode[];
};

export function buildTimelineForest(steps: ApiRunStep[]): TimelineNode[] {
  const byId = new Map(steps.map((s) => [s.id, { step: s, children: [] as TimelineNode[] }]));
  const roots: TimelineNode[] = [];
  const ordered = [...steps].sort((a, b) => a.seq - b.seq);
  for (const s of ordered) {
    const node = byId.get(s.id)!;
    if (s.parent_step_id && byId.has(s.parent_step_id)) {
      byId.get(s.parent_step_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
