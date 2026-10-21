import { jsonResponse, requireIdentity, requireTenant, validEmail } from "../../../_lib/auth.js";

async function ownerAccess(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth;
  const access = await requireTenant(context, auth.identity, ["owner"]);
  return access.response ? { response: access.response } : { ...access, identity: auth.identity };
}

export async function onRequestPatch(context) {
  const access = await ownerAccess(context);
  if (access.response) return access.response;
  const email = validEmail(context.params.email);
  let body;
  try { body = await context.request.json(); } catch (_) {
    return jsonResponse({ ok: false, error: "JSON inválido." }, 400);
  }
  const role = String(body?.role || "").toLowerCase();
  const status = String(body?.status || "").toLowerCase();
  if (!email || email === access.identity.email || !["admin", "editor", "viewer"].includes(role) || !["active", "disabled", "invited"].includes(status)) {
    return jsonResponse({ ok: false, error: "Alteração de membro inválida." }, 400);
  }
  const result = await context.env.DB.prepare(
    `UPDATE tenant_memberships SET role = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE tenant_id = ? AND lower(email) = ? AND role <> 'owner'`
  ).bind(role, status, access.tenant.tenant_id, email).run();
  if (!result.meta?.changes) return jsonResponse({ ok: false, error: "Membro não encontrado ou sem permissão para alterar." }, 404);
  await context.env.DB.prepare(
    `INSERT INTO audit_log (id, tenant_id, actor_email, action, target_type, target_id, details_json)
     VALUES (?, ?, ?, 'member.updated', 'membership', ?, ?)`
  ).bind(crypto.randomUUID(), access.tenant.tenant_id, access.identity.email, email, JSON.stringify({ role, status })).run();
  return jsonResponse({ ok: true, email, role, status });
}

export async function onRequestDelete(context) {
  const access = await ownerAccess(context);
  if (access.response) return access.response;
  const email = validEmail(context.params.email);
  if (!email || email === access.identity.email) return jsonResponse({ ok: false, error: "Não é possível remover o responsável atual." }, 400);
  const result = await context.env.DB.prepare(
    "DELETE FROM tenant_memberships WHERE tenant_id = ? AND lower(email) = ? AND role <> 'owner'"
  ).bind(access.tenant.tenant_id, email).run();
  if (!result.meta?.changes) return jsonResponse({ ok: false, error: "Membro não encontrado ou sem permissão para remover." }, 404);
  await context.env.DB.prepare(
    `INSERT INTO audit_log (id, tenant_id, actor_email, action, target_type, target_id)
     VALUES (?, ?, ?, 'member.removed', 'membership', ?)`
  ).bind(crypto.randomUUID(), access.tenant.tenant_id, access.identity.email, email).run();
  return jsonResponse({ ok: true, email, removed: true });
}