const TRACKED_PARAMS = [
  "id", "origem", "utm_source", "utm_medium", "utm_campaign",
  "bot_hint",
  "utm_content", "utm_term", "ref", "ua", "lang", "tz",
  "tzoffset", "visitor_id", "click_id"
];

function cookieValue(request, name) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch (_) { return ""; }
}

function classifyBotRequest(request) {
  const method = String(request.method || "GET").toUpperCase();
  if (method === "HEAD") return "http-head";

  const purpose = [
    request.headers.get("purpose") || "",
    request.headers.get("sec-purpose") || "",
    request.headers.get("x-purpose") || ""
  ].join(" ").toLowerCase();
  if (/prefetch|prerender|preview/.test(purpose)) return "prefetch";

  const userAgent = request.headers.get("user-agent") || "";
  if (/bot|crawler|spider|preview|fetcher|scraper|facebookexternalhit|facebot|facebookbot|meta-externalagent|meta-externalfetcher|meta-webindexer|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|pinterestbot|bingpreview|googlebot|headlesschrome|phantomjs|puppeteer|playwright/i.test(userAgent)) {
    return "known-crawler";
  }

  const fetchMode = String(request.headers.get("sec-fetch-mode") || "").toLowerCase();
  const fetchDestination = String(request.headers.get("sec-fetch-dest") || "").toLowerCase();
  if (fetchDestination && fetchDestination !== "document" && fetchMode !== "navigate") {
    return "non-navigation-fetch";
  }

  return "";
}

function buildTrackingUrl(scriptUrl, request, linkId, visitorId, clickId) {
  const endpoint = new URL(scriptUrl);
  const incoming = new URL(request.url);
  TRACKED_PARAMS.forEach(function (key) {
    const value = incoming.searchParams.get(key);
    if (value !== null) endpoint.searchParams.set(key, value.slice(0, 1000));
  });
  endpoint.searchParams.set("id", linkId);
  const botHint = classifyBotRequest(request);
  if (botHint) endpoint.searchParams.set("bot_hint", botHint);
  else endpoint.searchParams.delete("bot_hint");
  if (!endpoint.searchParams.get("origem") && endpoint.searchParams.get("utm_source")) {
    endpoint.searchParams.set("origem", endpoint.searchParams.get("utm_source"));
  }
  endpoint.searchParams.set("ref", (request.headers.get("referer") || endpoint.searchParams.get("ref") || "").slice(0, 500));
  endpoint.searchParams.set("ua", (request.headers.get("user-agent") || endpoint.searchParams.get("ua") || "").slice(0, 400));
  endpoint.searchParams.set("lang", (request.headers.get("accept-language") || endpoint.searchParams.get("lang") || "").slice(0, 80));
  const timezone = request.cf && request.cf.timezone;
  if (timezone) endpoint.searchParams.set("tz", String(timezone).slice(0, 80));
  endpoint.searchParams.set("visitor_id", visitorId);
  endpoint.searchParams.set("click_id", clickId);
  endpoint.searchParams.delete("callback");
  return endpoint.toString();
}

