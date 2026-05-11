# OTP Service (NestJS)

Servicio HTTP que genera y verifica códigos OTP de un solo uso. Persiste sesiones en Valkey (Redis-compatible) y envía notificaciones por email (SES) o SMS (AWS End User Messaging).

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

Verifica el código ingresado contra la sesión activa. **Un solo intento**: código incorrecto elimina la sesión inmediatamente.

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
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errores**

| HTTP | `error` | Condición |
|------|---------|-----------|
| `400` | `INVALID_CODE` | Código incorrecto — sesión eliminada |
| `400` | — | Body inválido — falla validación de campos |
| `404` | `SESSION_NOT_FOUND` | Sesión inexistente, expirada, ya verificada o invalidada |

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
| `VALKEY_URL` | **Sí** | — | Conexión a Valkey |
| `OTP_TTL_SECONDS` | No | `300` | TTL de sesión en segundos |
| `AWS_REGION` | **Sí** | — | Región AWS (ej: `us-east-1`) |
| `AWS_PROFILE` | No | — | Perfil AWS CLI (ej: `femsa`) |
| `SES_FROM_ADDRESS` | **Sí** | — | Dirección de origen SES |
| `EUM_ORIGINATION_IDENTITY` | Sí (si `EUM_MOCK≠true`) | — | Identidad de origen SMS |
| `EUM_MOCK` | No | — | `true` → imprime OTP en consola, no llama a AWS |
| `PORT` | No | `3000` | Puerto HTTP |

Swagger UI disponible en `GET /api` cuando `NODE_ENV !== 'production'`.

## Arquitectura

Hexagonal, 3 capas:

```
src/
├── modules/otp/
│   ├── domain/          ← entidades y puertos (sin dependencias de framework)
│   ├── application/     ← use cases + DTOs Zod
│   └── infrastructure/  ← adaptadores HTTP, Valkey, SES, End User Messaging
└── shared/
    ├── pipes/           ← ZodValidationPipe
    └── valkey/          ← ValkeyService (wrapper ioredis)
```

## Desarrollo local

Requiere Docker (para Valkey) y Node 20+.

```bash
# instalar dependencias
npm install

# levantar Valkey + NestJS en watch mode
make micro

# solo NestJS (Valkey ya corriendo)
make back

# flujo e2e completo contra el servidor
make e2e-micro-mail   # send via phone → entrega por email (SES real)
make e2e-micro-sms    # send via mail  → entrega por SMS (requiere EUM_ORIGINATION_IDENTITY)
```

`.env` mínimo para desarrollo:

```env
SES_FROM_ADDRESS=no-reply@tu-dominio.com
AWS_PROFILE=tu-perfil
EUM_MOCK=true
```

## Tests

```bash
make test-micro     # Jest con cobertura (threshold 85%)
```

Cobertura actual: **100% stmts / 86% branches / 100% funcs / 100% lines**

## Build

```bash
npm run build       # compila a dist/
docker build -t otp-micro .   # imagen para producción (EKS)
```
