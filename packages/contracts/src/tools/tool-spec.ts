import type { SemVer } from "../common/primitives.js";
import type { JsonSchema } from "../skills/skill-spec.js";

export type ToolAuthType = "oauth" | "api_key" | "none";

export interface ToolAuth {
  type: ToolAuthType;
}

export interface ToolRetryPolicy {
  max_attempts: number;
  backoff_ms: number;
}

export interface ToolRateLimit {
  max_per_minute: number;
}

export interface ToolPackageRef {
  kind: "tool";
  package_id?: string;
}

export interface ToolSpec {
  id: string;
  version: SemVer;
  description: string;
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  side_effect: boolean;
  auth: ToolAuth;
  timeout_ms: number;
  retry_policy?: ToolRetryPolicy;
  rate_limit?: ToolRateLimit;
  permission: string;
  categories?: string[];
  package?: ToolPackageRef;
}
