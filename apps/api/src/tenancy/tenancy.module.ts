import { Module } from "@nestjs/common";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { RbacService } from "../rbac/rbac.service.js";
import { InvitationsController } from "./invitations.controller.js";
import { InvitationsService } from "./invitations.service.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsService } from "./organizations.service.js";
import { WorkspacesController } from "./workspaces.controller.js";
import { WorkspacesService } from "./workspaces.service.js";

@Module({
  controllers: [OrganizationsController, WorkspacesController, InvitationsController],
  providers: [RbacService, RbacGuard, OrganizationsService, WorkspacesService, InvitationsService],
  exports: [RbacService, RbacGuard],
})
export class TenancyModule {}
