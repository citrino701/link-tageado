import { jsonResponse, requireIdentity, requireTenant, validEmail } from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth.response;
  const access = await requireTenant(context, auth.identity, ["owner"]);
  if (access.response) return access.response;
  const result = await context.env.DB.prepare(
    `SELECT email, role, status, created_at, updated_at
       FROM tenant_memberships WHERE tenant_id = ? ORDER BY role, email`
  ).bind(access.tenant.tenant_id).all();
  return jsonResponse({ ok: true, members: result.results || [] });
}

export async function onRequestPost(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth.response;
  const access = await requireTenant(context, auth.identity, ["owner"]);
  if (access.response) return access.response;
  let body;
  try { body = await context.request.json(); } catch (_) {
    return jsonResponse({ ok: false, error: "JSON inválido." }, 400);
  }
  const email = validEmail(body?.email);
  const role = String(body?.role || "viewer").toLowerCase();
  if (!email || !["admin", "editor", "viewer"].includes(role)) {
    return jsonResponse({ ok: false, error: "Informe um e-mail válido e um papel permitido." }, 400);
  }
  if (email === auth.identity.email) {
    return jsonResponse({ ok: false, error: "Você já é responsável por este espaço." }, 409);
  }
  const result = await context.env.DB.prepare(
    `INSERT INTO tenant_memberships (tenant_id, email, role, status, invited_by)
     VALUES (?, ?, ?, 'invited', ?)
     ON CONFLICT (tenant_id, email) DO UPDATE SET
       role = excluded.role, status = 'invited', invited_by = excluded.invited_by,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
  ).bind(access.tenant.tenant_id, email, role, auth.identity.email).run();
  await context.env.DB.prepare(
    `INSERT INTO audit_log (id, tenant_id, actor_email, action, target_type, target_id, details_json)
     VALUES (?, ?, ?, 'member.invited', 'membership', ?, ?)`
  ).bind(crypto.randomUUID(), access.tenant.tenant_id, auth.identity.email, email, JSON.stringify({ role })).run();
  return jsonResponse({ ok: true, email, role, status: "invited", changes: result.meta?.changes || 0 }, 201);
}