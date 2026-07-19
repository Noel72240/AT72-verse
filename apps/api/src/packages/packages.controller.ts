import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { PackagesService } from "./packages.service.js";

type InstallBody = {
  package_id?: string;
  pinned_version?: string;
  workspace_id?: string;
};

type PinBody = {
  pinned_version?: string;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class PackagesController {
  constructor(@Inject(PackagesService) private readonly packages: PackagesService) {}

  @Get("packages")
  listCatalog(@Req() _req: RequestWithAuth) {
    return this.packages.listCatalogPublic();
  }

  @Get("organizations/:organizationId/packages")
  listForOrg(
    @Req() req: RequestWithAuth,
    @Param("organizationId") organizationId: string,
  ) {
    return this.packages.listForOrganization(organizationId, req.verseAuth!.user.id);
  }

  @Post("organizations/:organizationId/packages/install")
  install(
    @Req() req: RequestWithAuth,
    @Param("organizationId") organizationId: string,
    @Body() body: InstallBody,
  ) {
    return this.packages.install(organizationId, req.verseAuth!.user.id, {
      package_id: body.package_id ?? "",
      pinned_version: body.pinned_version,
      workspace_id: body.workspace_id,
    });
  }

  @Post("organizations/:organizationId/packages/:packageId/uninstall")
  uninstall(
    @Req() req: RequestWithAuth,
    @Param("organizationId") organizationId: string,
    @Param("packageId") packageId: string,
  ) {
    return this.packages.uninstall(organizationId, req.verseAuth!.user.id, packageId);
  }

  @Put("organizations/:organizationId/packages/:packageId/pin")
  pin(
    @Req() req: RequestWithAuth,
    @Param("organizationId") organizationId: string,
    @Param("packageId") packageId: string,
    @Body() body: PinBody,
  ) {
    return this.packages.pin(
      organizationId,
      req.verseAuth!.user.id,
      packageId,
      body.pinned_version ?? "",
    );
  }
}
