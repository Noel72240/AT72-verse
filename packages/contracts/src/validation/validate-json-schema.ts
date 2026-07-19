/**
 * Validate arbitrary data against an inline JSON Schema (Phase 14 / BH1).
 * Skills import this from contracts — never import Ajv directly.
 */
import { createRequire } from "node:module";
import type { JsonSchema } from "../skills/skill-spec.js";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as new (options?: object) => {
  compile: (schema: object) => ((data: unknown) => boolean) & {
    errors: unknown;
  };
  errorsText: (errors: unknown, options?: { separator?: string }) => string;
};
const addFormats = require("ajv-formats") as (ajv: InstanceType<typeof Ajv>) => void;

function createAjv(): InstanceType<typeof Ajv> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

export type JsonSchemaValidationResult = { ok: true } | { ok: false; errors: string };

export function validateDataAgainstJsonSchema(
  schema: JsonSchema,
  data: unknown,
): JsonSchemaValidationResult {
  const ajv = createAjv();
  const validate = ajv.compile(schema as object);
  const ok = validate(data);
  if (ok) {
    return { ok: true };
  }
  return {
    ok: false,
    errors: ajv.errorsText(validate.errors, { separator: "\n" }),
  };
}
