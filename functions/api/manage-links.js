function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function validId(value) {
  return /^[A-Za-z0-9_-]{3,80}$/.test(String(value || ""));
}

function validHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch (_) {
    return false;
  }
}

export async function onRequestPost(context) {
  const expected = String(context.env.SYNC_TOKEN || "");
  const authorization = String(context.request.headers.get("authorization") || "");
  if (!expected || authorization !== "Bearer " + expected) {
    return json({ ok: false, error: "Acesso não autorizado." }, 401);
  }
  if (!context.env.LINKS) {
    return json({ ok: false, error: "Armazenamento de links não configurado." }, 503);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return json({ ok: false, error: "JSON inválido." }, 400);
  }

  const links = Array.isArray(body && body.links) ? body.links : [];
  if (!links.length || links.length > 500) {
    return json({ ok: false, error: "Envie entre 1 e 500 links por solicitação." }, 400);
  }

  try {
    for (const link of links) {
      if (!validId(link && link.id)) {
        return json({ ok: false, error: "ID de link inválido." }, 400);
      }
      if (link.removed === true) {
        await context.env.LINKS.delete("link:" + link.id);
        continue;
      }
      if (!validHttpUrl(link && link.destinationUrl)) {
        return json({ ok: false, error: "Destino inválido para o link " + link.id + "." }, 400);
      }
      await context.env.LINKS.put("link:" + link.id, JSON.stringify({
        destinationUrl: String(link.destinationUrl),
        active: link.active !== false
      }));
    }
  } catch (error) {
    console.error("Cloudflare link sync failed:", error && error.message || error);
    return json({ ok: false, error: "Não foi possível sincronizar os links." }, 503);
  }

  return json({ ok: true, synchronized: links.length });
}
