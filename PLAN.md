# Open Source API Management Platform — Implementation Plan

## Context
Build an open-source, self-hosted API Management platform (similar to Azure APIM) with a developer portal, admin portal, and API gateway. The MVP targets managing ~100 APIs locally via Docker, with a path to AKS/cloud deployment later. Policies, analytics/logging, and multi-IdP support are deferred to later phases.

## Hardening Goals (Added for Low-Error Delivery)

- Availability target for MVP local stack: gateway and backend recover within 60 seconds after Postgres or Redis restarts.
- Config propagation SLO: backend write to Envoy route/key refresh at p95 <= 5 seconds.
- Security baseline from day 1: no plaintext secrets in repo, authenticated control-plane traffic, and strict RBAC checks on every write endpoint.
- Data safety baseline: all schema updates ship as forward + rollback migrations; no manual environment drift.
- Release gate baseline: no merge unless lint, unit, integration, and gateway end-to-end checks pass.

---

## Architecture Overview

```
+--------------+  +------------------+  +--------------+
| Admin Portal |  |   User Portal    |  |  API Clients |
|  (React)     |  |    (React)       |  |              |
+------+-------+  +--------+---------+  +------+-------+
       |                    |                    |
       v                    v                    v
+---------------------------------+    +--------------------+
|     Backend API (Node/Express)  |    |   API Gateway      |
|  - API CRUD, Products, Subs     |    |  (Go control plane |
|  - Subscription key mgmt        |    |   + Envoy proxy)   |
|  - OpenAPI import/validation    |    +--------+-----------+
|  - Entra ID auth                |             |
+----------+----------------------+             |
           |        +----------+                |
           +------->| Postgres |<---------------+
           |        +----------+
           |        +----------+
           +------->|  Redis   |------ pub/sub ----> Go control plane
                    +----------+
```

## Tech Stack

| Component | Technology |
|---|---|
| API Gateway (proxy) | Envoy Proxy |
| Gateway Control Plane | Go (xDS server) |
| Backend API | Node.js + Express + TypeScript |
| Admin Portal | React + TypeScript |
| User Portal (Publisher + Developer) | React + TypeScript |
| Database | PostgreSQL |
| Cache / Pub-Sub | Redis |
| Auth | Microsoft Entra ID (OIDC) |
| Local Infra | Docker + docker-compose |

---

## Monorepo Structure

```
openapi-platform/
├── docker-compose.yml              # Single compose for all services
├── docker-compose.override.yml     # Local dev overrides
│
├── gateway/                        # Go control plane + Envoy config
│   ├── cmd/
│   │   └── controlplane/
│   │       └── main.go             # xDS gRPC server entry
│   ├── internal/
│   │   ├── xds/                    # xDS snapshot, resource builders
│   │   ├── config/                 # DB/Redis config loader
│   │   └── subscription/           # Subscription key validation filter config
│   ├── envoy/
│   │   └── bootstrap.yaml          # Envoy bootstrap pointing to xDS
│   ├── Dockerfile
│   └── go.mod
│
├── backend/                        # Node.js Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── apis.ts             # CRUD for API definitions
│   │   │   ├── products.ts         # CRUD for products
│   │   │   ├── subscriptions.ts    # Subscription + key management
│   │   │   ├── openapi.ts          # OpenAPI YAML import/parse
│   │   │   └── auth.ts             # Entra callback/token
│   │   ├── middleware/
│   │   │   └── entraAuth.ts        # Entra ID JWT validation
│   │   ├── services/
│   │   │   ├── configPublisher.ts  # Publishes config changes to Redis
│   │   │   └── subscriptionKey.ts  # Key generation/hashing
│   │   ├── db/
│   │   │   ├── migrations/         # Postgres migrations
│   │   │   └── models/             # Sequelize/Knex models
│   │   └── app.ts
│   ├── Dockerfile
│   └── package.json
│
├── portal-admin/                   # Admin React app (platform ops)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ApiList.tsx         # All APIs platform-wide
│   │   │   ├── ApiDetail.tsx
│   │   │   ├── ProductList.tsx
│   │   │   ├── ProductDetail.tsx
│   │   │   ├── Subscriptions.tsx   # Approve/override all subscriptions
│   │   │   └── Users.tsx           # Manage users and roles
│   │   ├── components/
│   │   └── auth/
│   ├── Dockerfile
│   └── package.json
│
├── portal-user/                    # User portal (publisher + developer)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Catalog.tsx         # Browse APIs (developer)
│   │   │   ├── ApiExplorer.tsx     # Swagger UI (developer)
│   │   │   ├── Products.tsx        # Browse products (developer)
│   │   │   ├── Subscribe.tsx       # Subscribe to product (developer)
│   │   │   ├── MySubscriptions.tsx # View keys (developer)
│   │   │   ├── MyApis.tsx          # Manage own APIs (publisher)
│   │   │   ├── MyApiDetail.tsx     # Edit own API (publisher)
│   │   │   ├── SubRequests.tsx     # Approve sub requests (publisher)
│   │   │   └── Profile.tsx
│   │   ├── components/
│   │   │   └── RoleGuard.tsx       # Show/hide based on role
│   │   └── auth/
│   ├── Dockerfile
│   └── package.json
│
├── db/
│   └── init.sql                    # Initial schema bootstrap
│
└── docs/
    └── architecture.md
```

