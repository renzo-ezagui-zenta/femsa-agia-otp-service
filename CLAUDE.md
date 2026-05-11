# CLAUDE.md — otp_service

Guidance for Claude Code when working in this service.

---

## What This Service Does

`otp_service` is a NestJS HTTP microservice for **one-time password generation and verification**. It is a CORE production service — not part of the test harness.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/otp/send` | Generates a 6-digit OTP, stores a session in Valkey, and delivers the code via AWS SES (email) or AWS End User Messaging / Pinpoint (SMS) |
| `POST` | `/otp/verify` | Validates a `sessionId` + `code` pair; marks the session verified on success or deletes it immediately on failure |
| `GET` | `/health` | Terminus health check — pings Valkey |
| `GET` | `/api` | Swagger UI (non-production only) |

---

## Ports

| Context | Port |
|---------|------|
| Local (`make otp`) | **3004** |
| Docker (host-side) | **3004** → container 3000 |
| K8s service (`mcp-dev`) | **3000** |
| Valkey (local) | `localhost:6381` (Docker host mapping) |
| Valkey (Docker/K8s) | `valkey:6379` (internal network) |

---

## Environment Variables

All vars are validated at startup via Zod (`src/env.schema.ts`). The service refuses to boot if validation fails.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VALKEY_URL` | yes | — | Redis-compatible URL. Local: `redis://localhost:6381`. Docker: `redis://valkey:6379` |
| `OTP_TTL_SECONDS` | no | `300` | Session TTL in Valkey (5 min default) |
| `AWS_REGION` | yes | — | AWS region for SES and EUM clients |
| `AWS_PROFILE` | no | — | AWS SSO profile for local dev (e.g. `femsa`). Not used in EKS (IAM role) |
| `SES_FROM_ADDRESS` | yes | — | Verified SES sender address |
| `EUM_ORIGINATION_IDENTITY` | conditional | — | Pinpoint origination phone number. Required unless `EUM_MOCK=true` |
| `EUM_MOCK` | no | `false` | When `true`, SMS delivery is skipped and the OTP is printed in a colored box to stdout |
| `PORT` | no | `3000` | HTTP server port inside the container |
| `NODE_ENV` | no | — | `production` disables Swagger UI |
| `LOG_LEVEL` | no | `info` | Pino log level |

Local dev env: `otp_service/.env` (gitignored).
Docker env: `docker/otp_service.env` + `docker/aws.env`.

---

## OTP Flow

### POST /otp/send

```
Caller → { customer: { id, name, phone, mail }, requestedVia: "mail" | "phone" | "id" }
```

**Cross-channel delivery logic** (by design — the OTP is sent to a different channel than the one used for identification):

| `requestedVia` | Delivery channel | AWS service |
|----------------|-----------------|-------------|
| `mail` | SMS → phone | AWS EUM (Pinpoint SMS Voice V2) |
| `phone` | Email → mail | AWS SES |
| `id` | SMS → phone | AWS EUM (default) |

The session is stored in Valkey as:
- Key: `otp:session:<uuid>`
- Value: JSON of `OtpSession` entity (`{ sessionId, customerId, code, channel, verified: false, expiresAt }`)
- TTL: `OTP_TTL_SECONDS`

Returns `201` with `{ sessionId, expiresAt, customer, sentTo: { channel, value } }`.

### POST /otp/verify

```
Caller → { sessionId: "<uuid>", code: "123456" }
```

| Outcome | HTTP | Behaviour |
|---------|------|-----------|
| Session not found / expired | `404` `SESSION_NOT_FOUND` | — |
| Code incorrect | `400` `INVALID_CODE` | Session is **deleted immediately** (single attempt, no retries) |
| Code correct | `200` `{ ok: true, sessionId }` | Session marked `verified: true`, re-saved with same TTL |

---

## Architecture

Strict hexagonal (ports & adapters):

```
src/
├── modules/otp/
│   ├── domain/
│   │   ├── entities/otp-session.entity.ts   ← pure domain, no framework imports
│   │   └── ports/                           ← interfaces only
│   ├── application/use-cases/               ← business logic, injected via Symbol tokens
│   └── infrastructure/
│       ├── http/otp.controller.ts           ← NestJS HTTP layer
│       └── adapters/                        ← SES, EUM, Valkey implementations
└── shared/
    ├── pipes/zod-validation.pipe.ts         ← wraps Zod safeParse as NestJS pipe
    └── valkey/valkey.service.ts             ← ioredis wrapper
```

DI injection tokens live in `src/modules/otp/tokens.ts`.

---

## Security Notes

- OTP generated with `node:crypto.randomInt(0, 1_000_000)` — CSPRNG, never `Math.random()`
- The OTP value is **always `[REDACTED]`** in structured logs (both SES and EUM adapters)
- OTP only appears as plain text in `EUM_MOCK=true` console output (dev only)
- Single-attempt verification: a wrong code immediately destroys the session

---

## AWS Dependencies

| Service | Purpose | SDK |
|---------|---------|-----|
| **AWS SES** | Email OTP delivery | `@aws-sdk/client-ses` |
| **AWS End User Messaging (Pinpoint SMS Voice V2)** | SMS OTP delivery | `@aws-sdk/client-pinpoint-sms-voice-v2` |
| **Valkey** (shared with `server`) | Session persistence with TTL | `ioredis` |

No Cognito, no SQS, no DynamoDB — sessions are entirely ephemeral in Valkey.

---

## Running Tests

```bash
make test-otp        # unit tests (watch: make test-otp-watch)
make test-otp-cov    # coverage report — threshold: 85% stmts/funcs/lines, 78% branches
make test-otp-e2e    # interactive E2E: send → prompt for OTP → verify
```

E2E channel can be overridden:
```bash
REQUESTED_VIA=phone make test-otp-e2e   # OTP delivered via email (SES)
REQUESTED_VIA=mail  make test-otp-e2e   # OTP delivered via SMS mock (default)
REQUESTED_VIA=id    make test-otp-e2e   # OTP delivered via SMS mock
```

E2E log output: `logs/otp_service_e2e.log`

---

## Valkey Key Pattern

```
otp:session:<uuid>   TTL = OTP_TTL_SECONDS (default 300s)
```

The `server` service also uses this Valkey instance for tool-response caching, but with a different key prefix — no collision.
