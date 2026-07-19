# @at72-verse/config-tsconfig

Shared TypeScript configurations:

| File | Use |
|------|-----|
| `base.json` | Strict baseline |
| `library.json` | Shared libraries (`packages/*`) |
| `node.json` | Node apps (`apps/*`) |

Extend from workspace packages via:

```json
{ "extends": "@at72-verse/config-tsconfig/library.json" }
```
