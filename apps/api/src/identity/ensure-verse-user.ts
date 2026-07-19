import type { AuthSession } from "@at72-verse/auth";
import type { PrismaClient, User } from "@at72-verse/db";

export type EnsureVerseUserInput = Pick<
  AuthSession,
  "idpUserId" | "email" | "displayName" | "avatarUrl"
>;

/**
 * Idempotent lazy provisioning (Phase 05 Decision B).
 * Lookup by clerk_user_id, else link by email, else create.
 * Updates non-sensitive profile fields when needed.
 */
export async function ensureVerseUser(
  db: PrismaClient,
  identity: EnsureVerseUserInput,
): Promise<User> {
  const email = identity.email.trim().toLowerCase();
  const clerkUserId = identity.idpUserId;

  const byClerk = await db.user.findUnique({
    where: { clerkUserId },
  });
  if (byClerk) {
    return updateProfileIfNeeded(db, byClerk, identity, email);
  }

  const byEmail = await db.user.findUnique({
    where: { email },
  });
  if (byEmail) {
    try {
      return await db.user.update({
        where: { id: byEmail.id },
        data: {
          clerkUserId,
          displayName: identity.displayName ?? byEmail.displayName,
          avatarUrl: identity.avatarUrl ?? byEmail.avatarUrl,
          email,
        },
      });
    } catch {
      // Concurrent link won the unique clerk_user_id race — re-read.
      const raced = await db.user.findUnique({ where: { clerkUserId } });
      if (raced) return raced;
      throw new Error("Failed to link existing user to IdP subject");
    }
  }

  try {
    return await db.user.create({
      data: {
        email,
        clerkUserId,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl,
      },
    });
  } catch {
    const raced = await db.user.findUnique({ where: { clerkUserId } });
    if (raced) return raced;
    const racedEmail = await db.user.findUnique({ where: { email } });
    if (racedEmail) return racedEmail;
    throw new Error("Failed to provision Verse user");
  }
}

async function updateProfileIfNeeded(
  db: PrismaClient,
  user: User,
  identity: EnsureVerseUserInput,
  email: string,
): Promise<User> {
  const nextDisplayName = identity.displayName ?? user.displayName;
  const nextAvatar = identity.avatarUrl ?? user.avatarUrl;
  const needsUpdate =
    user.email !== email || user.displayName !== nextDisplayName || user.avatarUrl !== nextAvatar;

  if (!needsUpdate) return user;

  return db.user.update({
    where: { id: user.id },
    data: {
      email,
      displayName: nextDisplayName,
      avatarUrl: nextAvatar,
    },
  });
}
