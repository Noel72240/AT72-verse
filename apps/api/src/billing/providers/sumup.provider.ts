/**
 * SumUp PaymentProvider (Phase 34 MVP).
 * Uses SumUp Checkouts API when credentials present; otherwise local stub mode for CI/dev.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  BillingInvoicePublic,
  BillingStatus,
  PaymentProvider,
  PaymentWebhookEvent,
  PlanId,
} from "@at72-verse/contracts";

const SUMUP_API = "https://api.sumup.com/v0.1";

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function stubMode(): boolean {
  return !env("SUMUP_API_KEY") || process.env.VERSE_PAYMENT_STUB === "1";
}

export class SumUpProvider implements PaymentProvider {
  readonly id = "sumup" as const;

  async ensureCustomer(input: {
    organization_id: string;
    email: string;
    name: string;
    existing_customer_id?: string | null;
  }): Promise<{ customer_id: string }> {
    if (input.existing_customer_id) {
      return { customer_id: input.existing_customer_id };
    }
    const customerId = `org_${input.organization_id.replace(/-/g, "").slice(0, 24)}`;
    if (stubMode()) {
      return { customer_id: customerId };
    }
    const res = await fetch(`${SUMUP_API}/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("SUMUP_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer_id: customerId,
        personal_details: {
          email: input.email,
          first_name: input.name.slice(0, 40) || "Org",
        },
      }),
    });
    if (!res.ok && res.status !== 409) {
      const text = await res.text();
      throw new Error(`SumUp create customer failed: ${res.status} ${text}`);
    }
    return { customer_id: customerId };
  }

  async createCheckout(input: {
    organization_id: string;
    customer_id: string;
    plan_id: Exclude<PlanId, "free">;
    success_url: string;
    cancel_url: string;
    amount_cents: number;
    currency: string;
  }): Promise<{ checkout_id: string; checkout_url: string }> {
    const reference = `verse_${input.organization_id}_${input.plan_id}_${Date.now()}`;
    if (stubMode()) {
      const checkoutId = `stub_chk_${reference}`;
      const checkoutUrl = `${input.success_url}${input.success_url.includes("?") ? "&" : "?"}stub_checkout=${checkoutId}&plan=${input.plan_id}&org=${input.organization_id}`;
      return { checkout_id: checkoutId, checkout_url: checkoutUrl };
    }
    const merchant = env("SUMUP_MERCHANT_CODE");
    if (!merchant) throw new Error("SUMUP_MERCHANT_CODE required");
    const amount = Math.max(0.5, input.amount_cents / 100);
    const res = await fetch(`${SUMUP_API}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("SUMUP_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference: reference,
        amount,
        currency: input.currency.toUpperCase(),
        merchant_code: merchant,
        description: `AT72 Verse ${input.plan_id}`,
        customer_id: input.customer_id,
        redirect_url: input.success_url,
        hosted_checkout: { enabled: true },
        metadata: {
          organization_id: input.organization_id,
          plan_id: input.plan_id,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SumUp create checkout failed: ${res.status} ${text}`);
    }
    const body = (await res.json()) as {
      id?: string;
      hosted_checkout_url?: string;
    };
    if (!body.id || !body.hosted_checkout_url) {
      throw new Error("SumUp checkout missing id or hosted_checkout_url");
    }
    return { checkout_id: body.id, checkout_url: body.hosted_checkout_url };
  }

  async createManageSession(input: {
    customer_id: string;
    return_url: string;
  }): Promise<{ manage_url: string }> {
    // SumUp has no Stripe-like Customer Portal — return app billing URL.
    void input.customer_id;
    return { manage_url: input.return_url };
  }

  async cancelSubscription(input: {
    customer_id: string;
    subscription_id?: string | null;
    at_period_end: boolean;
  }): Promise<{ status: BillingStatus; period_end?: string | null }> {
    void input.customer_id;
    void input.subscription_id;
    const periodEnd = input.at_period_end
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    return {
      status: input.at_period_end ? "active" : "canceled",
      period_end: periodEnd,
    };
  }

  async listInvoices(_input: {
    customer_id: string;
  }): Promise<BillingInvoicePublic[]> {
    // MVP: invoices derived from payment_events locally — empty from provider.
    return [];
  }

  async verifyWebhook(input: {
    headers: Record<string, string | string[] | undefined>;
    raw_body: string;
  }): Promise<PaymentWebhookEvent | null> {
    const secret = env("SUMUP_WEBHOOK_SECRET");
    if (secret) {
      const sigHeader = input.headers["x-payload-signature"] ?? input.headers["x-sumup-signature"];
      const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      if (!sig) return null;
      const expected = createHmac("sha256", secret).update(input.raw_body).digest("hex");
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input.raw_body) as Record<string, unknown>;
    } catch {
      return null;
    }

    // Stub / synthetic events for local: { event_id, type, organization_id, plan_id, ... }
    if (typeof parsed.event_id === "string" && typeof parsed.type === "string") {
      return {
        event_id: parsed.event_id,
        type: parsed.type as PaymentWebhookEvent["type"],
        organization_id: (parsed.organization_id as string) ?? null,
        customer_id: (parsed.customer_id as string) ?? null,
        plan_id: (parsed.plan_id as PlanId) ?? null,
        period_end: (parsed.period_end as string) ?? null,
        metadata: { provider: "sumup" },
      };
    }

    // Best-effort SumUp checkout event shapes
    const id = String(parsed.id ?? parsed.event_id ?? "");
    if (!id) return null;
    const status = String(parsed.status ?? "").toUpperCase();
    const meta = (parsed.metadata ?? {}) as Record<string, unknown>;
    if (status === "PAID" || status === "SUCCESSFUL") {
      return {
        event_id: id,
        type: "checkout.completed",
        organization_id: (meta.organization_id as string) ?? null,
        customer_id: (parsed.customer_id as string) ?? null,
        plan_id: (meta.plan_id as PlanId) ?? null,
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { status },
      };
    }
    if (status === "FAILED") {
      return {
        event_id: id,
        type: "payment.failed",
        organization_id: (meta.organization_id as string) ?? null,
        customer_id: (parsed.customer_id as string) ?? null,
        metadata: { status },
      };
    }
    return null;
  }
}