---

## Database Schema (PostgreSQL)

```sql
-- Users (synced from Entra, can be admin/publisher/developer)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entra_object_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- A user can hold multiple roles (publisher AND developer)
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'publisher', 'developer')),
    PRIMARY KEY (user_id, role)
);

-- APIs registered in the platform
CREATE TABLE apis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    version VARCHAR(50),
    base_path VARCHAR(255) NOT NULL UNIQUE,   -- e.g. /petstore
    backend_url VARCHAR(500) NOT NULL,        -- upstream target
    owner_id UUID REFERENCES users(id),       -- publisher who owns this API
    connect_timeout_ms INT,                   -- upstream connect timeout (null = platform default 5000ms)
    response_timeout_ms INT,                  -- upstream response timeout (null = platform default 15000ms)
    openapi_spec JSONB,                       -- parsed OpenAPI spec
    openapi_raw TEXT,                         -- original YAML/JSON
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products group APIs for subscription
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    description TEXT,
  owner_id UUID REFERENCES users(id),       -- product approval owner for MVP
    approval_required BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: which APIs belong to which product
CREATE TABLE product_apis (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, api_id)
);

-- Subscriptions: a developer subscribes to a product
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  primary_key_hash CHAR(64) NOT NULL UNIQUE,       -- lookup/auth
  secondary_key_hash CHAR(64) NOT NULL UNIQUE,
  primary_key_ciphertext BYTEA NOT NULL,           -- encrypted value for portal display
  secondary_key_ciphertext BYTEA NOT NULL,
  key_version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Durable config events for reliable gateway refresh (outbox pattern)
CREATE TABLE config_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed')),
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Audit all privileged mutations (role changes, overrides, key operations)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Schema Hardening Additions (Must Include in Migrations)

```sql
-- Only one open subscription per developer+product.
CREATE UNIQUE INDEX uq_subscriptions_developer_product_open
ON subscriptions (developer_id, product_id)
WHERE status IN ('active', 'pending');

CREATE INDEX idx_apis_owner_status ON apis (owner_id, status);
CREATE INDEX idx_product_apis_api_id ON product_apis (api_id);
CREATE INDEX idx_subscriptions_product_status ON subscriptions (product_id, status);
CREATE INDEX idx_subscriptions_developer_status ON subscriptions (developer_id, status);
CREATE INDEX idx_config_outbox_status_created_at ON config_outbox (status, created_at);
CREATE INDEX idx_audit_logs_actor_created_at ON audit_logs (actor_user_id, created_at);

-- Keep updated_at correct without relying on app code.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apis_set_updated_at
BEFORE UPDATE ON apis
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subscriptions_set_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Component Details

### 1. Go Control Plane + Envoy Gateway

