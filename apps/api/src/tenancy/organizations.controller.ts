import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { OrganizationsService } from "./organizations.service.js";

type CreateOrgBody = {
  name?: string;
  slug?: string;
};

@Controller("organizations")
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(@Req() req: RequestWithAuth, @Body() body: CreateOrgBody) {
    return this.organizations.create({
      name: body.name ?? "",
      slug: body.slug ?? "",
      creatorUserId: req.verseAuth!.user.id,
    });
  }

  @Get()
  list(@Req() req: RequestWithAuth) {
    return this.organizations.listForUser(req.verseAuth!.user.id);
  }
}
