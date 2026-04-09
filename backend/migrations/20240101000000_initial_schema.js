/**
 * Initial schema migration.
 * Uses IF NOT EXISTS so it is safe even if the postgres init.sql already ran.
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entra_object_id VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'publisher', 'developer')),
      PRIMARY KEY (user_id, role)
    );

    CREATE TABLE IF NOT EXISTS apis (
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

    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      display_name VARCHAR(255),
      description TEXT,
      owner_id UUID REFERENCES users(id),
      approval_required BOOLEAN DEFAULT false,
      status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('published', 'draft', 'archived')),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS product_apis (
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      api_id UUID REFERENCES apis(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, api_id)
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
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

    CREATE TABLE IF NOT EXISTS config_outbox (
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

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id UUID,
      reason TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_developer_product_open
      ON subscriptions (developer_id, product_id)
      WHERE status IN ('active', 'pending');

    CREATE INDEX IF NOT EXISTS idx_apis_owner_status ON apis (owner_id, status);
    CREATE INDEX IF NOT EXISTS idx_product_apis_api_id ON product_apis (api_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_product_status ON subscriptions (product_id, status);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_developer_status ON subscriptions (developer_id, status);
    CREATE INDEX IF NOT EXISTS idx_config_outbox_status_created_at ON config_outbox (status, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at ON audit_logs (actor_user_id, created_at);

    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_apis_set_updated_at') THEN
        CREATE TRIGGER trg_apis_set_updated_at
          BEFORE UPDATE ON apis
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_set_updated_at') THEN
        CREATE TRIGGER trg_subscriptions_set_updated_at
          BEFORE UPDATE ON subscriptions
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS config_outbox CASCADE;
    DROP TABLE IF EXISTS subscriptions CASCADE;
    DROP TABLE IF EXISTS product_apis CASCADE;
    DROP TABLE IF EXISTS products CASCADE;
    DROP TABLE IF EXISTS apis CASCADE;
    DROP TABLE IF EXISTS user_roles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP FUNCTION IF EXISTS set_updated_at CASCADE;
  `);
};
