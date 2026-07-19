/**
 * @at72-verse/db — Prisma client factory / singleton
 *
 * Access DB only from Verse Core / API domain services — never from agents (ARCHITECTURE).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __at72VersePrisma?: PrismaClient;
};

/**
 * Neon sometimes appends channel_binding=require which breaks some Node/Prisma TLS paths.
 * Prefer sslmode=require only for long-running API hosts (Railway).
 */
export function normalizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.get("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env and start Postgres (`pnpm docker:up`).",
    );
  }

  return new PrismaClient({
    datasources: {
      db: { url: normalizeDatabaseUrl(databaseUrl) },
    },
  });
}

/** Lazy singleton for long-lived processes (API / workers). */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__at72VersePrisma) {
    globalForPrisma.__at72VersePrisma = createPrismaClient();
  }
  return globalForPrisma.__at72VersePrisma;
}

/** Alias of `getPrisma()` for ergonomic imports. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, property, receiver) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export type {
  PrismaClient,
  Prisma,
  User,
  Conversation,
  Message,
  Run,
  RunStep,
} from "@prisma/client";
export { Prisma as PrismaNamespace } from "@prisma/client";
export {
  OrgRole,
  WorkspaceRole,
  InvitationStatus,
  RunStatus,
  RunStepStatus,
  MessageRole,
} from "@prisma/client";
