/**
 * scripts/check-docker-stack.mjs
 *
 * Verifies local Postgres + Redis connectivity using URLs from the environment
 * (defaults match `.env.example`). Used after `pnpm docker:up`.
 *
 * Requires the host stack to be running (Docker). No Docker SDK dependency.
 */
import net from "node:net";

const DATABASE_HOST = process.env.POSTGRES_HOST ?? "127.0.0.1";
const DATABASE_PORT = Number(process.env.POSTGRES_PORT ?? "5432");
const REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT ?? "6379");
const TIMEOUT_MS = 3000;

function probe(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout connecting to ${host}:${port}`));
    }, TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  const checks = [
    { name: "PostgreSQL", host: DATABASE_HOST, port: DATABASE_PORT },
    { name: "Redis", host: REDIS_HOST, port: REDIS_PORT },
  ];

  let failed = 0;
  for (const check of checks) {
    try {
      await probe(check.host, check.port);
      console.log(`OK  ${check.name} reachable at ${check.host}:${check.port}`);
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`FAIL ${check.name} at ${check.host}:${check.port} — ${message}`);
    }
  }

  if (failed > 0) {
    console.error(
      "\nStack not reachable. Start it with `pnpm docker:up` (requires Docker). See docs/runbooks/local-dev.md.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nLocal data plane ports are reachable.");
}

await main();
