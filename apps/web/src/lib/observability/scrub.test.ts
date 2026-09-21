import { describe, expect, it } from "vitest";
import { REDACTED, SENSITIVE_FIELDS, fieldClass, scrub, scrubBreadcrumb, scrubEvent, scrubText } from "./scrub";

const EMAIL = "layla.haddad@gmail.com";
const CARD = "4242 4242 4242 4242";
// Built at runtime so the repository secret scan does not flag the fixtures.
const STRIPE_KEY = ["sk", "live", "51Habcdefghijklmn"].join("_");

describe("scrubText", () => {
  it.each([
    ["email", `welcome ${EMAIL}`, EMAIL],
    ["card", `card ${CARD} ok`, CARD],
    ["stripe secret", `key ${STRIPE_KEY}`, STRIPE_KEY],
    ["bearer token", "Authorization: Bearer abc123def456ghi789", "abc123def456ghi789"],
    ["query token", "/reset-password?token=abcdef123456&x=1", "abcdef123456"],
    ["unsubscribe path", "/api/v1/notifications/unsubscribe/0f3c9a5e7b1d2c4a6e8f0a1b", "0f3c9a5e7b1d2c4a6e8f0a1b"],
    ["share link path", "/join/Zm9vYmFyYmF6cXV4MTIzNDU2", "Zm9vYmFyYmF6cXV4MTIzNDU2"],
    ["phone", "call +961 3 123 456", "3 123 456"],
    ["lebanese mobile", "whatsapp 71 234 567", "71 234 567"],
  ])("removes a %s", (_, raw, secret) => {
    expect(scrubText(raw)).not.toContain(secret);
  });

  it("keeps ordinary text", () => {
    for (const text of [
      "booking 3f2b9c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e",
      "took 1712345678901 ms",
      "/experiences?page=2",
    ]) {
      expect(scrubText(text)).toBe(text);
    }
  });

  it("keeps only the email domain", () => {
    expect(scrubText(EMAIL)).toBe("***@gmail.com");
  });
});

describe("scrub", () => {
  it.each(Object.entries(SENSITIVE_FIELDS))("removes every %s field", (label, names) => {
    const cleaned = scrub(Object.fromEntries(names.map((name) => [name, "must-not-leak"])));
    expect(Object.values(cleaned).every((value) => value === REDACTED)).toBe(true);
    expect(names.every((name) => fieldClass(name) === label)).toBe(true);
  });

  it("handles nesting and header pairs", () => {
    const cleaned = scrub({
      headers: [
        ["Cookie", "mshwar_session=1"],
        ["Accept", "json"],
      ],
      user: { email: EMAIL, id: "u1" },
      token_count: 3,
    });
    expect(cleaned).toEqual({
      headers: [
        ["Cookie", REDACTED],
        ["Accept", "json"],
      ],
      user: { email: REDACTED, id: "u1" },
      token_count: 3,
    });
  });
});

describe("Sentry hooks", () => {
  it("drop cookies, bodies and user details", () => {
    const cleaned = scrubEvent({
      request: {
        url: "https://mshwar.lb/reset-password?token=abcdef123456",
        cookies: { mshwar_session: "abc" },
        data: { password: "hunter2" },
        headers: { Authorization: "Bearer abcdefghijklmnop" },
      },
      user: { id: "u1", email: EMAIL, ip_address: "1.2.3.4" },
      exception: { values: [{ value: `no account for ${EMAIL}` }] },
    });
    const dumped = JSON.stringify(cleaned);
    for (const secret of ["abc", "hunter2", EMAIL, "abcdefghijklmnop", "1.2.3.4", "abcdef123456"]) {
      expect(dumped).not.toContain(`"${secret}"`);
    }
    expect(dumped).not.toContain(EMAIL);
    expect(cleaned.user).toEqual({ id: "u1" });
    expect(cleaned.request).not.toHaveProperty("cookies");
  });

  it("drop breadcrumb query strings", () => {
    const crumb = scrubBreadcrumb({ category: "fetch", data: { url: "/x", "http.query": "token=abc" } });
    expect(crumb.data).toEqual({ url: "/x" });
  });
});
