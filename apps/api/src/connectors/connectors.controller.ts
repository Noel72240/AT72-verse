import {
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { ConnectorsService } from "./connectors.service.js";

@Controller()
export class ConnectorsController {
  constructor(@Inject(ConnectorsService) private readonly connectors: ConnectorsService) {}

  @Get("workspaces/:workspaceId/connectors")
  @UseGuards(AuthGuard, RbacGuard)
  @RequireWorkspaceMember("VIEWER")
  list(@Req() req: RequestWithAuth, @Param("workspaceId") workspaceId: string) {
    return this.connectors.list(workspaceId, req.verseAuth!.user.id);
  }

  @Post("workspaces/:workspaceId/connectors/:provider/connect")
  @UseGuards(AuthGuard, RbacGuard)
  @RequireWorkspaceMember("EDITOR")
  connect(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("provider") provider: string,
  ) {
    return this.connectors.startConnect(workspaceId, req.verseAuth!.user.id, provider);
  }

  @Delete("workspaces/:workspaceId/connectors/:provider")
  @UseGuards(AuthGuard, RbacGuard)
  @RequireWorkspaceMember("EDITOR")
  disconnect(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("provider") provider: string,
  ) {
    return this.connectors.disconnect(workspaceId, req.verseAuth!.user.id, provider);
  }

  /**
   * OAuth callback — API ↔ Core only.
   * Query `code` + `state` are consumed by Core OAuthConnector; never forwarded to Runtime/Host/Agents.
   * Stub mode (VERSE_OAUTH_STUB): if LinkedIn redirects are unavailable, UI may call with a synthetic code
   * after extracting state from authorize_url (dev only).
   */
  @Get("connectors/oauth/callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("stub_code") stubCode: string | undefined,
    @Res() res: Response,
  ) {
    const effectiveCode = code ?? stubCode ?? "";
    const connection = await this.connectors.handleOAuthCallback({
      code: effectiveCode,
      state: state ?? "",
    });
    const webBase = process.env.WEB_PUBLIC_URL ?? "http://localhost:3000";
    const dest = new URL("/connectors", webBase);
    dest.searchParams.set("connected", connection.provider);
    dest.searchParams.set("status", connection.status);
    return res.redirect(dest.toString());
  }
}
