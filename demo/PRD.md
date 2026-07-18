# Demo Session Service Requirements

The demo service exposes a small set of constants representing its public behavior and operational policy.

## Health

- D1: `HEALTH_RESPONSE` has status code `200` and a JSON body whose `status` is exactly `"ok"`.

## Sessions

- D2: `CREATE_SESSION_MISSING_USER_ID_STATUS` is exactly `400`.
- D3: `SESSION_TTL_MINUTES` is exactly `30`.

## Rate Limiting

- D4: `RATE_LIMIT_REQUESTS_PER_MINUTE` is exactly `100` requests per client.

## Audit Logging

- D5: `LOGIN_AUDIT_FIELDS` contains both `"userId"` and `"timestamp"`.

## Administration

- D6: `ADMIN_AUTH_HEADER` is exactly `"x-admin-key"`.
