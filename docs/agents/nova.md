# Agent: Nova

**Phase 14** · specialist · model Adam (`handleTask`)

## Role

Content specialist. Produces text by **explicitly** invoking `skill.writing` (no auto-binding).

## Skills

| Skill | Binding |
|-------|---------|
| `skill.writing` | Declared in `agent.manifest.json` · invoked in `handleTask` |

## Tools

None in Phase 14.

## Orchestration

Called by Adam via `Kernel.orchestration.delegate` (Phase 15). Does not know the calling agent.

## Persona defaults

`persona.nova.default` (Persona Engine = Phase 17).

## Golden paths / evals

- Runtime test: Nova task → writing skill → `task.completed` with `result.content`
- Skill golden: `skills/writing` eval suite
