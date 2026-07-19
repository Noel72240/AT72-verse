import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { OrgRole, PrismaClient } from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CreateInvitationInput = {
  organizationId: string;
  email: string;
  role?: OrgRole;
  invitedById: string;
  ttlMs?: number;
};

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  /**
   * Creates a new invitation. Any previous PENDING invite for the same
   * org+email is REVOKED (history retained — Decision D1).
   */
  async create(input: CreateInvitationInput) {
    await this.rbac.requireOrgRole(input.invitedById, input.organizationId, "ADMIN");

    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "Valid email is required",
      });
    }

    const role = input.role ?? "VIEWER";
    if (role === "OWNER") {
      throw new BadRequestException({
        code: "invalid_input",
        message: "Cannot invite as OWNER",
      });
    }

    const existingMember = await this.prisma.membership.findFirst({
      where: {
        organizationId: input.organizationId,
        user: { email },
      },
    });
    if (existingMember) {
      throw new ConflictException({
        code: "conflict",
        message: "User is already a member of this organization",
      });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_INVITE_TTL_MS));

    return this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          organizationId: input.organizationId,
          email,
          status: "PENDING",
        },
        data: { status: "REVOKED" },
      });

      return tx.invitation.create({
        data: {
          organizationId: input.organizationId,
          email,
          role,
          token,
          status: "PENDING",
          invitedById: input.invitedById,
          expiresAt,
        },
      });
    });
  }

  async accept(token: string, acceptorUserId: string, acceptorEmail: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
    });
    if (!invitation) {
      throw new NotFoundException({
        code: "not_found",
        message: "Invitation not found",
      });
    }

    if (invitation.status === "ACCEPTED") {
      throw new ConflictException({
        code: "conflict",
        message: "Invitation already accepted",
      });
    }
    if (invitation.status === "REVOKED") {
      throw new GoneException({
        code: "gone",
        message: "Invitation was revoked",
      });
    }
    if (invitation.status === "EXPIRED" || invitation.expiresAt.getTime() < Date.now()) {
      if (invitation.status === "PENDING") {
        await this.prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
      }
      throw new GoneException({
        code: "gone",
        message: "Invitation expired",
      });
    }
    if (invitation.status !== "PENDING") {
      throw new ConflictException({
        code: "conflict",
        message: "Invitation is not pending",
      });
    }

    const email = acceptorEmail.trim().toLowerCase();
    if (email !== invitation.email) {
      throw new ForbiddenEmailMismatch();
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Single-use: only PENDING can transition to ACCEPTED.
        const updated = await tx.invitation.updateMany({
          where: { id: invitation.id, status: "PENDING", token },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException({
            code: "conflict",
            message: "Invitation already accepted",
          });
        }

        const membership = await tx.membership.upsert({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: acceptorUserId,
            },
          },
          create: {
            organizationId: invitation.organizationId,
            userId: acceptorUserId,
            role: invitation.role,
          },
          update: {},
        });

        const defaultWs = await tx.workspace.findFirst({
          where: {
            organizationId: invitation.organizationId,
            slug: "default",
          },
        });
        if (defaultWs) {
          await tx.workspaceMember.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: defaultWs.id,
                userId: acceptorUserId,
              },
            },
            create: {
              organizationId: invitation.organizationId,
              workspaceId: defaultWs.id,
              userId: acceptorUserId,
              role: "VIEWER",
            },
            update: {},
          });
        }

        return { invitationId: invitation.id, membership, workspaceId: defaultWs?.id ?? null };
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw err;
    }
  }
}

class ForbiddenEmailMismatch extends ForbiddenException {
  constructor() {
    super({
      code: "forbidden",
      message: "Invitation email does not match authenticated user",
    });
  }
}
