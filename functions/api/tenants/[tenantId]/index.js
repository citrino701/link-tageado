import { jsonResponse, requireIdentity, requireTenant } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth.response;
  const access = await requireTenant(context, auth.identity);
  if (access.response) return access.response;
  const counts = await context.env.DB.prepare(
    "SELECT COUNT(*) AS links_created FROM links WHERE tenant_id = ?"
  ).bind(access.tenant.tenant_id).first();
  return jsonResponse({
    ok: true,
    tenant: {
      id: access.tenant.tenant_id,
      name: access.tenant.name,
      role: access.tenant.role,
      plan: access.tenant.plan_name,
      status: access.tenant.tenant_status,
      linkLimit: access.tenant.link_limit,
      linksCreated: counts?.links_created || 0
    }
  });
}