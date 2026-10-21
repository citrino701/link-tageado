import { jsonResponse, requireIdentity, requireTenant } from "../../../_lib/auth.js";

function validDestination(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch (_) { return ""; }
}

export async function onRequestGet(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth.response;
  const access = await requireTenant(context, auth.identity);
  if (access.response) return access.response;
  const result = await context.env.DB.prepare(
    `SELECT l.id, l.name, l.destination_url, l.active, l.slug, l.source, l.medium, l.content,
            l.created_at, c.name AS campaign,
            COUNT(k.click_id) AS total_clicks,
            COUNT(DISTINCT NULLIF(k.visitor_id, '')) AS unique_visitors
       FROM links l LEFT JOIN campaigns c ON c.id = l.campaign_id AND c.tenant_id = l.tenant_id
       LEFT JOIN clicks k ON k.link_id = l.id AND k.tenant_id = l.tenant_id
      WHERE l.tenant_id = ? GROUP BY l.id ORDER BY l.created_at DESC`
  ).bind(access.tenant.tenant_id).all();
  return jsonResponse({ ok: true, links: result.results || [] });
}

export async function onRequestPost(context) {
  const auth = await requireIdentity(context);
  if (auth.response) return auth.response;
  const access = await requireTenant(context, auth.identity, ["owner", "admin", "editor"]);
  if (access.response) return access.response;
  if (!context.env.LINKS) return jsonResponse({ ok: false, error: "Armazenamento rápido de links não configurado." }, 503);
  let body;
  try { body = await context.request.json(); } catch (_) {
    return jsonResponse({ ok: false, error: "JSON inválido." }, 400);
  }
  const name = String(body?.name || "").trim().slice(0, 160);
  const destination = validDestination(body?.destinationUrl);
  const campaignName = String(body?.campaign || "").trim().slice(0, 120);
  if (!name || !destination) return jsonResponse({ ok: false, error: "Informe o nome e um destino http ou https válido." }, 400);

  let campaignId = null;
  if (campaignName) {
    await context.env.DB.prepare(
      `INSERT OR IGNORE INTO campaigns (id, tenant_id, name)
       VALUES (?, ?, ?)`
    ).bind(crypto.randomUUID(), access.tenant.tenant_id, campaignName).run();
    const campaign = await context.env.DB.prepare(
      "SELECT id FROM campaigns WHERE tenant_id = ? AND name = ?"
    ).bind(access.tenant.tenant_id, campaignName).first();
    campaignId = campaign?.id || null;
  }

  const id = crypto.randomUUID();
  const inserted = await context.env.DB.prepare(
    `INSERT INTO links (id, tenant_id, campaign_id, name, destination_url, active, slug, source, medium, content)
     SELECT ?, t.id, ?, ?, ?, 1, ?, ?, ?, ? FROM tenants t
      WHERE t.id = ? AND t.status = 'active'
        AND (SELECT COUNT(*) FROM links WHERE tenant_id = t.id) < t.link_limit
        AND (? IS NULL OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = ? AND c.tenant_id = t.id))
     RETURNING id`
  ).bind(
    id, campaignId, name, destination, id,
    String(body?.source || "").slice(0, 200), String(body?.medium || "").slice(0, 200),
    String(body?.content || "").slice(0, 200), access.tenant.tenant_id, campaignId, campaignId
  ).first();
  if (!inserted) {
    const latest = await context.env.DB.prepare("SELECT link_limit FROM tenants WHERE id = ?").bind(access.tenant.tenant_id).first();
    return jsonResponse({ ok: false, error: "A cota de links desta conta foi atingida.", linkLimit: latest?.link_limit ?? access.tenant.link_limit }, 409);
  }

  try {
    await context.env.LINKS.put("link:" + id, JSON.stringify({
      destinationUrl: destination,
      active: true,
      tenantId: access.tenant.tenant_id
    }));
  } catch (error) {
    await context.env.DB.prepare("DELETE FROM links WHERE id = ? AND tenant_id = ?").bind(id, access.tenant.tenant_id).run();
    console.error("Tenant link KV write failed:", error?.message || error);
    return jsonResponse({ ok: false, error: "Não foi possível publicar o link. Tente novamente." }, 503);
  }
  await context.env.DB.prepare(
    `INSERT INTO audit_log (id, tenant_id, actor_email, action, target_type, target_id)
     VALUES (?, ?, ?, 'link.created', 'link', ?)`
  ).bind(crypto.randomUUID(), access.tenant.tenant_id, auth.identity.email, id).run();
  return jsonResponse({
    ok: true,
    link: { id, name, destinationUrl: destination, campaign: campaignName, active: true, publicUrl: "https://linkshorter.pages.dev/?id=" + id }
  }, 201);
}