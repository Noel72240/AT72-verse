/**
 * Long-lived agent runtime process (AN1).
 * Usage: REDIS_URL=... DATABASE_URL=... pnpm runtime:start
 */
import { createBusFromEnv } from "@at72-verse/bus";
import {
  createPrismaApprovalStore,
  createPrismaClient,
  createPrismaConnectorStore,
  createPrismaMemoryStore,
  createPrismaSecretsVaultCipherStore,
  createPrismaToolExecutionAudit,
  createPrismaVectorIndex,
} from "@at72-verse/db";
import { createVerseCore, LocalEncryptedSecretsVault } from "@at72-verse/verse-core";
import { startAgentRuntime } from "./runtime.js";

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
  `[agent-runtime] Core host ready; agents: ${handle.agents.join(", ")}; skills: ${handle.skills.join(", ")}; workflows: on; approvals resume: on`,
);

const shutdown = async () => {
  console.log("[agent-runtime] shutting down…");
  await handle.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
