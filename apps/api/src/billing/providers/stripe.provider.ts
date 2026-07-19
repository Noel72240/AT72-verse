/**
 * Stripe PaymentProvider — future adapter (Phase 34 stub).
 * Not selected when PAYMENT_PROVIDER=sumup.
 */
import type {
  BillingInvoicePublic,
  BillingStatus,
  PaymentProvider,
  PaymentWebhookEvent,
} from "@at72-verse/contracts";

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe" as const;

  private notEnabled(): never {
    throw new Error(
      "StripeProvider is not active. Set PAYMENT_PROVIDER=stripe when implemented; MVP is SumUp.",
    );
  }

  ensureCustomer(_input: {
    organization_id: string;
    email: string;
    name: string;
    existing_customer_id?: string | null;
  }): Promise<{ customer_id: string }> {
    return this.notEnabled();
  }
  createCheckout(_input: {
    organization_id: string;
    customer_id: string;
    plan_id: "pro" | "enterprise";
    success_url: string;
    cancel_url: string;
    amount_cents: number;
    currency: string;
  }): Promise<{ checkout_id: string; checkout_url: string }> {
    return this.notEnabled();
  }
  createManageSession(_input: {
    customer_id: string;
    return_url: string;
  }): Promise<{ manage_url: string }> {
    return this.notEnabled();
  }
  cancelSubscription(_input: {
    customer_id: string;
    subscription_id?: string | null;
    at_period_end: boolean;
  }): Promise<{ status: BillingStatus; period_end?: string | null }> {
    return this.notEnabled();
  }
  listInvoices(_input: { customer_id: string }): Promise<BillingInvoicePublic[]> {
    return this.notEnabled();
  }
  verifyWebhook(_input: {
    headers: Record<string, string | string[] | undefined>;
    raw_body: string;
  }): Promise<PaymentWebhookEvent | null> {
    return this.notEnabled();
  }
}