**How it works:**
- Envoy boots with a minimal `bootstrap.yaml` pointing to the Go xDS server for dynamic config
- Go control plane connects to PostgreSQL to load all APIs (base_path → backend_url mappings) and subscription keys
- Go control plane subscribes to Redis pub/sub channel `config:updates`
- When backend publishes a config change event, Go reloads from DB and pushes a new xDS snapshot to Envoy
- Envoy routes requests based on path prefix, version, and headers; Go control plane configures an ext_authz filter for subscription key validation

**Request routing responsibilities:**

| Responsibility | Mechanism |
|---|---|
| Route by path | Envoy path prefix match on `base_path` (e.g. `/petstore`) via xDS RouteConfiguration |
| Route by version | Path-prefix versioning: `base_path` must include the version segment (e.g. `/v1/petstore`). The `version` field on the `apis` table is the source of truth. Go control plane builds one xDS route entry per `(version, base_path)` tuple. |
| Forward request | Envoy upstream cluster per API, pointing to `backend_url`. Cluster is created/updated dynamically by the Go control plane via xDS CDS/EDS. |

**Version routing rules:**
- `base_path` is stored normalized and version-prefixed: e.g. `/v1/petstore`, `/v2/petstore`.
- Two versions of the same API are independent rows in the `apis` table, each with their own `backend_url`.
- The Go control plane generates one Envoy route and one upstream cluster per active API row.
- Most-specific (longest prefix) match wins; Envoy evaluates routes in priority order set by the control plane.

**Subscription key validation flow:**
1. Client sends request with header `Subscription-Key: <key>`
2. Envoy ext_authz calls Go gRPC service
3. Go service checks key against in-memory cache (loaded from DB, refreshed on Redis events)
4. If valid → allow + attach metadata (developer_id, product_id). If invalid → 401

**Key Go packages:**
- `github.com/envoyproxy/go-control-plane` — xDS server implementation
- `github.com/jackc/pgx` — Postgres driver
- `github.com/redis/go-redis` — Redis client

**Reverse proxy behavior:**

Envoy acts as the reverse proxy core. The following behaviors must be explicitly configured in the xDS cluster and route definitions built by the Go control plane:

| Behavior | Mechanism | Config location |
|---|---|---|
| Forward request to backend | Envoy upstream cluster per API pointing to `backend_url` | xDS CDS — `ClusterLoadAssignment` |
| Preserve request headers | Envoy passes all client headers upstream by default; only `Host` is rewritten to the upstream host | xDS RouteAction `host_rewrite_literal` |
| Preserve request body | Envoy streams the body through without buffering by default; no explicit config needed unless a filter requires body buffering | Envoy default behavior |
| Upstream connect timeout | Set per cluster: default 5s. Configurable via `connect_timeout` on the xDS Cluster resource | xDS CDS — `Cluster.connect_timeout` |
| Upstream response timeout | Set per route: default 15s. Configurable via `timeout` on the xDS RouteAction | xDS RDS — `RouteAction.timeout` |
| Upstream retry | 2 retries on 503/connect-failure with exponential backoff; not retried on 4xx | xDS RDS — `RouteAction.retry_policy` |

Timeout values are stored as `connect_timeout_ms` and `response_timeout_ms` on the `apis` table (nullable; control plane falls back to platform defaults if null).

**Config-driven behavior (no redeploys for API changes):**

This is the core separation between a gateway and a static proxy. All routing, cluster, and filter config is loaded dynamically via xDS — Envoy never needs to restart or reload a file.

| Change type | How it propagates |
|---|---|
| New API registered | Backend writes to `apis` table → publishes `config:updates` to Redis → Go control plane reloads DB → pushes new xDS snapshot (new route + new upstream cluster) to Envoy |
| API updated (URL, headers, timeouts) | Same path as above; control plane rebuilds only the affected route/cluster in the snapshot |
| API deactivated (`status=inactive`) | Control plane removes the route from the snapshot; Envoy returns 404 for that path — no restart |
| Subscription key added/revoked | Control plane refreshes in-memory key cache; new key accepted / revoked key rejected within propagation SLO |
| Snapshot version | Monotonically incrementing; Envoy ACKs each version. Stale or out-of-order pushes are rejected |
| Fallback on DB/Redis outage | Control plane serves the last known good snapshot; periodic polling (every 30s) re-syncs when DB recovers |

