import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type { ConnectorConnectionPublic, ConnectorProviderId } from "@at72-verse/contracts";
import {
  createPrismaConnectorStore,
  createPrismaSecretsVaultCipherStore,
  type PrismaClient,
} from "@at72-verse/db";
import {
  LocalEncryptedSecretsVault,
  type VerseCore,
} from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

const PROVIDERS = new Set<ConnectorProviderId>(["linkedin", "facebook", "instagram"]);

@Injectable()
export class ConnectorsService implements OnModuleInit {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  onModuleInit(): void {
    const cipherStore = createPrismaSecretsVaultCipherStore(this.prisma);
    const vault = new LocalEncryptedSecretsVault({ store: cipherStore });
    const connectorStore = createPrismaConnectorStore(this.prisma);
    this.core.setSecretsVault(vault);
    this.core.setConnectorStore(connectorStore);
  }

  private async workspaceOrThrow(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    return ws;
  }

  async list(
    workspaceId: string,
    userId: string,
  ): Promise<{ connections: ConnectorConnectionPublic[] }> {
    await this.workspaceOrThrow(workspaceId);
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    const connections = await this.core.getOAuthConnector().list(workspaceId);
    return { connections };
  }

  async startConnect(
    workspaceId: string,
    userId: string,
    provider: string,
  ): Promise<{ authorize_url: string; provider: ConnectorProviderId }> {
    const ws = await this.workspaceOrThrow(workspaceId);
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "EDITOR");
    if (!PROVIDERS.has(provider as ConnectorProviderId)) {
      throw new BadRequestException({
        code: "unsupported_provider",
        message: "Supported providers: linkedin, facebook, instagram",
      });
    }
    const redirectUri =
      process.env.CONNECTORS_REDIRECT_URI ??
      process.env.LINKEDIN_REDIRECT_URI ??
      `${process.env.API_PUBLIC_URL ?? "http://localhost:3001"}/connectors/oauth/callback`;
    return this.core.getOAuthConnector().startAuthorize({
      organization_id: ws.organizationId,
      workspace_id: workspaceId,
      provider: provider as ConnectorProviderId,
      redirect_uri: redirectUri,
    });
  }

  async handleOAuthCallback(input: {
    code: string;
    state: string;
  }): Promise<ConnectorConnectionPublic> {
    try {
      return await this.core.getOAuthConnector().handleCallback(input);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "OAUTH_INVALID_STATE" || code === "OAUTH_INVALID_CODE") {
        throw new BadRequestException({ code, message: String((err as Error).message) });
      }
      throw err;
    }
  }

  async disconnect(
    workspaceId: string,
    userId: string,
    provider: string,
  ): Promise<{ ok: true }> {
    await this.workspaceOrThrow(workspaceId);
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "EDITOR");
    if (!PROVIDERS.has(provider as ConnectorProviderId)) {
      throw new BadRequestException({
        code: "unsupported_provider",
        message: "Supported providers: linkedin, facebook, instagram",
      });
    }
    await this.core.getOAuthConnector().disconnect({
      workspace_id: workspaceId,
      provider: provider as ConnectorProviderId,
    });
    return { ok: true };
  }

  async listMetaPages(workspaceId: string, userId: string) {
    await this.workspaceOrThrow(workspaceId);
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    return this.core.getOAuthConnector().listMetaPages({ workspace_id: workspaceId });
  }

  async selectMetaPage(workspaceId: string, userId: string, pageId: string) {
    await this.workspaceOrThrow(workspaceId);
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "EDITOR");
    try {
      const connection = await this.core.getOAuthConnector().selectMetaPage({
        workspace_id: workspaceId,
        page_id: pageId,
      });
      if (!connection) {
        throw new NotFoundException({
          code: "not_found",
          message: "No Meta connector connected for this workspace",
        });
      }
      return connection;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "META_PAGE_NOT_FOUND") {
        throw new BadRequestException({ code, message: "Page not found in Meta connection" });
      }
      throw err;
    }
  }
}
