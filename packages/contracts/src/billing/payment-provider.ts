/**
 * Billing & Payment Providers (Phase 34).
 * Business types are provider-agnostic.
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";
import type { PlanId } from "../quotas/plan-quotas.js";

export type PaymentProviderId = "sumup" | "stripe";

export type BillingStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid_blocked"
  | "none";

export type OrgBillingPublic = {
  organization_id: UlidOrUuid;
  provider: PaymentProviderId | string;
  status: BillingStatus;
  plan_id: PlanId;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_end: IsoDateTime | null;
  grace_until: IsoDateTime | null;
  updated_at: IsoDateTime;
};

export type BillingInvoicePublic = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: IsoDateTime;
  invoice_url: string | null;
};

export type PaymentWebhookEventType =
  | "checkout.completed"
  | "subscription.updated"
  | "subscription.canceled"
  | "payment.succeeded"
  | "payment.failed";

export type PaymentWebhookEvent = {
  event_id: string;
  type: PaymentWebhookEventType;
  organization_id?: string | null;
  customer_id?: string | null;
  plan_id?: PlanId | null;
  period_end?: IsoDateTime | null;
  metadata?: Record<string, unknown>;
};

/** Port — Verse never imports vendor SDKs outside provider adapters. */
export type PaymentProvider = {
  readonly id: PaymentProviderId;
  ensureCustomer(input: {
    organization_id: string;
    email: string;
    name: string;
    existing_customer_id?: string | null;
  }): Promise<{ customer_id: string }>;
  createCheckout(input: {
    organization_id: string;
    customer_id: string;
    plan_id: Exclude<PlanId, "free">;
    success_url: string;
    cancel_url: string;
    amount_cents: number;
    currency: string;
  }): Promise<{ checkout_id: string; checkout_url: string }>;
  createManageSession(input: {
    customer_id: string;
    return_url: string;
  }): Promise<{ manage_url: string }>;
  cancelSubscription(input: {
    customer_id: string;
    subscription_id?: string | null;
    at_period_end: boolean;
  }): Promise<{ status: BillingStatus; period_end?: IsoDateTime | null }>;
  listInvoices(input: {
    customer_id: string;
  }): Promise<BillingInvoicePublic[]>;
  verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    raw_body: string;
  }): Promise<PaymentWebhookEvent | null>;
};

export const PLAN_PRICE_ENV = {
  pro: "VERSE_PLAN_PRICE_PRO_CENTS",
  enterprise: "VERSE_PLAN_PRICE_ENTERPRISE_CENTS",
} as const;