**Error handling — consistent error responses:**

All gateway-level errors must return a structured JSON body and a well-defined HTTP status. Envoy's local reply body is customized via the `local_reply` config in `bootstrap.yaml`.

| Error scenario | HTTP status | Response body | Source |
|---|---|---|---|
| No matching route (unknown path) | `404` | `{ "code": "ROUTE_NOT_FOUND", "message": "No API matched this path" }` | Envoy local reply |
| Missing subscription key | `401` | `{ "code": "MISSING_KEY", "message": "Subscription key required" }` | ext_authz deny response |
| Invalid / revoked subscription key | `401` | `{ "code": "INVALID_KEY", "message": "Subscription key is invalid or revoked" }` | ext_authz deny response |
| Suspended subscription | `403` | `{ "code": "SUBSCRIPTION_SUSPENDED", "message": "Subscription is suspended" }` | ext_authz deny response |
| ext_authz service unavailable | `503` | `{ "code": "AUTH_UNAVAILABLE", "message": "Gateway authorization service unavailable" }` | Envoy ext_authz fail-closed |
| Upstream connect timeout | `504` | `{ "code": "UPSTREAM_TIMEOUT", "message": "Backend service did not respond in time" }` | Envoy upstream timeout |
| Upstream connection refused / 5xx | `502` | `{ "code": "UPSTREAM_ERROR", "message": "Backend service returned an error" }` | Envoy upstream error |
| Upstream retry exhausted | `503` | `{ "code": "UPSTREAM_UNAVAILABLE", "message": "Backend service is unavailable" }` | Envoy retry exhausted |

**Error response format (all gateway errors):**
```json
{
  "code": "UPSTREAM_TIMEOUT",
  "message": "Backend service did not respond in time",
  "request_id": "<x-request-id header value>"
}
```
- `x-request-id` is injected by Envoy on every request and echoed in error bodies for traceability.
- Backend service errors (4xx/5xx from upstream) are passed through as-is; the gateway does not rewrite upstream error bodies.

**Reliability guardrails (add in MVP):**
- Snapshot versioning must be monotonic; reject stale writes when concurrent config updates happen.
- Keep and serve last known good xDS snapshot if DB/Redis are temporarily unavailable.
- Add periodic DB polling fallback (for example every 30 seconds) in case Redis pub/sub events are missed.
- ext_authz timeout should fail closed for protected routes and return deterministic 401/503 responses.
- Enforce mTLS or network policy between Envoy and ext_authz service when moved to AKS.

### 2. Node.js Backend API

**Endpoints (MVP):**

```
# APIs
POST   /api/apis                          — Register new API (with OpenAPI YAML upload)
GET    /api/apis                          — List all APIs
GET    /api/apis/:id                      — Get API details + parsed spec
PUT    /api/apis/:id                      — Update API
DELETE /api/apis/:id                      — Delete API

# Products
POST   /api/products                      — Create product
GET    /api/products                      — List products
PUT    /api/products/:id                  — Update product
POST   /api/products/:id/apis             — Add API to product
DELETE /api/products/:id/apis/:apiId      — Remove API from product

# Subscriptions
POST   /api/subscriptions                 — Subscribe to a product (status=pending if approval required)
GET    /api/subscriptions                 — List subscriptions (filtered by developer or publisher)
PUT    /api/subscriptions/:id/approve     — Approve (product owner or admin)
PUT    /api/subscriptions/:id/reject      — Reject subscription
POST   /api/subscriptions/:id/regenerate-key — Regenerate primary/secondary key
DELETE /api/subscriptions/:id             — Cancel subscription

# Users
GET    /api/users                         — List users (admin)
PUT    /api/users/:id/roles               — Assign roles to user (admin)

# OpenAPI
POST   /api/openapi/validate              — Validate OpenAPI YAML/JSON
POST   /api/openapi/import                — Import OpenAPI spec → create API entry

# Auth
GET    /api/auth/login                    — Redirect to Entra
GET    /api/auth/callback                 — Entra callback
GET    /api/auth/me                       — Current user info
```

