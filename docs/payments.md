# Payments (Epic 9)

Snapshots, idempotency and reconciliation are required. The booking service never imports a card-network SDK type.

## Environment stubs

| Variable                | Default       | Notes                                                                                      |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`     | empty         | Empty keeps `StripeTestAdapter` in local stub mode. Do not commit live keys.               |
| `STRIPE_WEBHOOK_SECRET` | empty         | Empty signs/verifies webhooks with the local stub secret.                                  |
| `PAYMENT_PROVIDER`      | `stripe_test` | `stripe_test` or `lebanon_acquirer`. Booking code talks only to `PaymentProvider`.         |
| `PAYMENTS_FAULT`        | empty         | Test-only: `fail`, `timeout`, `late_success`. Ignored for production payment confirmation. |
| `IDEMPOTENCY_TTL_HOURS` | `24`          | Booking and payment write keys expire after 24 hours (`app.idempotency_keys`).             |

`POST /api/v1/checkout/{id}/simulate` is disabled when `environment=production`.

## Lebanon constraint

Lebanon is not listed on Stripe's global availability page. Stripe test mode is acceptable for the academic demo. A production pilot must:

1. Keep the `PaymentProvider` interface.
2. Select a licensed local acquirer (or a Stripe-licensed partner that can settle in Lebanon).
3. Store provider references (`payments.external_id`) separately from `bookings.id`.
4. Never confirm paid inventory without a verified successful payment.

Candidate options for the pilot decision (not a legal recommendation): a Lebanese acquiring bank, a regional PSP with a Lebanon licence, or a manual transfer adapter (`lebanon_acquirer` stub) until an acquirer is contracted.

## Idempotency

- Header `Idempotency-Key` (min 8 chars) on checkout commit and payment writes.
- Keys are stored in `app.idempotency_keys` with a 24-hour TTL.
- Reusing a key with a different body hash is rejected.
- `app.bookings.request_key` remains the inventory-level unique key.

## Reconciliation

`GET /api/v1/admin/payments/reconciliation` lists open mismatches (paid-but-unconfirmed, confirmed-but-unpaid). `POST /api/v1/admin/payments/reconcile` refreshes the queue from `app.booking_financial_status`.
