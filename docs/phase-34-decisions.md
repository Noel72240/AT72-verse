# Phase 34 — Pack de décisions (EE\*) — Accepted PO

**Statut :** **Accepted (PO 2026-07-19)**  
**Titre phase :** **Billing & Payment Providers** (amendement — plus « Billing Stripe »)  
**Amendements PO :**  
1. **EE-rename** — phase renommée **Billing & Payment Providers**  
2. **EE-provider** — abstraction **`PaymentProvider`** · métier Verse **jamais** couplé à un vendor  
3. **EE-sumup** — provider MVP = **SumUp** · Stripe = provider optionnel futur  
4. **EE-config** — `PAYMENT_PROVIDER=sumup` + variables propres au provider  
**Date :** 2026-07-19  
**Prérequis :** Phase **33 validée** (commit `978b1c3`) · Phase **31** quotas  
**Lot :** **Billing & Payment Providers**  
**Implémentation :** **34 validée PO** · **Phase 35 = pack décisions dédié** (pas d’auto)

---

## Objectif

Monétiser le SaaS via un **port paiement** : checkout · portail / manage · webhooks idempotents · mapping plan technique ↔ quotas · grace unpaid · soft-block · UI Billing — **indépendant du vendor**.

---

## Architecture paiement (amendements)

```text
API / BillingService  →  PaymentProvider (port)
                              ├── SumUpProvider        ← MVP (P34)
                              ├── StripeProvider       ← futur (stub / hors scope actif)
                              └── … autres
```

- Toute logique métier (plans, quotas, soft-block, audit, états) dépend **uniquement** de `PaymentProvider`.  
- Changer de vendor = nouvelle implémentation du port · **pas** de rewrite métier.

### Config générique

```bash
PAYMENT_PROVIDER=sumup          # sumup | stripe (stripe non actif P34)
# SumUp (quand PAYMENT_PROVIDER=sumup)
SUMUP_API_KEY=
SUMUP_MERCHANT_CODE=
SUMUP_WEBHOOK_SECRET=           # si applicable
# Montants plans (cents) — métier Verse, pas vendor-specific names
VERSE_PLAN_PRICE_PRO_CENTS=2900
VERSE_PLAN_PRICE_ENTERPRISE_CENTS=9900
VERSE_BILLING_GRACE_DAYS=3
```

---

## Décisions Accepted

| ID | Décision |
|----|----------|
| EE1 | MVP billing : checkout · manage · webhooks · plan↔quota · grace · soft-block · UI · gel P35 |
| EE2-A | Unité = **Organization** (1 customer provider / org) |
| EE3-A | Mapping plan `free`/`pro`/`enterprise` via config montants / price refs **provider-agnostic** |
| EE3bis-A | Changement de plan **conserve** overrides quotas numériques |
| EE4-A | Checkout hosted via `PaymentProvider.createCheckout` · manage via `createManageSession` (si supporté sinon URL app) |
| EE5-A | Webhooks `PaymentProvider.verifyWebhook` · table `payment_events` idempotente |
| EE6-A | Statuts `active` · `past_due` · `canceled` · `unpaid_blocked` |
| EE6bis-A | Cancel fin de période (géré côté Verse + provider) |
| EE6ter-A | Grace **3 j** (`VERSE_BILLING_GRACE_DAYS`) |
| EE7-A | Soft-block : bloquer createRun + install agent · autoriser billing/lecture/RGPD |
| EE8-A | Persistance `organization_billing` + `payment_events` (noms génériques) |
| EE9-A | API + UI `/billing` |
| **EE-provider** | Port `PaymentProvider` · SumUp MVP · Stripe futur |
| EE10–EE12 | Secrets · tests · gel P35 |

### EE7 — Soft-block

Erreur : **402** `PAYMENT_REQUIRED` (pas 429 quota) + hint portal/billing.

---

## Hors scope P34

- Activation Stripe live (stub OK)  
- Fiscalité multi-pays · metered LLM  
- Phase 35 onboarding  

---

## Prochaine étape

1. **Pack Phase 35** soumis PO · **aucune implémentation** sans validation.  
2. Pas d’auto-enchaînement.
