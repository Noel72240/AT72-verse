/**
 * Phase 34 — PaymentProvider factory + SumUp stub + webhook verify.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createPaymentProvider, planAmountCents } from "./providers/factory.js";
import { SumUpProvider } from "./providers/sumup.provider.js";

describe("PaymentProvider factory", () => {
  afterEach(() => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.SUMUP_API_KEY;
    delete process.env.VERSE_PAYMENT_STUB;
    delete process.env.VERSE_PLAN_PRICE_PRO_CENTS;
  });

  it("defaults to SumUp", () => {
    delete process.env.PAYMENT_PROVIDER;
    const p = createPaymentProvider();
    assert.equal(p.id, "sumup");
  });

  it("selects sumup when PAYMENT_PROVIDER=sumup", () => {
    process.env.PAYMENT_PROVIDER = "sumup";
    assert.equal(createPaymentProvider().id, "sumup");
  });

  it("reads plan amounts from env", () => {
    process.env.VERSE_PLAN_PRICE_PRO_CENTS = "4200";
    assert.equal(planAmountCents("pro"), 4200);
  });
});

describe("SumUpProvider stub", () => {
  afterEach(() => {
    delete process.env.SUMUP_API_KEY;
    delete process.env.VERSE_PAYMENT_STUB;
    delete process.env.SUMUP_WEBHOOK_SECRET;
  });

  it("creates stub checkout without API key", async () => {
    delete process.env.SUMUP_API_KEY;
    process.env.VERSE_PAYMENT_STUB = "1";
    const p = new SumUpProvider();
    const customer = await p.ensureCustomer({
      organization_id: "00000000-0000-4000-8000-000000000001",
      email: "a@b.c",
      name: "Org",
    });
    const checkout = await p.createCheckout({
      organization_id: "00000000-0000-4000-8000-000000000001",
      customer_id: customer.customer_id,
      plan_id: "pro",
      success_url: "http://localhost:3000/billing?success=1",
      cancel_url: "http://localhost:3000/billing?canceled=1",
      amount_cents: 2900,
      currency: "EUR",
    });
    assert.ok(checkout.checkout_id.startsWith("stub_chk_"));
    assert.ok(checkout.checkout_url.includes("stub_checkout="));
  });

  it("parses synthetic webhook payload", async () => {
    const p = new SumUpProvider();
    const event = await p.verifyWebhook({
      headers: {},
      raw_body: JSON.stringify({
        event_id: "evt_1",
        type: "checkout.completed",
        organization_id: "org-1",
        plan_id: "pro",
      }),
    });
    assert.ok(event);
    assert.equal(event?.type, "checkout.completed");
    assert.equal(event?.plan_id, "pro");
  });
});
