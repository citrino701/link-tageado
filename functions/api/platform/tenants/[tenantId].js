import { jsonResponse, requireIdentity, requirePlatformAdmin } from "../../_lib/auth.js";

export async function onRequestPatch(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth.response;
  const platform = await requirePlatformAdmin(context, auth.identity);
  if (platform.response) return platform.response;
  const tenantId = String(context.params.tenantId || "").trim();
  let body;
  try { body = await context.request.json(); } catch (_) {
    return jsonResponse({ ok: false, error: "JSON inválido." }, 400);
  }
  const updates = [];
  const values = [];
  if (body?.status !== undefined) {
    const status = String(body.status).toLowerCase();
    if (!["active", "suspended"].includes(status)) return jsonResponse({ ok: false, error: "Status inválido." }, 400);
    updates.push("status = ?"); values.push(status);
  }
  if (body?.linkLimit !== undefined) {
    const limit = Number(body.linkLimit);
    if (!Number.isInteger(limit) || limit < 0 || limit > 1000000) return jsonResponse({ ok: false, error: "Cota de links inválida." }, 400);
    updates.push("link_limit = ?"); values.push(limit);
  }
  if (body?.planName !== undefined) {
    const name = String(body.planName).trim().slice(0, 60);
    if (!name) return jsonResponse({ ok: false, error: "Nome do plano inválido." }, 400);
    updates.push("plan_name = ?"); values.push(name);
  }
  if (!updates.length) return jsonResponse({ ok: false, error: "Nenhuma alteração informada." }, 400);
  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  values.push(tenantId);
  const result = await context.env.DB.prepare(
    `UPDATE tenants SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();
  if (!result.meta?.changes) return jsonResponse({ ok: false, error: "Conta não encontrada." }, 404);
  await context.env.DB.prepare(
    `INSERT INTO audit_log (id, tenant_id, actor_email, action, target_type, target_id, details_json)
     VALUES (?, ?, ?, 'tenant.updated', 'tenant', ?, ?)`
  ).bind(crypto.randomUUID(), tenantId, auth.identity.email, tenantId, JSON.stringify(body)).run();
  const tenant = await context.env.DB.prepare(
    "SELECT id, name, status, plan_name, link_limit FROM tenants WHERE id = ?"
  ).bind(tenantId).first();
  return jsonResponse({ ok: true, tenant });
}