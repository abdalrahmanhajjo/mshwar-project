# Authorization

Story: MSHWAR-108 · Code: `services/api/app/core/access.py`, `app/core/sql.py`, `app/core/errors.py`

## Two questions, two layers

1. **Who is calling?** Every route declares exactly one _access policy_:

   ```python
   @router.get("/mine", dependencies=[access.SESSION])
   ```

   The app refuses to start if a route has no policy, or more than one.
   The policy runs before the request body is read, so an anonymous caller gets `401`, never a `422` that reveals the payload shape.

2. **What may they touch?** Each route calls a PostgreSQL `SECURITY DEFINER` function and passes the caller's id.
   The function checks ownership, organisation membership or admin rights, and raises an error when the answer is no.
   Row-level security is a second net underneath (see [database-roles.md](database-roles.md)).

## Policies

| Policy      | Who                                                         | Examples                                                       |
| ----------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `public`    | anyone                                                      | catalogue, search, sign-in, register, published legal versions |
| `session`   | a signed-in, active account                                 | trips, favourites, settings, consents                          |
| `verified`  | signed in with a verified email                             | checkout and payment                                           |
| `admin`     | a platform admin; some handlers also need the elevated tier | admin console, audit log                                       |
| `actor`     | a signed-in account or a group-trip guest                   | group trip voting                                              |
| `token`     | whoever holds a long random link (rate limited)             | unsubscribe, share links, signed files                         |
| `job`       | the scheduler, with `X-Job-Token`                           | outbox dispatch, hold expiry, metrics                          |
| `dev`       | local development only, signed in                           | payment simulation                                             |
| `signature` | a payment provider, checked by signature                    | payment webhook                                                |

The full list of routes is in [route-policies.md](route-policies.md). It is generated from the code and a test fails when it is out of date:

```bash
cd services/api && PYTHONPATH=. python scripts/route_policies.py
```

The set of `public`, `token` and `signature` routes is also pinned in `tests/test_access_policies.py`, so opening a new public route is always a reviewed change.

## Responses

Every error has the same body:

```json
{ "detail": "You don't have permission to do that.", "code": "forbidden", "request_id": "3f1c…" }
```

| Situation                                                                                      | Status  | Code              |
| ---------------------------------------------------------------------------------------------- | ------- | ----------------- |
| Not signed in, or the session expired (the stale cookie is cleared)                            | 401     | `unauthenticated` |
| Signed in, but the role is wrong (for example, not an admin, or not a member of this business) | 403     | `forbidden`       |
| The record belongs to someone else                                                             | **404** | `not_found`       |
| A write came from another website with the visitor's cookies                                   | 403     | `forbidden`       |

Someone else's record gets the same `404` as a record that doesn't exist, so nobody can probe for other people's data.
Database permission errors (SQLSTATE `42501`) that are authorisation decisions are reported with the generic message above.
Business rules that share that code (for example "trip is locked") keep their own message; `tests/test_access_policies.py` fails if a new `42501` message isn't classified.

## Cross-site request guard

The browser signs in with a cookie. `app/core/csrf.py` refuses a state-changing request (POST, PUT, PATCH, DELETE) that carries a Mshwar cookie and comes from another site:

- the `Origin` header must be `PUBLIC_WEB_ORIGIN` or one of `ALLOWED_ORIGINS`;
- when there is no `Origin`, `Sec-Fetch-Site: cross-site` is refused;
- requests without cookies (webhooks, jobs) are not affected.

In staging and production `PUBLIC_WEB_ORIGIN` must be an `https://` origin; the API won't start otherwise.

## Tests

| Test file                 | Proves                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `test_access_policies.py` | every route has one policy; anonymous callers get 401 everywhere; non-admins get 403 on every admin route; error shape |
| `test_idor.py`            | another user's trips, bookings, favourites, reviews and files return 404 and stay unchanged                            |
| `test_cross_tenant.py`    | one business can't read or change another business's data, even with direct SQL as the backend role                    |
| `test_csrf.py`            | cross-site writes with cookies are refused                                                                             |
