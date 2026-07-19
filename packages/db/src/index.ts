/**
 * @at72-verse/db
 *
 * Prisma schema, migrations, client, and tenancy CRUD (Phase 04).
 */
export {
  createPrismaClient,
  getPrisma,
  prisma,
  OrgRole,
  WorkspaceRole,
  InvitationStatus,
  RunStatus,
  RunStepStatus,
  MessageRole,
} from "./client.js";
export type { PrismaClient, Prisma, User, Conversation, Message, Run, RunStep } from "./client.js";
export {
  createOrganization,
  getOrganizationById,
  updateOrganizationName,
  deleteOrganization,
  createUser,
  getUserByEmail,
  createMembership,
  createWorkspace,
  createWorkspaceMember,
  listWorkspacesForOrganization,
} from "./tenancy.js";
export type {
  CreateOrganizationInput,
  CreateUserInput,
  CreateMembershipInput,
  CreateWorkspaceInput,
  CreateWorkspaceMemberInput,
} from "./tenancy.js";
export {
  createPrismaMemoryStore,
  type MemoryRecordQuery,
  type MemoryRecordRepository,
} from "./memory-store.js";
export {
  createPrismaVectorIndex,
  PG_VECTOR_DIMS,
  type DbVectorIndex,
} from "./vector-index.js";
export {
  createPrismaToolExecutionAudit,
  type ToolExecutionAuditEntry,
  type ToolExecutionAuditRepository,
} from "./tool-audit.js";
export {
  ensureFirstPartyCapabilityGrants,
  listCapabilityGrants,
  upsertCapabilityGrant,
} from "./capability-grants.js";
export {
  ensureFirstPartyPackageCatalog,
  ensureFirstPartyTenantPackages,
  listCatalogPackages,
  listTenantPackages,
  installTenantPackage,
  uninstallTenantPackage,
  pinTenantPackage,
  buildPackagesSnapshot,
  isPackageInstalledForCapability,
} from "./package-registry.js";

export const packageName = "@at72-verse/db" as const;
