# Driftwatch Demo

This intentionally drifted session-service fixture contains three satisfied requirements and three direct violations. Run it from the Driftwatch repository root after installing dependencies and making `codex` available on `PATH`.

```sh
npm run dev -- ingest demo/PRD.md
npm run dev -- report
```

Expected violations:

- Session lifetime is 60 minutes instead of 30.
- Rate limiting allows 1,000 requests per minute instead of 100.
- Login audit records omit the required timestamp field.

The remaining health, missing-user, and admin-header requirements are satisfied controls that help reveal false-positive verification behavior.
