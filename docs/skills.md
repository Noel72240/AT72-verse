# Skills (Phase 14 / ADR-011)

Decisions **BA2 · BB1 · BC1 · BE1 · BF1 · BH1 · BI1 · BK1/BK3 · BL1**

## Model

A Skill is **hybrid**:

| Piece | Role |
|-------|------|
| `SkillSpec` / `skill.manifest.json` | Official description (Marketplace-ready) |
| `execute({ kernel, input })` | Handler — Kernel I/O only |

API minimale (BC1): `SKILL_ID`, `skillSpec` / `WRITING_SKILL_SPEC`, `execute`.

## Hosting (BB1)

- **Runtime** registers Skills (like agents)
- `Kernel.skills.invoke` → Core → host `SkillHostPort` → skill `execute`
- **Core never imports** `skills/*`

## Boundaries (BL1)

Skills may only import `@at72-verse/contracts` + `@at72-verse/verse-kernel`.

## First skill: `skill.writing`

- Profile: `creative-balanced` (never a raw model id)
- Validates input/output with Ajv via `validateDataAgainstJsonSchema` (contracts)
- Golden eval: `skills/writing/src/evals/writing.golden.test.ts`

## Versioning

Breaking SkillSpec changes require a **new semver**. Additive fields OK within the same major.
