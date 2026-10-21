import { jsonResponse, requireIdentity, requirePlatformAdmin, validEmail } from "../../_lib/auth.js";

async function platformAccess(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth;
  const access = await requirePlatformAdmin(context, auth.identity);
  return access.response ? { response: access.response } : { identity: auth.identity };
}

export async function onRequestGet(context) {
  const access = await platformAccess(context);
  if (access.response) return access.response;
  const result = await context.env.DB.prepare(
    `SELECT t.id, t.name, t.status, t.plan_name, t.link_limit, t.created_at,
            (SELECT COUNT(*) FROM links l WHERE l.tenant_id = t.id) AS links_created,
            (SELECT m.email FROM tenant_memberships m WHERE m.tenant_id = t.id AND m.role = 'owner' LIMIT 1) AS owner_email
       FROM tenants t ORDER BY t.created_at DESC`
  ).all();
  return jsonResponse({ ok: true, tenants: result.results || [] });
}

export async function onRequestPost(context) {
  const access = await platformAccess(context);
  if (access.response) return access.response;
  let body;
  try { body = await context.request.json(); } catch (_) {
    return jsonResponse({ ok: false, error: "JSON inválido." }, 400);
  }
  const name = String(body?.name || "").trim().slice(0, 120);
  const ownerEmail = validEmail(body?.ownerEmail);
  const planName = String(body?.planName || "Inicial").trim().slice(0, 60) || "Inicial";
  const linkLimit = body?.linkLimit === undefined ? 10 : Number(body.linkLimit);
  if (!name || !ownerEmail || !Number.isInteger(linkLimit) || linkLimit < 0 || linkLimit > 1000000) {
    return jsonResponse({ ok: false, error: "Informe nome, e-mail responsável e cota de links entre 0 e 1.000.000." }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(
      "INSERT INTO tenants (id, name, status, link_limit, plan_name, created_at, updated_at) VALUES (?, ?, 'active', ?, ?, ?, ?)"
    ).bind(id, name, linkLimit, planName, now, now),
    context.env.DB.prepare(
      "INSERT INTO tenant_memberships (tenant_id, email, role, status, invited_by) VALUES (?, ?, 'owner', 'invited', ?)"
    ).bind(id, ownerEmail, access.identity.email),
    context.env.DB.prepare(
      `INSERT INTO audit_log (id, tenant_id, actor_email, action, target_type, target_id, details_json)
       VALUES (?, ?, ?, 'tenant.created', 'tenant', ?, ?)`
    ).bind(crypto.randomUUID(), id, access.identity.email, id, JSON.stringify({ name, ownerEmail, planName, linkLimit }))
  ]);
  return jsonResponse({ ok: true, tenant: { id, name, ownerEmail, status: "active", planName, linkLimit } }, 201);
}