/**
 * Phase 34 — soft-block gate (402 PAYMENT_REQUIRED).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpException, HttpStatus } from "@nestjs/common";
import { BillingService } from "./billing.service.js";
import type { PaymentProvider } from "@at72-verse/contracts";

function mockPrisma(billing: {
  status: string;
  graceUntil: Date | null;
} | null) {
  return {
    organizationBillingRow: {
      findUnique: async () =>
        billing
          ? {
              organizationId: "org-1",
              status: billing.status,
              graceUntil: billing.graceUntil,
            }
          : null,
      update: async ({ data }: { data: { status: string } }) => ({
        status: data.status,
      }),
    },
  };
}

const noopPayments = {} as PaymentProvider;
const noopRbac = {} as ConstructorParameters<typeof BillingService>[2];

describe("BillingService.assertPaymentAllowsUsage", () => {
  it("allows when no billing row", async () => {
    const svc = new BillingService(mockPrisma(null) as never, noopPayments, noopRbac);
    await svc.assertPaymentAllowsUsage("org-1");
  });

  it("allows past_due within grace", async () => {
    const svc = new BillingService(
      mockPrisma({
        status: "past_due",
        graceUntil: new Date(Date.now() + 60_000),
      }) as never,
      noopPayments,
      noopRbac,
    );
    await svc.assertPaymentAllowsUsage("org-1");
  });

  it("blocks unpaid_blocked with 402 PAYMENT_REQUIRED", async () => {
    const svc = new BillingService(
      mockPrisma({ status: "unpaid_blocked", graceUntil: null }) as never,
      noopPayments,
      noopRbac,
    );
    try {
      await svc.assertPaymentAllowsUsage("org-1");
      assert.fail("expected HttpException");
    } catch (err) {
      assert.ok(err instanceof HttpException);
      assert.equal(err.getStatus(), HttpStatus.PAYMENT_REQUIRED);
      const body = err.getResponse() as { code: string };
      assert.equal(body.code, "PAYMENT_REQUIRED");
    }
  });

  it("blocks past_due after grace and flips to unpaid_blocked", async () => {
    let updated: string | null = null;
    const prisma = {
      organizationBillingRow: {
        findUnique: async () => ({
          organizationId: "org-1",
          status: "past_due",
          graceUntil: new Date(Date.now() - 1000),
        }),
        update: async ({ data }: { data: { status: string } }) => {
          updated = data.status;
          return data;
        },
      },
    };
    const svc = new BillingService(prisma as never, noopPayments, noopRbac);
    try {
      await svc.assertPaymentAllowsUsage("org-1");
      assert.fail("expected HttpException");
    } catch (err) {
      assert.ok(err instanceof HttpException);
      assert.equal(err.getStatus(), HttpStatus.PAYMENT_REQUIRED);
      assert.equal(updated, "unpaid_blocked");
    }
  });
});
