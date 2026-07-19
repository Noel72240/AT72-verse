import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as new (options?: object) => {
  compile: (schema: object) => ((data: unknown) => boolean) & {
    errors: unknown;
  };
  errorsText: (errors: unknown, options?: { separator?: string }) => string;
};
const addFormats = require("ajv-formats") as (ajv: InstanceType<typeof Ajv>) => void;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../..");
const schemasDir = path.join(packageRoot, "schemas");
const examplesDir = path.join(packageRoot, "examples");

export const CONTRACT_SCHEMA_FILES = {
  "bus-message": "bus-message.schema.json",
  "agent-manifest": "agent-manifest.schema.json",
  "persona-spec": "persona-spec.schema.json",
  "skill-spec": "skill-spec.schema.json",
  "tool-spec": "tool-spec.schema.json",
  "package-manifest": "package-manifest.schema.json",
  run: "run.schema.json",
  "run-step": "run-step.schema.json",
} as const;

export type ContractSchemaId = keyof typeof CONTRACT_SCHEMA_FILES;

export const CONTRACT_EXAMPLE_FILES: Record<ContractSchemaId, string> = {
  "bus-message": "bus-message.task-completed.json",
  "agent-manifest": "agent-manifest.nova.json",
  "persona-spec": "persona-spec.nova.default.json",
  "skill-spec": "skill-spec.writing.json",
  "tool-spec": "tool-spec.seo-audit.json",
  "package-manifest": "package-manifest.nova.json",
  run: "run.queued.json",
  "run-step": "run-step.bootstrap.json",
};

function createAjv(): InstanceType<typeof Ajv> {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
  });
  addFormats(ajv);
  return ajv;
}

export function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

export function validateAgainstSchema(
  schemaId: ContractSchemaId,
  data: unknown,
): { ok: true } | { ok: false; errors: string } {
  const ajv = createAjv();
  const schemaPath = path.join(schemasDir, CONTRACT_SCHEMA_FILES[schemaId]);
  const schema = loadJson(schemaPath);
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

export function validateExample(
  schemaId: ContractSchemaId,
): { ok: true; example: string } | { ok: false; example: string; errors: string } {
  const examplePath = path.join(examplesDir, CONTRACT_EXAMPLE_FILES[schemaId]);
  const data = loadJson(examplePath);
  const result = validateAgainstSchema(schemaId, data);
  if (result.ok) {
    return { ok: true, example: CONTRACT_EXAMPLE_FILES[schemaId] };
  }
  return {
    ok: false,
    example: CONTRACT_EXAMPLE_FILES[schemaId],
    errors: result.errors,
  };
}

export function validateAllExamples(): Array<
  | { schemaId: ContractSchemaId; ok: true; example: string }
  | { schemaId: ContractSchemaId; ok: false; example: string; errors: string }
> {
  return (Object.keys(CONTRACT_SCHEMA_FILES) as ContractSchemaId[]).map((schemaId) => {
    const result = validateExample(schemaId);
    return { schemaId, ...result };
  });
}
