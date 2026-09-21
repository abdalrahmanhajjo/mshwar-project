# Notifications & messaging (Epic 10)

Transactional messages are triggered by persisted events through `app.outbox`. Delivery never runs inside the booking or payment write. A failed email cannot create, confirm, or duplicate a booking or charge.

## Event taxonomy

| Event                         | Audience       | Category      | Typical deep link               |
| ----------------------------- | -------------- | ------------- | ------------------------------- |
| `booking.requested`           | Traveller      | transactional | `/bookings?highlight=`          |
| `booking.confirmed`           | Traveller      | transactional | `/bookings?highlight=`          |
| `booking.rejected`            | Traveller      | transactional | `/bookings?highlight=`          |
| `booking.cancelled`           | Traveller      | transactional | `/bookings?highlight=`          |
| `payment.status_changed`      | Traveller      | transactional | `/bookings?highlight=`          |
| `itinerary.material_change`   | Traveller      | transactional | `/trips?highlight=`             |
| `business.booking.requested`  | Business staff | transactional | `/business/bookings?highlight=` |
| `business.request.unanswered` | Business staff | transactional | `/business/bookings?highlight=` |
| `marketing.campaign`          | Traveller      | marketing     | `/unsubscribe/{token}`          |

Epic 9 (and later) should call `app.emit_notification_event(event, aggregate_id, user_id, org_id, payload)` in the same transaction as the state change. Marketplace `app.bookings` and `app.payments` also emit from AFTER triggers so a later booking PR composes without a second wire-up. Hub preview bookings (`account_bookings`) emit from `create_my_booking` / `cancel_my_booking`.

## Channels

`NotificationChannel` in `services/api/app/core/notifications/channels.py`:

- **in-app** — writes `app.account_notifications` (the `/notifications` feed) and records an attempt.
- **email** — SMTP when `SMTP_HOST` is set, SendGrid when `SENDGRID_API_KEY` is set, otherwise a **stub** that records `stubbed` (counts as delivered). Empty keys are the CI default.

Marketing email always includes a working unsubscribe URL. Opting out of marketing never suppresses a transactional message.

## Retry and dead-letter

| Setting                     | Default                               | Notes                                                                       |
| --------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `NOTIFICATION_MAX_ATTEMPTS` | `8`                                   | After this, the row is dead-lettered                                        |
| Backoff                     | `2^(attempt-1)` minutes               | Capped at 1440 minutes                                                      |
| Dispatch                    | `POST /api/v1/notifications/dispatch` | Cron this. Empty `NOTIFICATION_DISPATCH_TOKEN` is allowed in development/CI |
| Escalation                  | `POST /api/v1/notifications/escalate` | Unanswered `request` bookings; per-org schedule                             |

Manual resend is `POST /api/v1/admin/notifications/{id}/resend` with a reason (audit log). It only re-queues delivery.

## Environment

| Variable                          | Default                | Notes                                                                 |
| --------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `SMTP_HOST`                       | empty                  | Empty = stub email                                                    |
| `SMTP_PORT`                       | `587`                  | Used only when `SMTP_HOST` is set                                     |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | empty                  | Optional AUTH                                                         |
| `SMTP_FROM`                       | `noreply@mshwar.local` | Envelope sender                                                       |
| `SENDGRID_API_KEY`                | empty                  | Alternative provider. Empty keeps the stub                            |
| `NOTIFICATION_MAX_ATTEMPTS`       | `8`                    | Dead-letter limit                                                     |
| `NOTIFICATION_DISPATCH_TOKEN`     | empty                  | Required in production for `/notifications/dispatch`                  |
| `NOTIFICATION_WORKER_BATCH_SIZE`  | `25`                   | Claim batch                                                           |
| `MAILER_BACKEND`                  | `console`              | Auth mailer (reset/verify). Booking mail uses the notification worker |

Production still requires `DATABASE_URL`, `SECRET_KEY`, and `GOOGLE_MAPS_API_KEY`. SMTP is not required.

## Admin

`/admin/notifications` (Epic 6 console) shows outbox depth, dead letters, per-channel rates, recent failures, and resend. KPI tiles on `/admin` include email delivery/failure rates.
