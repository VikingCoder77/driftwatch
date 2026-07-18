# Driftwatch Report

Commit: `26a063bcf93536a113ebc8fee862e8724fd62b0b`
Totals: ❌ 3 violated · ⚠️ 0 unimplemented · ✅ 3 satisfied

## Violated (❌)

| Claim | Requirement | Location | Evidence |
| --- | --- | --- | --- |
| C3 | `SESSION_TTL_MINUTES` is exactly `30`. | `demo/src/service.ts:8-8` | The implementation sets SESSION_TTL_MINUTES to 60, directly contradicting the required value of 30. |
| C4 | `RATE_LIMIT_REQUESTS_PER_MINUTE` is exactly `100` requests per client. | `demo/src/service.ts:10-10` | The implementation sets RATE_LIMIT_REQUESTS_PER_MINUTE to 1,000, directly contradicting the required value of 100. |
| C5 | `LOGIN_AUDIT_FIELDS` contains both `"userId"` and `"timestamp"`. | `demo/src/service.ts:12-12` | LOGIN_AUDIT_FIELDS is implemented as ["userId"], directly omitting the required "timestamp" field. |

## Unimplemented (⚠️)

| Claim | Requirement | Evidence |
| --- | --- | --- |
| — | None | — |

## Satisfied (✅)

| Claim | Requirement | Location |
| --- | --- | --- |
| C1 | HEALTH_RESPONSE has status code 200 and a JSON body whose status is exactly "ok". | `demo/src/service.ts:1-4` |
| C2 | CREATE_SESSION_MISSING_USER_ID_STATUS is exactly 400. | `demo/src/service.ts:6-6` |
| C6 | ADMIN_AUTH_HEADER is exactly "x-admin-key". | `demo/src/service.ts:14-14` |
