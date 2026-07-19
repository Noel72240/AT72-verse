/**
 * EA10bis — observability overhead must stay under 5% on a measured golden path.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OBSERVABILITY_OVERHEAD_TARGET_PCT,
  initObservability,
  resetMetricsForTests,
  resetTracingForTests,
  sanitizeAttributes,
} from "./index.js";

function work(): void {
  for (let i = 0; i < 200; i++) {
    sanitizeAttributes({
      run_id: "11111111-1111-4111-8111-111111111111",
      status: "running",
      duration_ms: i,
      goal: "Write a LinkedIn post about Verse for user@example.com",
      tool_id: "social-publish",
    });
  }
}

function median(samples: number[]): number {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

describe("observability overhead EA10bis", () => {
  it(`keeps overhead under ${OBSERVABILITY_OVERHEAD_TARGET_PCT}% vs baseline`, () => {
    resetMetricsForTests();
    resetTracingForTests();
    delete process.env.VERSE_OTEL_ENABLED;

    const baseline: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      work();
      baseline.push(performance.now() - t0);
    }

    process.env.VERSE_OTEL_ENABLED = "1";
    initObservability({ serviceName: "overhead-bench" });
    const withObs: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t0 = performance.now();
      work();
      withObs.push(performance.now() - t0);
    }

    const off = median(baseline);
    const on = median(withObs);
    const overheadPct = off === 0 ? 0 : ((on - off) / off) * 100;
    assert.ok(
      overheadPct < OBSERVABILITY_OVERHEAD_TARGET_PCT,
      `overhead ${overheadPct.toFixed(2)}% >= ${OBSERVABILITY_OVERHEAD_TARGET_PCT}% (off=${off.toFixed(3)}ms on=${on.toFixed(3)}ms)`,
    );
    delete process.env.VERSE_OTEL_ENABLED;
    resetTracingForTests();
  });
});
