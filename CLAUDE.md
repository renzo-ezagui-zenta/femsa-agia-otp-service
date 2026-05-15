# CLAUDE.md — otp_service

Guidance for Claude Code when working in this service.

---

## What This Service Does

`otp_service` is a NestJS HTTP microservice for **one-time password generation and verification**. It is a CORE production service — not part of the test harness.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/otp/send` | Generates a 6-digit OTP, stores an encrypted session in DynamoDB, and delivers the code via AWS SES (email) or AWS End User Messaging / Pinpoint (SMS) |
| `POST` | `/otp/verify` | Validates a `sessionId` + `code` pair; deletes the session immediately on both success and failure (single-use) |
| `GET` | `/health` | Terminus health check — calls DescribeTable on DynamoDB |
| `GET` | `/api` | Swagger UI (non-production only) |

---

## Ports

| Context | Port |
|---------|------|
| Local (`make otp`) | **3004** |
| Docker (host-side) | **3004** → container 3000 |
| K8s service (`mcp-dev`) | **3000** |

---

## Environment Variables

All vars are validated at startup via Zod (`src/env.schema.ts`). The service refuses to boot if validation fails.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DYNAMODB_TABLE_NAME` | yes | — | DynamoDB table for OTP sessions. Prod: `mcp-femsa-dev-otp-sessions` |
| `DYNAMODB_ENDPOINT` | no | — | Optional endpoint override (e.g. `http://localhost:8000` for local DynamoDB) |
| `OTP_TTL_SECONDS` | no | `300` | Session TTL in seconds (5 min default) |
| `OTP_HMAC_SECRET` | yes | — | Min 32 chars. Used for HMAC-SHA256 of the OTP before storing |
| `OTP_ENCRYPTION_KEY` | yes | — | Exactly 64 hex chars (32 bytes). AES-256-GCM key for encrypting customer data |
| `AWS_REGION` | yes | — | AWS region for DynamoDB, SES and EUM clients |
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

The session is stored in DynamoDB (`mcp-femsa-dev-otp-sessions`) as:
```
{
  sessionId:          UUID (PK)
  otpHash:            HMAC-SHA256(otp, OTP_HMAC_SECRET)
  customerEncrypted:  AES-256-GCM(JSON.stringify(customer), OTP_ENCRYPTION_KEY)
  expiresAt:          Unix epoch seconds (DynamoDB TTL attribute)
}
```

Returns `201` with `{ sessionId, expiresAt, customer, sentTo: { channel, value } }`.

### POST /otp/verify

```
Caller → { sessionId: "<uuid>", code: "123456" }
```

| Outcome | HTTP | Behaviour |
|---------|------|-----------|
| Session not found | `404` `SESSION_NOT_FOUND` | — |
| Session expired | `410` `SESSION_EXPIRED` | Adapter deletes the item immediately |
| Code incorrect | `400` `INVALID_CODE` | Session **deleted immediately** (single attempt, no retries) |
| Customer data corrupted | `400` `SESSION_CORRUPTED` | Session **deleted immediately** |
| Code correct | `200` `{ ok: true, sessionId, customer }` | Session **deleted immediately** (delete-on-use) |

**Security**: sessions are deleted on both success and failure — no re-use possible.
**Expiry defense**: `findById` checks `expiresAt` in application code — does not rely on DynamoDB TTL lazy deletion (can take up to 48h).

---

## Architecture

Strict hexagonal (ports & adapters):

```
src/
├── modules/otp/
│   ├── domain/
│   │   ├── entities/otp-session.entity.ts   ← pure domain, no framework imports
│   │   └── ports/                           ← interfaces only (save/findById/delete)
│   ├── application/use-cases/               ← business logic, injected via Symbol tokens
│   └── infrastructure/
│       ├── http/otp.controller.ts           ← NestJS HTTP layer
│       └── adapters/                        ← SES, EUM, DynamoDB implementations
└── shared/
    ├── pipes/zod-validation.pipe.ts         ← wraps Zod safeParse as NestJS pipe
    ├── crypto/otp-crypto.ts                 ← computeHmac(), encrypt(), decrypt()
    └── dynamodb/                            ← DynamoDBProvider + DynamoDbModule
```

DI injection tokens live in `src/modules/otp/tokens.ts`.

---

## Security Notes

- OTP generated with `node:crypto.randomInt(0, 1_000_000)` — CSPRNG, never `Math.random()`
- OTP stored as `HMAC-SHA256(otp, OTP_HMAC_SECRET)` — never in plaintext in DynamoDB
- Customer PII stored as `AES-256-GCM(customer, OTP_ENCRYPTION_KEY)` — opaque to DB-level access
- Single-use: session deleted on both correct and incorrect verification attempt
- `expiresAt` enforced in application code — does not trust DynamoDB TTL alone
- The OTP value is **always `[REDACTED]`** in structured logs (both SES and EUM adapters)
- OTP only appears as plain text in `EUM_MOCK=true` console output (dev only)

---

## AWS Dependencies

| Service | Purpose | SDK |
|---------|---------|-----|
| **AWS DynamoDB** | OTP session persistence (encrypted) | `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` |
| **AWS SES** | Email OTP delivery | `@aws-sdk/client-ses` |
| **AWS End User Messaging (Pinpoint SMS Voice V2)** | SMS OTP delivery | `@aws-sdk/client-pinpoint-sms-voice-v2` |

No Cognito, no SQS, no Valkey.

---

## DynamoDB Table

**Table name**: `mcp-femsa-dev-otp-sessions`
**PK**: `sessionId` (String, UUID)
**TTL attribute**: `expiresAt` (Number, Unix epoch seconds)
**Billing**: PAY_PER_REQUEST

Created by `make init-db` (also enables TTL automatically).

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