**Config publish flow:** After any API/product/subscription write, publish to Redis:
```js
redis.publish('config:updates', JSON.stringify({ type: 'api_changed', id: '...' }));
```

**Key npm packages:**
- `swagger-parser` — validate/parse OpenAPI specs
- `@azure/msal-node` — Entra ID auth
- `knex` — SQL query builder + migrations
- `ioredis` — Redis client
- `uuid`, `crypto` — subscription key generation

**Backend guardrails (add in MVP):**
- Validate all request bodies and params with a strict schema validator (for example Zod/Joi) and return consistent RFC 7807-like error envelopes.
- Wrap multi-table writes in transactions (product+api assignment, subscription approve/reject, key regeneration).
- Add optimistic concurrency for mutable entities using `updated_at` or a version column to prevent lost updates.
- Add idempotency key support for subscription create/regenerate endpoints to avoid duplicate records on retries.
- Publish typed config events with version and correlation ID: `{ eventType, entityType, entityId, version, correlationId, occurredAt }`.
- Implement transactional outbox publishing (`config_outbox`) so DB writes and config events cannot diverge.

### 3. Admin Portal (React)

**Pages:**
- **Dashboard** — Platform-wide stats: API count, product count, active subscriptions, users
- **APIs** — Table listing ALL APIs across the platform, import OpenAPI YAML, toggle active/inactive
- **API Detail** — Edit any API, view rendered OpenAPI spec, manage ownership
- **Products** — Manage all products, assign APIs to products
- **Subscriptions** — View/approve/reject/suspend ALL subscriptions platform-wide (override publisher decisions)
- **Users** — Manage users, assign roles (admin / publisher / developer)

**Auth:** MSAL.js (`@azure/msal-browser`) for Entra ID login. Admin role required.

### 4. User Portal (React — combined Publisher + Developer views)

A single React app with role-based UI. Users can be **publishers** (API owners), **developers** (API consumers), or both.

**Publisher views (role: publisher):**
- **My APIs** — List APIs the publisher owns, create/edit/import OpenAPI specs
- **API Detail** — Edit own API metadata, backend URL, view spec, toggle active/inactive
- **Subscription Requests** — Approve/reject subscription requests for their own APIs
- **Subscribers** — View who is subscribed to their APIs

**Developer views (role: developer):**
- **API Catalog** — Browse all published APIs with search
- **API Explorer** — Swagger UI rendering of the OpenAPI spec (`swagger-ui-react`)
- **Products** — Browse products, see which APIs they include
- **Subscribe** — Select a product, create subscription, receive keys
- **My Subscriptions** — View subscription keys, regenerate, copy to clipboard

**Shared:**
- **Profile** — View own info and roles

**Auth:** MSAL.js Entra ID. Role determined by `user_roles` table. A user can hold both publisher and developer roles simultaneously.

### 5. API Configuration

API configuration covers three responsibilities: creating APIs, defining routes, and attaching policies.

#### 5a. Create APIs

APIs can be created in two ways:

| Method | Actor | Endpoint | Details |
|---|---|---|---|
| Manual form | Admin / Publisher | `POST /api/apis` | Provide `name`, `version`, `base_path`, `backend_url` manually |
| OpenAPI import | Admin / Publisher | `POST /api/openapi/import` | Upload YAML/JSON spec; `base_path` and `backend_url` extracted from spec; spec stored in `openapi_spec` + `openapi_raw` |

Both paths write to the `apis` table and publish a `config:updates` event so the gateway picks up the new route within the propagation SLO.

**Validation rules on create:**
- `base_path` must be version-prefixed, normalized, and unique (e.g. `/v1/petstore`).
- `backend_url` must be a valid reachable URL (format check on create; liveness check is optional/async).
- If importing OpenAPI, spec must pass schema validation and `$ref` resolution before insert.

#### 5b. Define Routes

Route definition is stored on the `apis` table and translated into Envoy xDS config by the Go control plane.

**Route fields per API:**

| Field | Type | Purpose |
|---|---|---|
| `base_path` | `VARCHAR(255)` | Path prefix Envoy matches (includes version, e.g. `/v1/petstore`) |
| `backend_url` | `VARCHAR(500)` | Upstream target Envoy forwards matched requests to |
| `version` | `VARCHAR(50)` | Version label; must match the version segment in `base_path` |

