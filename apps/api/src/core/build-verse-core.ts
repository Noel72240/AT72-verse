import { createBusFromEnv, type Bus } from "@at72-verse/bus";
import { createVerseCore, type VerseCore } from "@at72-verse/verse-core";

function resolveKernelBackend(): "stub" | "core" {
  return process.env.VERSE_KERNEL_BACKEND === "core" ? "core" : "stub";
}

export type PlatformRuntime = {
  bus: Bus;
  core: VerseCore;
};

/**
 * Shared Bus + Core wiring so API services publish via the same Bus instance (AG1).
 * Memory store is attached by MemoryModule (Prisma) on init — default in-memory until then.
 */
export function buildPlatformRuntime(): PlatformRuntime {
  const bus = createBusFromEnv();
  const core = createVerseCore({
    bus,
    kernelBackend: resolveKernelBackend(),
  });
  return { bus, core };
}

/** @deprecated Prefer buildPlatformRuntime — kept for call sites needing Core only. */
export function buildVerseCore(): VerseCore {
  return buildPlatformRuntime().core;
}
