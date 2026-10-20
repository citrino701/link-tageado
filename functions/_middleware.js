const TRACKED_PARAMS = [
  "id", "origem", "utm_source", "utm_medium", "utm_campaign",
  "utm_content", "utm_term", "ref", "ua", "lang", "tz",
  "tzoffset", "visitor_id", "click_id"
];

function cookieValue(request, name) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch (_) { return ""; }
}

function buildTrackingUrl(scriptUrl, request, linkId, visitorId, clickId) {
  const endpoint = new URL(scriptUrl);
  const incoming = new URL(request.url);
  TRACKED_PARAMS.forEach(function (key) {
    const value = incoming.searchParams.get(key);
    if (value !== null) endpoint.searchParams.set(key, value.slice(0, 1000));
  });
  endpoint.searchParams.set("id", linkId);
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

async function fallbackRedirect(scriptUrl, request, linkId) {
  const previousVisitorId = cookieValue(request, "hub_link_visitor_id");
  const visitorId = previousVisitorId || crypto.randomUUID();
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

  if (!context.env.LINKS || !context.env.APPS_SCRIPT_URL) {
    return context.next();
  }
  let scriptUrl;
  try {
    scriptUrl = new URL(String(context.env.APPS_SCRIPT_URL));
    if (scriptUrl.protocol !== "https:") return context.next();
  } catch (_) {
    return context.next();
  }

  let link;
  try {
    link = await context.env.LINKS.get("link:" + id, "json");
  } catch (error) {
    console.error("Cloudflare KV lookup failed:", error && error.message || error);
    return fallbackRedirect(scriptUrl.toString(), request, id);
  }

  // KV is eventually consistent. A cold/missing key resolves through Apps Script,
  // which returns the destination and records the click in the same request.
  if (!link) return fallbackRedirect(scriptUrl.toString(), request, id);

  if (link.active === false) {
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

  const visitorId = cookieValue(request, "hub_link_visitor_id") || crypto.randomUUID();
  const clickId = crypto.randomUUID();
  context.waitUntil(
    logClick(scriptUrl.toString(), request, id, visitorId, clickId)
      .catch(function (error) {
        console.error("Background click logging failed:", error && error.message || error);
      })
  );

  const headers = new Headers({
    "location": destination.toString(),
    "cache-control": "no-store"
  });
  if (!cookieValue(request, "hub_link_visitor_id")) {
    headers.append(
      "set-cookie",
      "hub_link_visitor_id=" + encodeURIComponent(visitorId) + "; Path=/; Max-Age=31536000; Secure; SameSite=Lax"
    );
  }
  return new Response(null, { status: 302, headers: headers });
}
