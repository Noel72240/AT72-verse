import type { AdapterHealth } from "../adapters/ports.js";
import type { CoreModuleManifestEntry } from "../modules/manifest.js";

export type VerseCoreStatus = "ok" | "degraded" | "down";

/**
 * Extensible health report (Decision M).
 */
export type VerseCoreHealthReport = {
  status: VerseCoreStatus;
  version: string;
  uptime_ms: number;
  started_at: string;
  modules: CoreModuleManifestEntry[];
  adapters: AdapterHealth[];
  /** Host-reported Kernel backend — agents never see this. */
  kernel_backend: "stub" | "core";
  /** Reserved for future fields (build, region, …). */
  extensions?: Record<string, unknown>;
};
