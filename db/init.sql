-- Bootstrap schema for API Management Platform
-- Applied once on fresh Postgres container startup via docker-entrypoint-initdb.d

-- Users (synced from Entra ID)
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
    base_path VARCHAR(255) NOT NULL UNIQUE,
    backend_url VARCHAR(500) NOT NULL,
    owner_id UUID REFERENCES users(id),
    connect_timeout_ms INT,
    response_timeout_ms INT,
    openapi_spec JSONB,
    openapi_raw TEXT,
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
    owner_id UUID REFERENCES users(id),
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
    primary_key_hash CHAR(64) NOT NULL UNIQUE,
    secondary_key_hash CHAR(64) NOT NULL UNIQUE,
    primary_key_ciphertext BYTEA NOT NULL,
    secondary_key_ciphertext BYTEA NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Durable config events (outbox pattern for reliable gateway refresh)
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

-- Audit log for privileged mutations
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

-- Indexes
CREATE UNIQUE INDEX uq_subscriptions_developer_product_open
    ON subscriptions (developer_id, product_id)
    WHERE status IN ('active', 'pending');

CREATE INDEX idx_apis_owner_status ON apis (owner_id, status);
CREATE INDEX idx_product_apis_api_id ON product_apis (api_id);
CREATE INDEX idx_subscriptions_product_status ON subscriptions (product_id, status);
CREATE INDEX idx_subscriptions_developer_status ON subscriptions (developer_id, status);
CREATE INDEX idx_config_outbox_status_created_at ON config_outbox (status, created_at);
CREATE INDEX idx_audit_logs_actor_created_at ON audit_logs (actor_user_id, created_at);

-- Auto-update updated_at triggers
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
