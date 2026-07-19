/**
 * In-process Prometheus-text metrics (Phase 30 / EA6).
 */
type Labels = Record<string, string>;

function labelsKey(labels: Labels): string {
  return Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
}

class Counter {
  private readonly series = new Map<string, { labels: Labels; value: number }>();

  constructor(readonly name: string, readonly help: string) {}

  inc(labels: Labels = {}, delta = 1): void {
    const key = labelsKey(labels);
    const cur = this.series.get(key);
    if (cur) cur.value += delta;
    else this.series.set(key, { labels: { ...labels }, value: delta });
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { labels, value } of this.series.values()) {
      const ls = Object.entries(labels)
        .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
        .join(",");
      lines.push(ls ? `${this.name}{${ls}} ${value}` : `${this.name} ${value}`);
    }
    return lines.join("\n");
  }
}

class Histogram {
  private readonly series = new Map<
    string,
    { labels: Labels; count: number; sum: number; buckets: number[] }
  >();
  private readonly bounds: number[];

  constructor(
    readonly name: string,
    readonly help: string,
    bounds: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  ) {
    this.bounds = bounds;
  }

  observe(labels: Labels, valueMs: number): void {
    const key = labelsKey(labels);
    let cur = this.series.get(key);
    if (!cur) {
      cur = { labels: { ...labels }, count: 0, sum: 0, buckets: this.bounds.map(() => 0) };
      this.series.set(key, cur);
    }
    cur.count += 1;
    cur.sum += valueMs;
    for (let i = 0; i < this.bounds.length; i++) {
      if (valueMs <= this.bounds[i]!) cur.buckets[i]! += 1;
    }
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const { labels, count, sum, buckets } of this.series.values()) {
      const base = Object.entries(labels)
        .map(([k, v]) => `${k}="${escapeLabel(v)}"`)
        .join(",");
      let cumulative = 0;
      for (let i = 0; i < this.bounds.length; i++) {
        cumulative += buckets[i]!;
        const le = this.bounds[i]!;
        const ls = base ? `${base},le="${le}"` : `le="${le}"`;
        lines.push(`${this.name}_bucket{${ls}} ${cumulative}`);
      }
      const lsInf = base ? `${base},le="+Inf"` : `le="+Inf"`;
      lines.push(`${this.name}_bucket{${lsInf}} ${count}`);
      lines.push(base ? `${this.name}_sum{${base}} ${sum}` : `${this.name}_sum ${sum}`);
      lines.push(base ? `${this.name}_count{${base}} ${count}` : `${this.name}_count ${count}`);
    }
    return lines.join("\n");
  }
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export class MetricsRegistry {
  readonly httpRequestDuration = new Histogram(
    "verse_http_request_duration_ms",
    "HTTP request duration in milliseconds",
  );
  readonly httpRequests = new Counter("verse_http_requests_total", "HTTP requests by status");
  readonly runStatus = new Counter("verse_run_status_total", "Run status transitions");
  readonly toolExecuteDuration = new Histogram(
    "verse_tool_execute_duration_ms",
    "Tool execute duration in milliseconds",
  );
  readonly toolExecute = new Counter("verse_tool_execute_total", "Tool execute outcomes");
  readonly dlqEnqueue = new Counter("verse_bus_dlq_enqueue_total", "Bus DLQ enqueue count");
  readonly kernelReject = new Counter("verse_kernel_reject_total", "Kernel FORBIDDEN/reject count");

  renderPrometheus(): string {
    return [
      this.httpRequestDuration.render(),
      this.httpRequests.render(),
      this.runStatus.render(),
      this.toolExecuteDuration.render(),
      this.toolExecute.render(),
      this.dlqEnqueue.render(),
      this.kernelReject.render(),
      "",
    ].join("\n");
  }
}

let registry: MetricsRegistry | undefined;

export function getMetrics(): MetricsRegistry {
  if (!registry) registry = new MetricsRegistry();
  return registry;
}

/** Test helper. */
export function resetMetricsForTests(): void {
  registry = new MetricsRegistry();
}
