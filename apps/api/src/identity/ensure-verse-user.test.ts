import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import { ensureVerseUser } from "./ensure-verse-user.js";

const databaseUrl = process.env.DATABASE_URL;

describe("ensureVerseUser (lazy upsert)", { skip: !databaseUrl }, () => {
  let prisma: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `ensure-${suffix}@example.com`;
  const idpUserId = `idp_${suffix}`;

  before(async () => {
    prisma = createPrismaClient(databaseUrl);
  });

  after(async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ email }, { clerkUserId: idpUserId }] },
    });
    await prisma.$disconnect();
  });

  it("creates then updates idempotently", async () => {
    const first = await ensureVerseUser(prisma, {
      idpUserId,
      email,
      displayName: "One",
      avatarUrl: null,
    });
    assert.equal(first.clerkUserId, idpUserId);

    const second = await ensureVerseUser(prisma, {
      idpUserId,
      email,
      displayName: "Two",
      avatarUrl: "https://example.com/x.png",
    });
    assert.equal(second.id, first.id);
    assert.equal(second.displayName, "Two");
    assert.equal(second.avatarUrl, "https://example.com/x.png");
  });
});
