import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { setDlqEnqueueHook } from "@at72-verse/bus";
import { getMetrics, initObservability } from "@at72-verse/observability";
import { setToolMetricsHook } from "@at72-verse/verse-core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  initObservability({ serviceName: "at72-verse-api" });
  const metrics = getMetrics();
  setToolMetricsHook({
    recordExecute({ tool_id, duration_ms, result }) {
      metrics.toolExecuteDuration.observe({ tool_id, result }, duration_ms);
      metrics.toolExecute.inc({ tool_id, result });
    },
  });
  setDlqEnqueueHook(({ run_id }) => {
    metrics.dlqEnqueue.inc({
      run_present: run_id ? "1" : "0",
    });
  });

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });

  const webOrigin =
    process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";
  app.enableCors({
    origin: webOrigin
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Last-Event-ID"],
  });

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? "3001");
  await app.listen(port);
  console.log(`AT72 Verse API listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