**Route precedence:** Go control plane assigns Envoy route priority by path specificity (longest prefix first).

**Backend endpoint `PUT /api/apis/:id`** allows updating any route field; each update triggers a re-publish of the xDS snapshot.

#### 5c. Attach Policies

Policies are scoped per API and optionally per product. The policy model is phased:

**MVP (Phase 1) — available at launch:**

| Policy | Scope | Mechanism |
|---|---|---|
| Subscription key auth | Per API | Envoy ext_authz → Go control plane validates `Subscription-Key` |
| Active/inactive toggle | Per API | `status` field; inactive APIs are excluded from xDS snapshot → 404 from Envoy |

**Phase 2 — deferred:**

| Policy | Notes |
|---|---|
| Rate limiting | Per subscription key via Envoy rate limit service |
| Request/response transformation | Header add/remove, body rewrite via Envoy Lua or WASM filter |
| IP allow/block list | Envoy RBAC filter with CIDR matchers |
| CORS | Envoy CORS filter per route |

**Policy storage (Phase 2 schema addition, not needed in MVP):**
```sql
CREATE TABLE api_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
  policy_type VARCHAR(50) NOT NULL,   -- 'rate_limit', 'cors', 'ip_filter', 'transform'
  config JSONB NOT NULL,              -- policy-type-specific config
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Policy attach flow (Phase 2):**
1. Admin/Publisher adds policy via `POST /api/apis/:id/policies`.
2. Backend writes to `api_policies` and publishes `config:updates` event.
3. Go control plane reloads policies and rebuilds the xDS snapshot with the appropriate Envoy filter config.

---

### 6. Authorization Model (Must Lock Before Coding)

- Admin: full platform permissions.
- Publisher: CRUD only for APIs they own, and approve/reject only subscriptions for products they own.
- Developer: browse catalog/products, create/cancel own subscriptions, view/regenerate own keys.
- Product ownership source of truth: `products.owner_id`.
- Admin override is explicit and auditable (store actor, reason, timestamp in audit log).
- Ownership transfer workflow required before deleting/deactivating users who own APIs/products.

### 7. OpenAPI Import Safety Rules

- Validate OpenAPI version and resolve `$ref` safely with size limits to prevent parser abuse.
- Reject specs that define duplicate operation IDs for the same API.
- Enforce base path normalization and collision checks before insert/update.
- Store import diagnostics (warnings/errors) so users can fix and re-import quickly.
- Run spec validation in a bounded worker timeout to prevent long-blocking requests.

---

## Docker Compose (Local Dev)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: apiplatform
      POSTGRES_USER: apiplatform
      POSTGRES_PASSWORD: localdev
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  envoy:
    image: envoyproxy/envoy:v1.30-latest
    volumes: ["./gateway/envoy/bootstrap.yaml:/etc/envoy/envoy.yaml"]
    ports: ["8080:8080", "9901:9901"]
    depends_on: [controlplane]

  controlplane:
    build: ./gateway
    environment:
      DATABASE_URL: postgres://apiplatform:localdev@postgres:5432/apiplatform
      REDIS_URL: redis://redis:6379
      XDS_PORT: "18000"
      EXT_AUTHZ_PORT: "18001"
    ports: ["18000:18000", "18001:18001"]
    depends_on: [postgres, redis]

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://apiplatform:localdev@postgres:5432/apiplatform
      REDIS_URL: redis://redis:6379
      ENTRA_CLIENT_ID: ${ENTRA_CLIENT_ID}
      ENTRA_TENANT_ID: ${ENTRA_TENANT_ID}
      ENTRA_CLIENT_SECRET: ${ENTRA_CLIENT_SECRET}
    ports: ["3001:3001"]
    depends_on: [postgres, redis]

  portal-admin:
    build: ./portal-admin
    ports: ["3002:80"]

  portal-user:
    build: ./portal-user
    ports: ["3003:80"]

volumes:
  pgdata:
```

### Compose Hardening Checklist (First Sprint)

