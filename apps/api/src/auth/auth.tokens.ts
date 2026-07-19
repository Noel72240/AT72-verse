import type { AuthSession } from "@at72-verse/auth";
import type { User } from "@at72-verse/db";

export const AUTH_PROVIDER = Symbol("AUTH_PROVIDER");
export const PRISMA = Symbol("PRISMA");

export type VerseAuthContext = {
  session: AuthSession;
  user: User;
};

export type RequestWithAuth = {
  headers: Record<string, string | string[] | undefined>;
  verseAuth?: VerseAuthContext;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
};
