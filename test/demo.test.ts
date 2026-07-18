import { describe, expect, it } from "vitest";
import {
  ADMIN_AUTH_HEADER,
  CREATE_SESSION_MISSING_USER_ID_STATUS,
  HEALTH_RESPONSE,
  LOGIN_AUDIT_FIELDS,
  RATE_LIMIT_REQUESTS_PER_MINUTE,
  SESSION_TTL_MINUTES,
} from "../demo/src/service.js";

describe("demo drift fixture", () => {
  it("keeps the three satisfied controls", () => {
    expect(HEALTH_RESPONSE).toEqual({
      statusCode: 200,
      body: { status: "ok" },
    });
    expect(CREATE_SESSION_MISSING_USER_ID_STATUS).toBe(400);
    expect(ADMIN_AUTH_HEADER).toBe("x-admin-key");
  });

  it("keeps three intentional implementation violations", () => {
    expect(SESSION_TTL_MINUTES).toBe(60);
    expect(SESSION_TTL_MINUTES).not.toBe(30);
    expect(RATE_LIMIT_REQUESTS_PER_MINUTE).toBe(1_000);
    expect(RATE_LIMIT_REQUESTS_PER_MINUTE).not.toBe(100);
    expect(LOGIN_AUDIT_FIELDS).toEqual(["userId"]);
    expect(LOGIN_AUDIT_FIELDS).not.toContain("timestamp");
  });
});
