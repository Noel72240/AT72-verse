/**
 * Long-lived agent runtime process (AN1).
 * Usage: REDIS_URL=... DATABASE_URL=... pnpm runtime:start
 */
import { createBusFromEnv, setDlqEnqueueHook } from "@at72-verse/bus";
import {
  createPrismaApprovalStore,
  createPrismaClient,
  createPrismaConnectorStore,
  createPrismaMemoryStore,
  createPrismaSecretsVaultCipherStore,
  createPrismaToolExecutionAudit,
  createPrismaVectorIndex,
} from "@at72-verse/db";
import { getMetrics, initObservability } from "@at72-verse/observability";
import {
  createVerseCore,
  LocalEncryptedSecretsVault,
  setToolMetricsHook,
} from "@at72-verse/verse-core";
import { startAgentRuntime } from "./runtime.js";

initObservability({ serviceName: "at72-verse-agent-runtime" });
const metrics = getMetrics();
setToolMetricsHook({
  recordExecute({ tool_id, duration_ms, result }) {
    metrics.toolExecuteDuration.observe({ tool_id, result }, duration_ms);
    metrics.toolExecute.inc({ tool_id, result });
  },
});
setDlqEnqueueHook(({ run_id }) => {
  metrics.dlqEnqueue.inc({ run_present: run_id ? "1" : "0" });
});

const bus = createBusFromEnv();
const core = createVerseCore({ bus, kernelBackend: "core" });

let prisma = undefined as ReturnType<typeof createPrismaClient> | undefined;
if (process.env.DATABASE_URL) {
  prisma = createPrismaClient();
  core.setMemoryStore(createPrismaMemoryStore(prisma));
  core.setVectorIndex(createPrismaVectorIndex(prisma));
  core.setToolAudit(createPrismaToolExecutionAudit(prisma));
  const cipherStore = createPrismaSecretsVaultCipherStore(prisma);
  core.setSecretsVault(new LocalEncryptedSecretsVault({ store: cipherStore }));
  core.setConnectorStore(createPrismaConnectorStore(prisma));
  core.setApprovalStore(createPrismaApprovalStore(prisma));
  console.log("[agent-runtime] Memory + Tool audit + Vector + Vault/OAuth + HITL: PostgreSQL");
} else {
  console.log("[agent-runtime] Memory/Tool audit: in-process (set DATABASE_URL for Postgres)");
}

const handle = await startAgentRuntime({ bus, core, prisma });

console.log(
  `[agent-runtime] Core host ready; agents: ${handle.agents.join(", ")}; skills: ${handle.skills.join(", ")}; workflows: on; approvals resume: on; otel: ${process.env.VERSE_OTEL_ENABLED === "1" ? "on" : "off"}`,
);

const shutdown = async () => {
  console.log("[agent-runtime] shutting down…");
  await handle.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
