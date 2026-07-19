import { ForbiddenException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RBAC_META_KEY, type RbacRequirement } from "./rbac.decorators.js";
import { RbacService } from "./rbac.service.js";

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<RbacRequirement | undefined>(
      RBAC_META_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithAuth & { params: Record<string, string> }>();
    const userId = request.verseAuth?.user.id;
    if (!userId) {
      throw new ForbiddenException({
        code: "forbidden",
        message: "Authenticated Verse user required",
      });
    }

    if (requirement.type === "org") {
      const orgId = request.params[requirement.orgParam ?? "orgId"];
      if (!orgId) {
        throw new ForbiddenException({
          code: "forbidden",
          message: "Missing organization id",
        });
      }
      await this.rbac.requireOrgRole(userId, orgId, requirement.minimum);
      return true;
    }

    const workspaceId = request.params[requirement.workspaceParam ?? "workspaceId"];
    if (!workspaceId) {
      throw new ForbiddenException({
        code: "forbidden",
        message: "Missing workspace id",
      });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, requirement.minimum);
    return true;
  }
}
