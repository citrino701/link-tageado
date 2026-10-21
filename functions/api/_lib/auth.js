const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function decodePart(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return JSON.parse(atob(padded));
}

let cachedJwks = null;
let cachedJwksUntil = 0;

async function getJwks(issuer) {
  if (cachedJwks && Date.now() < cachedJwksUntil) return cachedJwks;
  const response = await fetch(issuer.replace(/\/$/, "") + "/cdn-cgi/access/certs", {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("Não foi possível validar a identidade do Cloudflare Access.");
  const body = await response.json();
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Chaves de identidade do Cloudflare Access inválidas.");
  }
  cachedJwks = body.keys;
  cachedJwksUntil = Date.now() + 5 * 60 * 1000;
  return cachedJwks;
}

async function verifyAccessJwt(token, env) {
  const issuer = String(env.ACCESS_ISSUER || "").replace(/\/$/, "");
  const audience = String(env.ACCESS_AUD || "");
  if (!issuer || !audience) throw new Error("Autenticação do painel não configurada.");

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Token de acesso inválido.");
  const header = decodePart(parts[0]);
  const claims = decodePart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Assinatura do token inválida.");
  if (claims.iss !== issuer) throw new Error("Emissor do token inválido.");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience)) throw new Error("Este token não pertence a este painel.");
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf && claims.nbf > now + 30)) {
    throw new Error("Sessão expirada ou ainda não válida.");
  }
  const email = String(claims.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("O token não contém um e-mail válido.");

  const jwk = (await getJwks(issuer)).find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedJwks = null;
    const refreshed = await getJwks(issuer);
    const refreshedKey = refreshed.find((key) => key.kid === header.kid);
    if (!refreshedKey) throw new Error("Chave de assinatura não reconhecida.");
    return verifySignature(parts, refreshedKey, email);
  }
  return verifySignature(parts, jwk, email);
}

async function verifySignature(parts, jwk, email) {
  const key = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const data = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const signatureText = parts[2].replace(/-/g, "+").replace(/_/g, "/");
  const signature = Uint8Array.from(atob(signatureText + "=".repeat((4 - signatureText.length % 4) % 4)), (c) => c.charCodeAt(0));
  if (!(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data))) {
    throw new Error("Assinatura do token inválida.");
  }
  return { email };
}

export async function requireIdentity(context) {
  const authorization = context.request.headers.get("authorization") || "";
  // Cloudflare Access injects this header after authenticating the browser's
  // Access session cookie. Bearer is retained for API clients and local tests.
  const token = context.request.headers.get("cf-access-jwt-assertion") || authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { response: json({ ok: false, error: "Entre com sua conta para continuar." }, 401) };
  try {
    return { identity: await verifyAccessJwt(token, context.env) };
  } catch (error) {
    return {
      response: json({ ok: false, error: error.message || "Não foi possível validar sua sessão." }, 401)
    };
  }
}

export async function requirePlatformAdmin(context, identity) {
  const configured = String(context.env.PLATFORM_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!configured || identity.email !== configured) {
    return { response: json({ ok: false, error: "Ação exclusiva do administrador geral." }, 403) };
  }
  return { ok: true };
}

export async function requireTenant(context, identity, roles = []) {
  const tenantId = String(context.params?.tenantId || "").trim();
  const membership = await context.env.DB.prepare(
    `SELECT t.id AS tenant_id, t.name, t.status AS tenant_status,
            t.link_limit, t.plan_name, m.role, m.status AS membership_status
       FROM tenant_memberships m JOIN tenants t ON t.id = m.tenant_id
      WHERE m.tenant_id = ? AND lower(m.email) = ?`
  ).bind(tenantId, identity.email).first();

  if (!membership || !["active", "invited"].includes(membership.membership_status)) {
    return { response: json({ ok: false, error: "Sua conta não tem acesso a este espaço." }, 403) };
  }
  if (membership.tenant_status !== "active") {
    return { response: json({ ok: false, error: "Esta conta está temporariamente suspensa." }, 403) };
  }
  if (roles.length && !roles.includes(membership.role)) {
    return { response: json({ ok: false, error: "Seu papel não permite esta ação." }, 403) };
  }
  if (membership.membership_status === "invited") {
    await context.env.DB.prepare(
      `UPDATE tenant_memberships SET status = 'active', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE tenant_id = ? AND lower(email) = ? AND status = 'invited'`
    ).bind(tenantId, identity.email).run();
  }
  return { tenant: membership };
}

export function jsonResponse(body, status = 200) {
  return json(body, status);
}

export function validEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : "";
}