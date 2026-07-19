import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
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
