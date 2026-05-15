# OTP Service (NestJS)

Servicio HTTP que genera y verifica códigos OTP de un solo uso. Persiste sesiones cifradas en DynamoDB y envía notificaciones por email (SES) o SMS (AWS End User Messaging).

## Endpoints

### `POST /otp/send`

Genera un OTP de 6 dígitos, persiste la sesión y la envía al cliente.

**Request**

```json
{
  "customer": {
    "id": "25333142-9",
    "name": "Renzo Ezagui",
    "phone": "+56963174237",
    "mail": "renzo@ezagui.dev"
  },
  "requestedVia": "phone"
}
```

| Campo | Tipo | Validación |
|-------|------|-----------|
| `customer.id` | string | requerido |
| `customer.name` | string | requerido |
| `customer.phone` | string | E.164 (`+56963174237`) |
| `customer.mail` | string | email válido |
| `requestedVia` | enum | `"mail"` \| `"phone"` \| `"id"` |

**Canal de entrega — lógica cruzada**

El OTP se entrega por un canal distinto al que originó la solicitud:

| `requestedVia` | Canal de entrega | Destino |
|----------------|-----------------|---------|
| `mail` | SMS | `customer.phone` |
| `phone` | Email | `customer.mail` |
| `id` | SMS *(default)* | `customer.phone` |

**Response `201`**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "expiresAt": "2026-04-28T21:05:00.000Z",
  "customer": {
    "id": "25333142-9",
    "name": "Renzo Ezagui",
    "phone": "+56963174237",
    "mail": "renzo@ezagui.dev"
  },
  "sentTo": {
    "channel": "mail",
    "value": "renzo@ezagui.dev"
  }
}
```

**Errores**

| HTTP | Condición |
|------|-----------|
| `400` | Body inválido — falla validación de campos |

Shape del error `400`:

```json
{
  "formErrors": [],
  "fieldErrors": {
    "customer": ["INVALID_PHONE", "INVALID_MAIL"],
    "requestedVia": ["Invalid option: expected one of \"mail\"|\"phone\"|\"id\""]
  }
}
```

---

### `POST /otp/verify`

Verifica el código ingresado contra la sesión activa. **Single-use**: la sesión se elimina inmediatamente tanto en éxito como en fallo — no hay reintentos.

**Request**

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "code": "429831"
}
```

| Campo | Tipo | Validación |
|-------|------|-----------|
| `sessionId` | string (uuid) | requerido |
| `code` | string | 6 dígitos numéricos |

**Response `200`**

```json
{
  "ok": true,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "customer": {
    "id": "25333142-9",
    "name": "Renzo Ezagui",
    "phone": "+56963174237",
    "mail": "renzo@ezagui.dev"
  }
}
```

**Errores**

| HTTP | `error` | Condición |
|------|---------|-----------|
| `400` | `INVALID_CODE` | Código incorrecto — sesión eliminada |
| `400` | `SESSION_CORRUPTED` | No se pudo descifrar el customer — sesión eliminada |
| `400` | — | Body inválido — falla validación de campos |
| `404` | `SESSION_NOT_FOUND` | Sesión inexistente o ya consumida |
| `410` | `SESSION_EXPIRED` | Sesión expirada — ya no está disponible |

Error de negocio:
```json
{ "error": "INVALID_CODE" }
```

Error de validación:
```json
{
  "formErrors": [],
  "fieldErrors": {
    "sessionId": ["Invalid UUID"],
    "code": ["Must be exactly 6 digits"]
  }
}
```

---

## Variables de entorno

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `DYNAMODB_TABLE_NAME` | **Sí** | — | Tabla DynamoDB para sesiones OTP |
| `DYNAMODB_ENDPOINT` | No | — | Endpoint override (ej: `http://localhost:8000` para DynamoDB local) |
| `OTP_TTL_SECONDS` | No | `300` | TTL de sesión en segundos |
| `OTP_HMAC_SECRET` | **Sí** | — | Mínimo 32 chars. HMAC-SHA256 del OTP antes de persistir |
| `OTP_ENCRYPTION_KEY` | **Sí** | — | 64 chars hex (32 bytes). Clave AES-256-GCM para cifrar datos del customer |
| `AWS_REGION` | **Sí** | — | Región AWS (ej: `us-east-1`) |
| `AWS_PROFILE` | No | — | Perfil AWS CLI (ej: `femsa`). No se usa en EKS (IAM role) |
| `SES_FROM_ADDRESS` | **Sí** | — | Dirección de origen SES |
| `EUM_ORIGINATION_IDENTITY` | Sí (si `EUM_MOCK≠true`) | — | Identidad de origen SMS |
| `EUM_MOCK` | No | `false` | `true` → imprime OTP en consola, no llama a AWS |
| `PORT` | No | `3000` | Puerto HTTP |
| `NODE_ENV` | No | — | `production` deshabilita Swagger UI |
| `LOG_LEVEL` | No | `info` | Nivel de log Pino |

Swagger UI disponible en `GET /api` cuando `NODE_ENV !== 'production'`.

## Arquitectura

Hexagonal, 3 capas:

```
src/
├── modules/otp/
│   ├── domain/          ← entidades y puertos (sin dependencias de framework)
│   ├── application/     ← use cases + DTOs Zod
│   └── infrastructure/  ← adaptadores HTTP, DynamoDB, SES, End User Messaging
└── shared/
    ├── pipes/           ← ZodValidationPipe
    ├── crypto/          ← computeHmac(), encrypt(), decrypt() (AES-256-GCM)
    └── dynamodb/        ← DynamoDBProvider (client + document client)
```

## Desarrollo local

Requiere Node 20+ y credenciales AWS activas (perfil `femsa` vía SSO).

```bash
# instalar dependencias
npm install

# levantar en watch mode (desde el scaffolding raíz)
make otp

# o directamente
npm run start:dev
```

`.env` mínimo para desarrollo (ver `CLAUDE.md` para todos los valores):

```env
DYNAMODB_TABLE_NAME=mcp-femsa-dev-otp-sessions
OTP_HMAC_SECRET=<min-32-chars>
OTP_ENCRYPTION_KEY=<64-hex-chars>
AWS_REGION=us-east-1
AWS_PROFILE=femsa
SES_FROM_ADDRESS=no-reply@tu-dominio.com
EUM_MOCK=true
```

E2E interactivo (requiere servicio corriendo en `:3004`):

```bash
# desde el scaffolding raíz:
make test-otp-e2e
```

## Tests

```bash
npm test              # Jest
npm run test:cov      # con cobertura (threshold: 85% stmts/funcs/lines, 78% branches)
```

Cobertura actual: **100% stmts / 100% funcs / 100% lines / ~80% branches**

## Build

```bash
npm run build       # compila a dist/
docker build -t otp-micro .   # imagen para producción (EKS)
```
