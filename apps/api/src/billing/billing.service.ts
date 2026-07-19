import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BillingStatus,
  OrgBillingPublic,
  PaymentProvider,
  PaymentWebhookEvent,
  PlanId,
} from "@at72-verse/contracts";
import { appendAuditEvent, isPlanId, type PrismaClient } from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";
import {
  billingCurrency,
  billingGraceDays,
  createPaymentProvider,
  planAmountCents,
} from "./providers/factory.js";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

function toPublic(
  orgId: string,
  planId: string,
  row: {
    provider: string;
    status: string;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
    graceUntil: Date | null;
    updatedAt: Date;
  } | null,
): OrgBillingPublic {
  return {
    organization_id: orgId,
    provider: row?.provider ?? process.env.PAYMENT_PROVIDER ?? "sumup",
    status: (row?.status as BillingStatus) ?? "none",
    plan_id: isPlanId(planId) ? planId : "free",
    provider_customer_id: row?.providerCustomerId ?? null,
    provider_subscription_id: row?.providerSubscriptionId ?? null,
    current_period_end: row?.currentPeriodEnd?.toISOString() ?? null,
    grace_until: row?.graceUntil?.toISOString() ?? null,
    updated_at: (row?.updatedAt ?? new Date()).toISOString(),
  };
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  async getStatus(organizationId: string, userId: string): Promise<OrgBillingPublic> {
    await this.rbac.requireOrgRole(userId, organizationId, "ADMIN");
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException({ code: "not_found", message: "Organization not found" });
    const billing = await this.prisma.organizationBillingRow.findUnique({
      where: { organizationId },
    });
    return toPublic(organizationId, org.planId, billing);
  }

  async startCheckout(
    organizationId: string,
    userId: string,
    targetPlan: "pro" | "enterprise",
    urls: { success_url: string; cancel_url: string },
  ) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException({ code: "not_found", message: "Organization not found" });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    let billing = await this.prisma.organizationBillingRow.findUnique({
      where: { organizationId },
    });
    const customer = await this.payments.ensureCustomer({
      organization_id: organizationId,
      email: user.email,
      name: org.name,
      existing_customer_id: billing?.providerCustomerId,
    });
    if (!billing) {
      billing = await this.prisma.organizationBillingRow.create({
        data: {
          organizationId,
          provider: this.payments.id,
          status: "none",
          providerCustomerId: customer.customer_id,
        },
      });
    } else if (!billing.providerCustomerId) {
      billing = await this.prisma.organizationBillingRow.update({
        where: { organizationId },
        data: { providerCustomerId: customer.customer_id, provider: this.payments.id },
      });
    }

    const checkout = await this.payments.createCheckout({
      organization_id: organizationId,
      customer_id: customer.customer_id,
      plan_id: targetPlan,
      success_url: urls.success_url,
      cancel_url: urls.cancel_url,
      amount_cents: planAmountCents(targetPlan),
      currency: billingCurrency(),
    });

    await appendAuditEvent(this.prisma, {
      organization_id: organizationId,
      actor_user_id: userId,
      action: "billing.checkout.started",
      resource_type: "organization",
      resource_id: organizationId,
      metadata: { plan_id: targetPlan, provider: this.payments.id },
    });

    // Stub mode: complete immediately via synthetic webhook path
    if (process.env.VERSE_PAYMENT_STUB === "1" || !process.env.SUMUP_API_KEY) {
      await this.applyWebhookEvent({
        event_id: `stub_complete_${checkout.checkout_id}`,
        type: "checkout.completed",
        organization_id: organizationId,
        customer_id: customer.customer_id,
        plan_id: targetPlan,
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return checkout;
  }

  async openManage(organizationId: string, userId: string, returnUrl: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    const billing = await this.prisma.organizationBillingRow.findUnique({
      where: { organizationId },
    });
    if (!billing?.providerCustomerId) {
      return { manage_url: returnUrl };
    }
    return this.payments.createManageSession({
      customer_id: billing.providerCustomerId,
      return_url: returnUrl,
    });
  }

  async cancel(organizationId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    const billing = await this.prisma.organizationBillingRow.findUnique({
      where: { organizationId },
    });
    if (!billing?.providerCustomerId) {
      throw new HttpException(
        { code: "invalid_input", message: "No active billing customer" },
        HttpStatus.BAD_REQUEST,
      );
    }
    const result = await this.payments.cancelSubscription({
      customer_id: billing.providerCustomerId,
      subscription_id: billing.providerSubscriptionId,
      at_period_end: true,
    });
    await this.prisma.organizationBillingRow.update({
      where: { organizationId },
      data: {
        status: result.status,
        currentPeriodEnd: result.period_end ? new Date(result.period_end) : billing.currentPeriodEnd,
      },
    });
    await appendAuditEvent(this.prisma, {
      organization_id: organizationId,
      actor_user_id: userId,
      action: "billing.subscription.cancel_requested",
      resource_type: "organization",
      resource_id: organizationId,
      metadata: { provider: this.payments.id },
    });
    return this.getStatus(organizationId, userId);
  }

  async listInvoices(organizationId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    const billing = await this.prisma.organizationBillingRow.findUnique({
      where: { organizationId },
    });
    if (!billing?.providerCustomerId) return { invoices: [] };
    const invoices = await this.payments.listInvoices({
      customer_id: billing.providerCustomerId,
    });
    return { invoices };
  }

  /** Soft-block gate (EE7) — call before createRun / install agent. */
  async assertPaymentAllowsUsage(organizationId: string): Promise<void> {
    const billing = await this.prisma.organizationBillingRow.findUnique({
      where: { organizationId },
    });
    if (!billing) return;

    const now = Date.now();
    let status = billing.status;

    if (status === "past_due") {
      if (billing.graceUntil && billing.graceUntil.getTime() > now) {
        return;
      }
      await this.prisma.organizationBillingRow.update({
        where: { organizationId },
        data: { status: "unpaid_blocked" },
      });
      status = "unpaid_blocked";
    }

    if (status === "unpaid_blocked") {
      throw new HttpException(
        {
          code: "PAYMENT_REQUIRED",
          message: "Organization billing is unpaid — update payment method",
          upgrade_hint: "Open /billing to manage subscription",
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async handleRawWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<{ ok: boolean; duplicate?: boolean }> {
    const event = await this.payments.verifyWebhook({ headers, raw_body: rawBody });
    if (!event) {
      throw new ForbiddenException({ code: "forbidden", message: "Invalid webhook" });
    }
    return this.applyWebhookEvent(event);
  }

  async applyWebhookEvent(
    event: PaymentWebhookEvent,
  ): Promise<{ ok: boolean; duplicate?: boolean }> {
    try {
      await this.prisma.paymentEventRow.create({
        data: {
          eventId: event.event_id,
          organizationId: event.organization_id ?? null,
          provider: this.payments.id,
          type: event.type,
          payloadSummary: {
            type: event.type,
            plan_id: event.plan_id ?? null,
            customer_id: event.customer_id ?? null,
          },
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique/i.test(msg)) {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    const orgId = event.organization_id;
    if (!orgId) return { ok: true };

    if (event.type === "checkout.completed" || event.type === "payment.succeeded") {
      const planId = event.plan_id && isPlanId(event.plan_id) ? event.plan_id : null;
      if (planId && planId !== "free") {
        await this.prisma.organization.update({
          where: { id: orgId },
          data: { planId },
        });
      }
      await this.prisma.organizationBillingRow.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          provider: this.payments.id,
          status: "active",
          providerCustomerId: event.customer_id ?? null,
          currentPeriodEnd: event.period_end ? new Date(event.period_end) : null,
        },
        update: {
          status: "active",
          providerCustomerId: event.customer_id ?? undefined,
          graceUntil: null,
          currentPeriodEnd: event.period_end ? new Date(event.period_end) : undefined,
        },
      });
    }

    if (event.type === "payment.failed") {
      const grace = new Date(Date.now() + billingGraceDays() * 24 * 60 * 60 * 1000);
      await this.prisma.organizationBillingRow.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          provider: this.payments.id,
          status: "past_due",
          graceUntil: grace,
          providerCustomerId: event.customer_id ?? null,
        },
        update: {
          status: "past_due",
          graceUntil: grace,
        },
      });
    }

    if (event.type === "subscription.canceled") {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { planId: "free" },
      });
      await this.prisma.organizationBillingRow.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          provider: this.payments.id,
          status: "canceled",
        },
        update: { status: "canceled", currentPeriodEnd: null },
      });
    }

    await appendAuditEvent(this.prisma, {
      organization_id: orgId,
      action: `billing.${event.type}`,
      resource_type: "organization",
      resource_id: orgId,
      metadata: { provider: this.payments.id, event_id: event.event_id },
    });

    return { ok: true };
  }
}

export { createPaymentProvider };
