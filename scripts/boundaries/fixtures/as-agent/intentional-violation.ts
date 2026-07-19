/**
 * INTENTIONAL ARCHITECTURE VIOLATION — Phase 09 / Q1 fixture.
 *
 * Not part of production. Ignored by the main ESLint run.
 * Used only by `pnpm boundaries:prove` to assert guards detect this import.
 *
 * Forbidden on purpose: @at72-verse/db (outside P2 allow-list).
 */
import { createPrismaClient } from "@at72-verse/db";

export const intentionalLeak = createPrismaClient;
