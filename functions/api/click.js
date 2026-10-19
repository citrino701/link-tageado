const CLICK_ID_RE = /^[A-Za-z0-9_-]{3,80}$/;
const TRACKED_PARAMS = [
  "id", "origem", "utm_source", "utm_medium", "utm_campaign",
  "utm_content", "utm_term", "ref", "ua", "lang", "tz",
  "tzoffset", "visitor_id", "click_id"
];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
}

function buildTrackingUrl(scriptUrl, requestUrl) {
  const endpoint = new URL(scriptUrl);
  const incoming = new URL(requestUrl);
  TRACKED_PARAMS.forEach(function (key) {
    const value = incoming.searchParams.get(key);
    if (value !== null) endpoint.searchParams.set(key, value.slice(0, 1000));
  });
  // The Apps Script endpoint returns JSON to this server-side request.
  endpoint.searchParams.delete("callback");
  return endpoint.toString();
}

async function logClick(scriptUrl, requestUrl) {
  const response = await fetch(buildTrackingUrl(scriptUrl, requestUrl), {
    method: "GET",
    redirect: "follow",
    headers: { "accept": "application/json" }
  });
  if (!response.ok) throw new Error("Apps Script returned HTTP " + response.status);
  // Consume the response so the background request can finish cleanly.
  await response.text();
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const id = String(requestUrl.searchParams.get("id") || "").trim();

  if (!CLICK_ID_RE.test(id)) {
    return json({ ok: false, error: "Identificador de link inválido." }, 400);
  }
  if (!context.env.LINKS) {
    return json({ ok: false, error: "Armazenamento de links não configurado." }, 503);
  }
  if (!context.env.APPS_SCRIPT_URL) {
    return json({ ok: false, error: "Endpoint de registro não configurado." }, 503);
  }

  let link;
  try {
    link = await context.env.LINKS.get("link:" + id, "json");
  } catch (error) {
    return json({ ok: false, error: "Não foi possível consultar o link." }, 503);
  }

  // An unsynchronized/older link falls back to the existing Apps Script bridge.
  // This keeps it working while the initial link list is being synchronized.
  if (!link) {
    return json({ ok: false, error: "Link ainda não sincronizado." }, 404);
  }
  if (link.active === false) {
    return json({ ok: false, error: "Este link está inativo." }, 410);
  }
  if (!validHttpUrl(link.destinationUrl)) {
    return json({ ok: false, error: "Destino inválido." }, 500);
  }

  // Return the destination as soon as the edge has resolved it. The existing
  // Apps Script endpoint records the click after the browser has started leaving.
  context.waitUntil(
    logClick(context.env.APPS_SCRIPT_URL, context.request.url)
      .catch(function (error) {
        console.error("Background click logging failed:", error && error.message || error);
      })
  );

  return json({ ok: true, destination: link.destinationUrl });
}