async function logClick(scriptUrl, request, linkId, visitorId, clickId) {
  const response = await fetch(buildTrackingUrl(scriptUrl, request, linkId, visitorId, clickId), {
    method: "GET",
    redirect: "follow",
    headers: { "accept": "application/json" }
  });
  if (!response.ok) throw new Error("Apps Script returned HTTP " + response.status);
  const body = await response.text();
  try {
    const result = JSON.parse(body);
    if (result && result.ok === false) {
      throw new Error(result.error || "Apps Script could not record the click.");
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

async function logTenantClick(db, request, linkId, tenantId, visitorId, clickId) {
  const url = new URL(request.url);
  const botHint = classifyBotRequest(request);
  await db.prepare(
    `INSERT OR IGNORE INTO clicks (
      click_id, tenant_id, link_id, occurred_at, visitor_id, is_suspected_bot,
      origin, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      referrer, user_agent, language, timezone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    clickId, tenantId, linkId, new Date().toISOString(), visitorId, botHint ? 1 : 0,
    url.searchParams.get("origem") || url.searchParams.get("utm_source") || "",
    url.searchParams.get("utm_source") || "", url.searchParams.get("utm_medium") || "",
    url.searchParams.get("utm_campaign") || "", url.searchParams.get("utm_content") || "",
    url.searchParams.get("utm_term") || "", (request.headers.get("referer") || url.searchParams.get("ref") || "").slice(0, 500),
    (request.headers.get("user-agent") || url.searchParams.get("ua") || "").slice(0, 400),
    (request.headers.get("accept-language") || url.searchParams.get("lang") || "").slice(0, 80),
    String((request.cf && request.cf.timezone) || url.searchParams.get("tz") || "").slice(0, 80)
  ).run();
}

async function findTenantLink(db, linkId) {
  if (!db) return null;
  return db.prepare(
    `SELECT l.id, l.tenant_id AS tenantId, l.destination_url AS destinationUrl, l.active
       FROM links l JOIN tenants t ON t.id = l.tenant_id
      WHERE l.id = ? AND t.status = 'active'`
  ).bind(linkId).first();
}

function existingVisitorId(request) {
  const saved = cookieValue(request, "hub_link_visitor_id");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(saved)) return "";
  // Discard IDs from the former IP+user-agent hash. They can represent several
  // devices behind one router and must not be reused as browser identities.
  if (/^edge_[a-f0-9]{64}$/i.test(saved)) return "";
  return saved;
}

function visitorIdForRequest(request) {
  // A random first-party browser ID keeps devices on shared Wi-Fi separate.
  return existingVisitorId(request) || crypto.randomUUID();
}

async function fallbackRedirect(scriptUrl, request, linkId) {
  const previousVisitorId = existingVisitorId(request);
  const visitorId = visitorIdForRequest(request);
  const clickId = crypto.randomUUID();
  try {
    const response = await fetch(buildTrackingUrl(scriptUrl, request, linkId, visitorId, clickId), {
      method: "GET",
      redirect: "follow",
      headers: { "accept": "application/json" }
    });
    const payload = await response.json();
    // Apps Script still returns the destination when it queues a click-write failure.
    if (payload && payload.destination) {
      const destination = new URL(String(payload.destination));
      if (destination.protocol !== "https:" && destination.protocol !== "http:") throw new Error("Invalid destination");
      const headers = new Headers({ "location": destination.toString(), "cache-control": "no-store" });
      if (!previousVisitorId) headers.append("set-cookie", "hub_link_visitor_id=" + encodeURIComponent(visitorId) + "; Path=/; Max-Age=31536000; Secure; SameSite=Lax");
      return new Response(null, { status: 302, headers });
    }
  } catch (error) {
    console.error("Apps Script fallback redirect failed:", error && error.message || error);
  }
  return new Response("Este link ainda não está disponível. Tente novamente em instantes.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();

  // This middleware covers the whole Pages project. Only tagged root links
  // need the fast redirect; every other request continues to static assets
  // or the matching API Function.
  if (url.pathname !== "/" || !/^[A-Za-z0-9_-]{3,80}$/.test(id)) {
    return context.next();
  }

  let scriptUrl = null;
  try {
    if (context.env.APPS_SCRIPT_URL) {
      scriptUrl = new URL(String(context.env.APPS_SCRIPT_URL));
      if (scriptUrl.protocol !== "https:") scriptUrl = null;
    }
  } catch (_) { scriptUrl = null; }

  if (!context.env.LINKS && !context.env.DB) {
    return scriptUrl ? fallbackRedirect(scriptUrl.toString(), request, id) : context.next();
  }

  let link;
  if (context.env.LINKS) {
    try {
      link = await context.env.LINKS.get("link:" + id, "json");
    } catch (error) {
      console.error("Cloudflare KV lookup failed:", error && error.message || error);
    }
  }

  // D1 is the source of truth for newly provisioned tenant links. It is also the
  // fallback when their KV entry is cold or temporarily unavailable.
  if (!link) {
    const tenantLink = await findTenantLink(context.env.DB, id).catch((error) => {
      console.error("Tenant link fallback lookup failed:", error && error.message || error);
      return null;
    });
    if (tenantLink) link = tenantLink;
  }
  // Legacy links still resolve and record through the existing Apps Script.
  if (!link) return scriptUrl ? fallbackRedirect(scriptUrl.toString(), request, id) : context.next();

  if (link.active === false || link.active === 0) {
    return new Response("Este link está inativo.", {
      status: 410,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  let destination;
  try {
    destination = new URL(String(link.destinationUrl || ""));
    if (destination.protocol !== "https:" && destination.protocol !== "http:") {
      throw new Error("Invalid protocol");
    }
  } catch (_) {
    return new Response("O destino deste link é inválido.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }

  const visitorId = visitorIdForRequest(request);
  const clickId = crypto.randomUUID();
  const tracking = link.tenantId
    ? logTenantClick(context.env.DB, request, id, link.tenantId, visitorId, clickId)
    : (scriptUrl ? logClick(scriptUrl.toString(), request, id, visitorId, clickId) : Promise.resolve());
  context.waitUntil(
    tracking
      .catch(function (error) {
        console.error("Background click logging failed:", error && error.message || error);
      })
  );

  const headers = new Headers({
    "location": destination.toString(),
    "cache-control": "no-store"
  });
  if (!existingVisitorId(request)) {
    headers.append(
      "set-cookie",
      "hub_link_visitor_id=" + encodeURIComponent(visitorId) + "; Path=/; Max-Age=31536000; Secure; SameSite=Lax"
    );
  }
  return new Response(null, { status: 302, headers: headers });
}
