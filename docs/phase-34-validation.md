# Phase 34 — Validation / checklist PO

**Date :** 2026-07-19  
**Pack :** EE\* Accepted (+ EE-rename · EE-provider · EE-sumup · EE-config)  
**Statut livraison :** **Validée PO (2026-07-19)**  
**Gel :** **aucune Phase 35** sans pack de décisions dédié présenté et validé

## Amendements confirmés PO

| ID | Règle | Preuve |
|----|-------|--------|
| EE-rename | Phase = **Billing & Payment Providers** | ROADMAP · ce fichier · décisions |
| EE-provider | Métier → `PaymentProvider` only | `packages/contracts/.../payment-provider.ts` · `BillingService` |
| EE-sumup | MVP = SumUp · Stripe stub futur | `SumUpProvider` · `StripeProvider` stub · `PAYMENT_PROVIDER=sumup` |
| EE-config | Config générique + vars provider | `.env.example` · `createPaymentProvider()` |

## Checklist EE10 (atteinte)

| # | Livrable | Preuve |
|---|----------|--------|
| 1 | Port `PaymentProvider` | contracts `0.1.25` |
| 2 | SumUp adapter (+ stub CI) | `sumup.provider.ts` · tests |
| 3 | Stripe stub (non actif) | `stripe.provider.ts` |
| 4 | Schema `organization_billing` + `payment_events` | Prisma + migration |
| 5 | API checkout / manage / cancel / invoices | `BillingController` |
| 6 | Webhooks idempotents | `POST /webhooks/payments` · `payment_events.event_id` unique |
| 7 | Plan mapping free/pro/enterprise | webhook `checkout.completed` → `org.planId` |
| 8 | Grace + soft-block 402 | `assertPaymentAllowsUsage` · QuotasService gates |
| 9 | UI `/billing` | `BillingAdmin` |
| 10 | Secrets / env | `.env.example` · pas de clés en code |

## Hors scope (gel)

Phase 35 onboarding · Stripe live · fiscalité multi-pays · metered LLM.
