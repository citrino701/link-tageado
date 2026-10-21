-- Multi-tenant data model foundation for the Link Tageado platform.
-- Not wired to production yet. Do not apply until the Worker API and migration are ready.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A user may belong to more than one tenant. Tenant owners manage memberships
-- in their own tenant; platform admins remain independently controlled.
CREATE TABLE IF NOT EXISTS tenant_memberships (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'disabled')),
  invited_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS platform_admins (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL DEFAULT '',
  sheet_name TEXT NOT NULL DEFAULT 'Cliques',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  slug TEXT,
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS clicks (
  click_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE RESTRICT,
  occurred_at TEXT NOT NULL,
  visitor_id TEXT NOT NULL DEFAULT '',
  is_suspected_bot INTEGER NOT NULL DEFAULT 0
    CHECK (is_suspected_bot IN (0, 1)),
  origin TEXT NOT NULL DEFAULT '',
  utm_source TEXT NOT NULL DEFAULT '',
  utm_medium TEXT NOT NULL DEFAULT '',
  utm_campaign TEXT NOT NULL DEFAULT '',
  utm_content TEXT NOT NULL DEFAULT '',
  utm_term TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE RESTRICT,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_memberships_email_status
  ON tenant_memberships(email, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_name
  ON campaigns(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_links_tenant_campaign
  ON links(tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_tenant_time
  ON clicks(tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_clicks_link_time
  ON clicks(link_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time
  ON audit_log(tenant_id, occurred_at);
