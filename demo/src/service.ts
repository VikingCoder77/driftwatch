export const HEALTH_RESPONSE = {
  statusCode: 200,
  body: { status: "ok" },
} as const;

export const CREATE_SESSION_MISSING_USER_ID_STATUS = 400;

export const SESSION_TTL_MINUTES = 60;

export const RATE_LIMIT_REQUESTS_PER_MINUTE = 1_000;

export const LOGIN_AUDIT_FIELDS = ["userId"] as const;

export const ADMIN_AUTH_HEADER = "x-admin-key";
