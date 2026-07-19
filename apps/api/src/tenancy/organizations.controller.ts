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

  @Get()
  async list(@Req() req: RequestWithAuth) {
    try {
      const userId = req.verseAuth?.user?.id;
      if (!userId) {
        return { diagnostic: "missing_verse_auth_user" };
      }
      return await this.organizations.listForUser(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[organizations.controller.list]", message);
      return { diagnostic: "list_threw", message };
    }
  }

  @Post()
  async create(@Req() req: RequestWithAuth, @Body() body: CreateOrgBody) {
    try {
      return await this.organizations.create({
        name: body.name ?? "",
        slug: body.slug ?? "",
        creatorUserId: req.verseAuth!.user.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[organizations.controller.create]", message);
      return { diagnostic: "create_threw", message };
    }
  }
}
