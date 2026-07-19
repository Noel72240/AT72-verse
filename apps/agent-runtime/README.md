# apps/agent-runtime

Native agent runtime (**ADR-006**, Phase 12).

- Subscribes to `verse.agent.{id}.tasks` for each registered plugin
- Invokes agent `handleTask` with **Kernel stub** (no Core dependency)
- Publishes `task.completed` on `verse.agent.{id}.events`
- **Never** mutates Runs/Prisma — API projects plans into RunSteps

```bash
pnpm runtime:start
```
