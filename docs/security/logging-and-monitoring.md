# Logs, request IDs and error reporting

Story: MSHWAR-111 · Code: `services/api/app/core/scrubber.py`, `logging.py`, `request_context.py`, `observability.py`; `apps/web/src/proxy.ts`, `src/lib/observability/`

## One ID per request

1. The web proxy (`apps/web/src/proxy.ts`) gives every request an `X-Request-ID`.
2. The API keeps a well-formed incoming ID or creates a new one, and returns it in the `X-Request-ID` response header.
3. The same ID appears in:
   - every API log line (`request_id`);
   - every error body (`"request_id": "…"`);
   - Sentry events (tag `request_id`);
   - audit log rows (`request_id`), through the `app.request_id` database setting.

When a user reports a problem, ask for the ID shown with the error; it leads straight to the logs, the Sentry event and any audit rows.

## Nothing secret or personal in logs

`app/core/scrubber.py` holds the list of sensitive field names, in three groups:

- **credentials**: passwords, tokens, cookies, API keys, signatures, DSNs;
- **payment**: card and bank details, payment references;
- **personal**: email, phone, names, addresses, dates of birth, free-text notes.

Values under those names are replaced with `[redacted]`, and patterns such as email addresses, phone numbers, bearer tokens and card numbers are removed from free text (messages, exceptions, URLs).
The filter is attached to the `mshwar`, `uvicorn` and `sqlalchemy` loggers. `SQL_ECHO` (which logs query parameters) is refused in staging and production.
Validation errors never echo what the user typed.

## Log format

`LOG_FORMAT=json` (default) writes one JSON object per line with `ts`, `level`, `logger`, `message`, `request_id`, any extra fields and a scrubbed `exc_info`. `LOG_FORMAT=text` is for local use.

## Sentry

| Setting                           | Where              | Effect                                                                                              |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                      | API and web server | server errors are reported                                                                          |
| `NEXT_PUBLIC_SENTRY_DSN`          | web browser        | browser errors are reported, **only after the visitor allows "Error reporting" in Cookie settings** |
| `SENTRY_TRACES_SAMPLE_RATE`       | API                | performance tracing (default off)                                                                   |
| `RELEASE` / `NEXT_PUBLIC_RELEASE` | both               | release tag on events                                                                               |

Both sides send no default personal data, never attach request bodies, and run every event and breadcrumb through the scrubber before it leaves the process.
With no DSN set, nothing is loaded.

## Tests

- `services/api/tests/test_scrubber.py`: every sensitive class is removed from logs and Sentry events; request IDs are carried through.
- `apps/web/src/lib/observability/scrub.test.ts`: the same on the browser side.
- `apps/web/src/lib/cookie-consent.test.ts`: the browser SDK isn't even loaded without consent, and stops when consent is withdrawn.
