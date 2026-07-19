/**
 * Public topic catalog (Phase 10 / U2).
 * Topic names are part of the public architecture — see docs/bus-topics.md.
 */

/** Dead-letter placeholder (W1) — same BusMessage envelope as normal events. */
export const TOPIC_DLQ = "verse.dlq" as const;

/** Reserved prefixes (may be unused in Phase 10). */
export const TOPIC_PREFIX_RUNS = "verse.runs." as const;
export const TOPIC_PREFIX_AGENT = "verse.agent." as const;
export const TOPIC_PREFIX_SYSTEM = "verse.system." as const;
export const TOPIC_PREFIX_AUDIT = "verse.audit." as const;
export const TOPIC_PREFIX_METRICS = "verse.metrics." as const;
/** LLM usage / metering events (Phase 13 / AW2). */
export const TOPIC_PREFIX_LLM = "verse.llm." as const;

export const RESERVED_TOPIC_PREFIXES = [
  TOPIC_PREFIX_RUNS,
  TOPIC_PREFIX_AGENT,
  TOPIC_PREFIX_SYSTEM,
  TOPIC_PREFIX_AUDIT,
  TOPIC_PREFIX_METRICS,
  TOPIC_PREFIX_LLM,
  `${TOPIC_DLQ}`,
] as const;

/** `verse.runs.{suffix}` e.g. verse.runs.created */
export function runsTopic(suffix: string): string {
  const clean = suffix.replace(/^\.+/, "");
  return `${TOPIC_PREFIX_RUNS}${clean}`;
}

/** `verse.agent.{agentId}.tasks` */
export function agentTasksTopic(agentId: string): string {
  if (!agentId || agentId.includes(".")) {
    throw new Error(`Invalid agentId for topic: ${agentId}`);
  }
  return `${TOPIC_PREFIX_AGENT}${agentId}.tasks`;
}

/** `verse.agent.{agentId}.events` — agent signals (task.completed, …) */
export function agentEventsTopic(agentId: string): string {
  if (!agentId || agentId.includes(".")) {
    throw new Error(`Invalid agentId for topic: ${agentId}`);
  }
  return `${TOPIC_PREFIX_AGENT}${agentId}.events`;
}

export function systemTopic(suffix: string): string {
  return `${TOPIC_PREFIX_SYSTEM}${suffix.replace(/^\.+/, "")}`;
}

export function auditTopic(suffix: string): string {
  return `${TOPIC_PREFIX_AUDIT}${suffix.replace(/^\.+/, "")}`;
}

export function metricsTopic(suffix: string): string {
  return `${TOPIC_PREFIX_METRICS}${suffix.replace(/^\.+/, "")}`;
}

/** `verse.llm.{suffix}` e.g. verse.llm.usage */
export function llmTopic(suffix: string): string {
  const clean = suffix.replace(/^\.+/, "");
  return `${TOPIC_PREFIX_LLM}${clean}`;
}

export function isReservedTopic(topic: string): boolean {
  if (topic === TOPIC_DLQ) return true;
  return (
    topic.startsWith(TOPIC_PREFIX_RUNS) ||
    topic.startsWith(TOPIC_PREFIX_AGENT) ||
    topic.startsWith(TOPIC_PREFIX_SYSTEM) ||
    topic.startsWith(TOPIC_PREFIX_AUDIT) ||
    topic.startsWith(TOPIC_PREFIX_METRICS) ||
    topic.startsWith(TOPIC_PREFIX_LLM)
  );
}
