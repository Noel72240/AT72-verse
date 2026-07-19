/**
 * PaymentProvider factory (Phase 34 / EE-config).
 * PAYMENT_PROVIDER=sumup|stripe — business code never branches on vendor APIs.
 */
import type { PaymentProvider } from "@at72-verse/contracts";
import { StripeProvider } from "./stripe.provider.js";
import { SumUpProvider } from "./sumup.provider.js";

export function createPaymentProvider(): PaymentProvider {
  const id = (process.env.PAYMENT_PROVIDER ?? "sumup").trim().toLowerCase();
  if (id === "stripe") {
    return new StripeProvider();
  }
  return new SumUpProvider();
}

export function planAmountCents(planId: "pro" | "enterprise"): number {
  const key =
    planId === "pro" ? "VERSE_PLAN_PRICE_PRO_CENTS" : "VERSE_PLAN_PRICE_ENTERPRISE_CENTS";
  const raw = process.env[key];
  const n = raw ? Number(raw) : planId === "pro" ? 2900 : 9900;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : planId === "pro" ? 2900 : 9900;
}

export function billingGraceDays(): number {
  const n = Number(process.env.VERSE_BILLING_GRACE_DAYS ?? "3");
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
}

export function billingCurrency(): string {
  return (process.env.VERSE_BILLING_CURRENCY ?? "EUR").toUpperCase();
}