- Add healthchecks for Postgres, Redis, controlplane, backend, envoy; use `depends_on: condition: service_healthy`.
- Add `restart: unless-stopped` for long-running services.
- Run DB migrations as a dedicated one-shot container before backend starts.
- Use an env file template (`.env.example`) and keep real secrets out of source control.
- Split internal and public networks so only Envoy is internet-facing by default.
- Add resource limits/reservations to prevent noisy-neighbor failures during local load tests.

---

## Implementation Phases

### Phase 0 — Decision Lock + Risk Burn-Down (New)
1. Lock authorization model and product ownership rules.
2. Finalize key storage pattern (hash + encrypted value) and key rotation approach.
3. Define config event contract, versioning, and replay strategy.
4. Define error envelope standard and correlation ID propagation.
5. Create threat model for auth, key leakage, and privilege escalation paths.

### Phase 1 — Foundation (Current Target)
1. Set up monorepo structure, docker-compose, Postgres schema + migrations
2. Add CI pipelines and mandatory quality gates before feature development scales
3. Build Node.js backend: API CRUD, OpenAPI import/validation, product CRUD, subscription key generation, user/role management
4. Build Go control plane: xDS server, load routes from DB, Redis subscriber, ext_authz for subscription key validation
5. Configure Envoy with bootstrap pointing to Go xDS
6. Build Admin Portal: platform-wide API/product/subscription/user management
7. Build User Portal: publisher views (my APIs, approve subs) + developer views (catalog, Swagger UI, subscribe, keys)
8. Integrate Entra ID auth on both portals
9. End-to-end test: import API → create product → subscribe → approve → call API through Envoy with subscription key
10. Chaos-lite checks: restart Postgres/Redis/controlplane and verify recovery + consistency

### Phase 2 — Policies & Rate Limiting (Future)
- Rate limiting per subscription (Envoy rate limit service)
- Request/response transformation policies
- IP filtering, CORS policies

### Phase 3 — Analytics & Logging (Future)
- Request logging (Envoy access logs → collector)
- Usage tracking per subscription key
- Dashboard analytics

### Phase 4 — Cloud & Multi-IdP (Future)
- Helm charts for AKS deployment
- AWS Cognito, Okta, generic OIDC support
- Horizontal scaling of gateway

---

## Verification Plan

1. Bring up stack and verify all services become healthy (including healthcheck endpoints).
2. Run DB migration forward on clean DB, then rollback in test env, then forward again.
3. Admin login via Entra (admin role), import Petstore OpenAPI, create product, assign API, publish event.
4. Publisher login, verify only owned APIs/products are editable.
5. Developer login, browse catalog/products, open Swagger UI.
6. Developer subscribes to a product with approval required and receives `pending` state.
7. Unauthorized publisher attempts approval and is denied (403 expected).
8. Product owner approves request; developer sees active subscription and keys.
9. Regenerate primary key; old key denied and new key accepted within config propagation SLO.
10. Gateway positive path: request with valid key routes correctly.
11. Gateway negative path: missing key -> 401, invalid key -> 401, suspended subscription -> 403.
12. OpenAPI import negative tests: invalid schema, unresolved refs, path collision, oversized file.
13. Restart Redis during active traffic; ensure control plane recovers and config converges.
14. Restart Postgres; verify no data corruption and control plane restores last known good snapshot.
15. Verify audit records exist for role changes, approvals, key regeneration, and admin overrides.
16. Run load smoke test for ~100 APIs and confirm latency/error budget stays within target.

---

## Top Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Ambiguous approval ownership for products containing multiple APIs | Incorrect or blocked approvals | Use `products.owner_id` and explicit admin override path |
| Key model mismatch (hashed-only keys vs portal key viewing) | Broken UX or insecure storage | Store encrypted key value + hash for lookup; rotate encryption key by version |
| Lost config update events from Redis pub/sub | Stale gateway routes/keys | Add periodic polling + snapshot versioning + idempotent event processing |
| Missing health gates in compose/dev workflow | Flaky startup and false failures | Add healthchecks, migration job, and service_healthy dependencies |
| Weak test coverage for negative/security scenarios | Late defect discovery | Enforce CI gates including authz, resilience, and import-failure tests |
