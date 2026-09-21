# Privacy retention by entity

Mshwar keeps enough history to honour bookings and accounting. Personal
data is exported, reset, or anonymised through `/api/v1/privacy/*`.

| Entity                                         | Export                                   | Personalisation reset                                            | Account deletion                                                                            |
| ---------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Profile (`users`, `user_private`)              | Display name, email, locale, preferences | Preferences and personalisation consent cleared. Identity stays. | Display name becomes `Deleted user`, email/phone null, status `deleted`, subject rewritten. |
| Sessions / credentials / reset & verify tokens | Not included                             | Unchanged                                                        | Sessions revoked. Credentials and unused tokens removed.                                    |
| Trips                                          | Title, status, created_at                | `preference_overrides` cleared. Trip rows stay.                  | Trip rows stay under the anonymised owner id.                                               |
| Favorites (`account_favorites`)                | Listing slugs                            | Unchanged                                                        | Removed. They are not financial records.                                                    |
| Reviews (`reviews`)                            | Rating and body for the author           | Unchanged                                                        | Rows stay. The author is the anonymised user.                                               |
| Bookings (`account_bookings`, `bookings`)      | Status, policy, reason                   | Unchanged                                                        | Rows stay with the same customer id. Never hard-deleted.                                    |
| Payments / refunds / booking_events            | Not in the traveller JSON (accounting)   | Unchanged                                                        | Kept. Foreign keys point at the anonymised user.                                            |
| Feedback / recommendation runs                 | Not included                             | User id detached, changes cleared                                | Already detached by reset, or left pointing at the anonymised id.                           |
| Notifications (`account_notifications`)        | Not included                             | Unchanged                                                        | Removed.                                                                                    |
| Audit log                                      | Not included                             | New `reset_personalisation` row                                  | New `delete_account` row. Audit rows are immutable.                                         |

Export, personalisation reset, and account deletion are written to `app.audit_log`.
