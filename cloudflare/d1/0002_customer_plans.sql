-- Server-side plan quotas. Existing tenants receive the starter allowance.
ALTER TABLE tenants ADD COLUMN link_limit INTEGER NOT NULL DEFAULT 10
  CHECK (link_limit >= 0 AND link_limit <= 1000000);
ALTER TABLE tenants ADD COLUMN plan_name TEXT NOT NULL DEFAULT 'Inicial';

CREATE INDEX IF NOT EXISTS idx_links_tenant_created ON links(tenant_id, created_at);