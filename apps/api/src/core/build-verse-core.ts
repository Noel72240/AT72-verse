import { createBus, createBusFromEnv, type Bus } from "@at72-verse/bus";
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
 * Embedded MVP uses in-memory bus (no Redis queue lag). Set VERSE_FORCE_REDIS=1 to keep Redis.
 */
export function buildPlatformRuntime(): PlatformRuntime {
  const embed = process.env.VERSE_EMBED_AGENT_RUNTIME !== "0";
  const forceRedis = process.env.VERSE_FORCE_REDIS === "1";
  const bus =
    embed && !forceRedis ? createBus({ backend: "memory" }) : createBusFromEnv();
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
