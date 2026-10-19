const ADMIN_DEFAULT_EMAIL = "hugoviajante@gmail.com";
const REGISTRY_PROPERTY = "TRACKER_REGISTRY_ID";
const ADMIN_EMAIL_PROPERTY = "ADMIN_EMAIL";
const PUBLIC_LINK_BASE_PROPERTY = "PUBLIC_LINK_BASE_URL";
const CLOUDFLARE_MANAGE_URL_PROPERTY = "CLOUDFLARE_MANAGE_URL";
const CLOUDFLARE_SYNC_TOKEN_PROPERTY = "CLOUDFLARE_SYNC_TOKEN";
const PUBLIC_ASSET_BASE = "https://citrino701.github.io/link-tageado/app";

const REGISTRY_HEADERS = [
  "id", "nome", "campanha", "spreadsheetId", "aba", "destinoUrl", "ativo",
  "source", "medium", "content", "spreadsheetUrl", "spreadsheetTitle",
  "destinationType", "whatsappNumber", "whatsappMessage", "createdByEmail",
  "createdAt", "updatedAt"
];

const CLICK_HEADERS = [
  "data_hora", "link_id", "nome_link", "campanha", "destino_url", "origem",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "referenciador", "navegador", "idioma", "fuso_horario",
  "offset_fuso_minutos", "visitor_id", "suspeito_bot", "click_id"
];

const FAILURE_HEADERS = [
  "data_hora", "link_id", "erro", "payload_json", "status", "tentativas"
];

/**
 * Run once from the Apps Script editor after setting TRACKER_REGISTRY_ID
 * in Project Settings > Script Properties.
 */
function setupAdmin() {
  const registry = getRegistry_();
  const links = registry.getSheetByName("Links");
  if (!links) throw new Error('A aba "Links" não existe. Rode setupTracker() no script público primeiro.');
  ensureRegistrySchema_(links);
  ensureFailureSheet_(registry);
  PropertiesService.getScriptProperties().setProperty("ADMIN_SETUP_AT", new Date().toISOString());
  return registry.getUrl();
}

/**
 * Private Apps Script web app entry point. Deploy with:
 * Execute as: User accessing the web app
 * Who has access: Only myself
 */
function doGet() {
  try {
    assertAdmin_();
    const template = HtmlService.createTemplateFromFile("Admin");
    const props = PropertiesService.getScriptProperties();
    template.assetBaseUrl = PUBLIC_ASSET_BASE;
    template.publicLinkBaseUrl = props.getProperty(PUBLIC_LINK_BASE_PROPERTY) ||
      "https://citrino701.github.io/link-tageado/";
    template.clientConfigJson = JSON.stringify({
      publicLinkBaseUrl: template.publicLinkBaseUrl,
      assetBaseUrl: PUBLIC_ASSET_BASE
    });
    return template.evaluate()
      .setTitle("Hub de Links Rastreáveis")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (error) {
    return HtmlService.createHtmlOutput(
      "<h2>Acesso restrito</h2><p>" + escapeHtml_(error.message || String(error)) + "</p>"
    ).setTitle("Acesso restrito");
  }
}

/**
 * API compatibility layer used by the existing React interface through google.script.run.
 * It is deliberately not exposed as doPost/doGet actions: the admin deployment must remain
 * private to the owner.
 */
function apiRequest(method, requestPath, rawBody) {
  try {
    assertAdmin_();
    const verb = String(method || "GET").toUpperCase();
    const path = normalizePath_(requestPath);
    const body = parseBody_(rawBody);

    if (verb === "GET" && path === "/api/admin/bootstrap") {
      return response_(200, {
        adminEmail: assertAdmin_(),
        setupAt: PropertiesService.getScriptProperties().getProperty("ADMIN_SETUP_AT"),
        links: getAllLinks_(false)
      });
    }
    if (verb === "GET" && path === "/api/admin/status") {
      return response_(200, getAdminStatus_());
    }
    if (verb === "GET" && path === "/api/admin/links") {
      return response_(200, { links: getAllLinks_() });
    }
    if (verb === "GET" && path === "/api/admin/queue") {
      return response_(200, { queue: getFailureQueue_() });
    }
    if (verb === "POST" && path === "/api/admin/validate-sheet") {
      return response_(200, validateSheet_(body.spreadsheetUrl, body.aba));
    }
    if (verb === "POST" && path === "/api/admin/links") {
      return response_(201, { success: true, link: createLink_(body) });
    }
    if (verb === "POST" && path === "/api/admin/queue/retry") {
      return response_(200, retryFailures_());
    }
    if (verb === "POST" && path === "/api/admin/run-diagnostic-tests") {
      return response_(200, runDiagnostics_());
    }

    const statusMatch = path.match(/^\/api\/admin\/links\/([^/]+)\/status$/);
    if (verb === "PATCH" && statusMatch) {
      const link = updateLinkStatus_(decodeURIComponent(statusMatch[1]), body.status);
      return link ? response_(200, { success: true, link: link }) :
        response_(404, { error: "Link não encontrado." });
    }

    const deleteMatch = path.match(/^\/api\/admin\/links\/([^/]+)$/);
    if (verb === "DELETE" && deleteMatch) {
      return deleteLink_(decodeURIComponent(deleteMatch[1]))
        ? response_(200, { success: true, message: "Link removido. Os registros de cliques foram mantidos." })
        : response_(404, { error: "Link não encontrado." });
    }

    if (verb === "POST" && path === "/api/auth/logout") {
      return response_(200, { success: true });
    }
    if (verb === "GET" && path === "/api/auth/google/url") {
      return response_(410, { error: "O acesso ao Sheets agora usa a autorização privada do Apps Script." });
    }
    if (verb === "POST" && path === "/api/admin/config-oauth") {
      return response_(410, { error: "OAuth próprio não é usado nesta implantação." });
    }

    return response_(404, { error: "Rota não encontrada: " + path });
  } catch (error) {
    const status = Number(error && error.statusCode) || 400;
    return response_(status, { error: error.message || String(error) });
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function assertAdmin_() {
  const activeEmail = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  const configuredEmail = String(
    PropertiesService.getScriptProperties().getProperty(ADMIN_EMAIL_PROPERTY) ||
    ADMIN_DEFAULT_EMAIL
  ).trim().toLowerCase();

  if (!activeEmail || activeEmail !== configuredEmail) {
    const error = new Error("Entre com a conta autorizada: " + configuredEmail + ".");
    error.statusCode = 403;
    throw error;
  }
  return activeEmail;
}

function runDiagnostics_() {
  const email = assertAdmin_();
  const results = [];
  results.push({
    id: 1,
    title: "Acesso administrativo restrito",
    passed: !!email,
    details: "A sessão autenticada corresponde à conta administradora " + email + "."
  });

  try {
    const registry = getRegistry_();
    const linksSheet = registry.getSheetByName("Links");
    if (!linksSheet) throw new Error('A aba "Links" não existe.');
    ensureRegistrySchema_(linksSheet);
    results.push({
      id: 2,
      title: "Planilha central acessível",
      passed: true,
      details: "A aba Links e o esquema de cadastro estão disponíveis."
    });
  } catch (error) {
    results.push({
      id: 2,
      title: "Planilha central acessível",
      passed: false,
      details: error.message || String(error)
    });
  }

  const publicBase = PropertiesService.getScriptProperties().getProperty(PUBLIC_LINK_BASE_PROPERTY) ||
    "https://citrino701.github.io/link-tageado/";
  results.push({
    id: 3,
    title: "URL pública de rastreamento configurada",
    passed: /^https:\/\//i.test(publicBase),
    details: publicBase
  });

  try {
    const links = getAllLinks_();
    results.push({
      id: 4,
      title: "Cadastro de links carregado",
      passed: true,
      details: links.length + " link(s) encontrados na planilha central."
    });
  } catch (error) {
    results.push({
      id: 4,
      title: "Cadastro de links carregado",
      passed: false,
      details: error.message || String(error)
    });
  }

  return { success: true, allPassed: results.every(function (item) { return item.passed; }), results: results };
}

function getAdminStatus_() {
  const email = assertAdmin_();
  const links = getAllLinks_();
  const totalClicks = links.reduce(function (sum, link) {
    return sum + Number(link.totalClicksCount || 0);
  }, 0);
  const realClicks = links.reduce(function (sum, link) {
    return sum + Number(link.realClicksCount || 0);
  }, 0);
  const uniqueVisitors = links.reduce(function (sum, link) {
    return sum + Number(link.uniqueVisitorsCount || 0);
  }, 0);
  const suspectBots = links.reduce(function (sum, link) {
    return sum + Number(link.suspectBotsCount || 0);
  }, 0);
  const queue = getFailureQueue_();

  return {
    adminEmail: email,
    isOAuthConfigured: true,
    hasClientSecret: false,
    isConnected: true,
    hasRefreshToken: false,
    connectedEmail: email,
    connectedAt: PropertiesService.getScriptProperties().getProperty("ADMIN_SETUP_AT"),
    currentUserEmail: email,
    totalLinks: links.length,
    totalClicks: totalClicks,
    realClicks: realClicks,
    uniqueVisitors: uniqueVisitors,
    suspectBots: suspectBots,
    syncFailuresCount: queue.length
  };
}

function getAllLinks_(includeStats) {
  const registry = getRegistry_();
  const sheet = registry.getSheetByName("Links");
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = headerMap_(rows[0]);
  ensureHeadersPresent_(headers, ["id", "nome", "campanha", "spreadsheetId", "aba", "destinoUrl", "ativo"]);
  const links = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(value_(row, headers, "id") || "").trim();
    if (!id) continue;
    const destinationUrl = String(value_(row, headers, "destinoUrl") || "").trim();
    const spreadsheetId = normalizeSpreadsheetId_(value_(row, headers, "spreadsheetId"));
    const active = isActive_(value_(row, headers, "ativo"));
    links.push({
      id: id,
      name: String(value_(row, headers, "nome") || ""),
      spreadsheetId: spreadsheetId,
      aba: String(value_(row, headers, "aba") || "Cliques"),
      spreadsheetUrl: String(value_(row, headers, "spreadsheetUrl") ||
        ("https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/edit")),
      spreadsheetTitle: String(value_(row, headers, "spreadsheetTitle") || "Planilha Google"),
      destinationType: String(value_(row, headers, "destinationType") ||
        (destinationUrl.indexOf("wa.me/") >= 0 ? "whatsapp" : "url")),
      destinationUrl: destinationUrl,
      whatsappNumber: String(value_(row, headers, "whatsappNumber") || ""),
      whatsappMessage: String(value_(row, headers, "whatsappMessage") || ""),
      campaign: String(value_(row, headers, "campanha") || ""),
      source: String(value_(row, headers, "source") || "Direto"),
      medium: String(value_(row, headers, "medium") || ""),
      content: String(value_(row, headers, "content") || ""),
      shortPath: "?id=" + encodeURIComponent(id),
      status: active ? "active" : "inactive",
      realClicksCount: 0,
      totalClicksCount: 0,
      uniqueVisitorsCount: 0,
      suspectBotsCount: 0,
      createdByEmail: String(value_(row, headers, "createdByEmail") || ""),
      createdAt: isoValue_(value_(row, headers, "createdAt")),
      updatedAt: isoValue_(value_(row, headers, "updatedAt"))
    });
  }

  const stats = includeStats === false ? {} : getClickStats_(links);
  links.forEach(function (link) {
    const key = link.id;
    const item = stats[key] || {};
    link.totalClicksCount = item.total || 0;
    link.realClicksCount = Math.max(0, (item.total || 0) - (item.bots || 0));
    link.uniqueVisitorsCount = item.unique || 0;
    link.suspectBotsCount = item.bots || 0;
  });

  return links.sort(function (a, b) {
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function getClickStats_(links) {
  const grouped = {};
  links.forEach(function (link) {
    const key = link.spreadsheetId + "::" + (link.aba || "Cliques");
    if (!grouped[key]) grouped[key] = { spreadsheetId: link.spreadsheetId, tab: link.aba || "Cliques", ids: {} };
    grouped[key].ids[link.id] = true;
  });
  const result = {};

  Object.keys(grouped).forEach(function (key) {
    const group = grouped[key];
    try {
      const sheet = SpreadsheetApp.openById(group.spreadsheetId).getSheetByName(group.tab);
      if (!sheet || sheet.getLastRow() < 2) return;
      const values = sheet.getDataRange().getValues();
      const headers = headerMap_(values[0]);
      const idColumn = headers.link_id;
      if (idColumn === undefined) return;
      const visitorColumn = headers.visitor_id;
      const botColumn = headers.suspeito_bot;

      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const id = String(row[idColumn] || "").trim();
        if (!group.ids[id]) continue;
        if (!result[id]) result[id] = { total: 0, bots: 0, visitors: {} };
        result[id].total++;
        const userAgentColumn = headers.navegador;
        const browser = userAgentColumn === undefined ? "" : String(row[userAgentColumn] || "");
        const markedBot = botColumn !== undefined && isActive_(row[botColumn]);
        if (markedBot || /bot|crawler|spider|preview|whatsapp|facebookexternalhit|telegrambot/i.test(browser)) {
          result[id].bots++;
        }
        if (visitorColumn !== undefined) {
          const visitor = String(row[visitorColumn] || "").trim();
          if (visitor) result[id].visitors[visitor] = true;
        }
      }
    } catch (ignored) {}
  });

  Object.keys(result).forEach(function (id) {
    result[id].unique = Object.keys(result[id].visitors).length;
    delete result[id].visitors;
  });
  return result;
}

function validateSheet_(spreadsheetUrl, aba) {
  const spreadsheetId = extractSpreadsheetId_(spreadsheetUrl);
  if (!spreadsheetId) throw new Error("Cole uma URL válida do Google Sheets.");
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  ensureClickSheet_(spreadsheet, String(aba || "Cliques"));
  return {
    success: true,
    spreadsheetId: spreadsheetId,
    title: spreadsheet.getName(),
    sheetsCreated: []
  };
}

/** Resolve only existing registry associations; never silently choose an ambiguous target. */
function resolveCampaign_(input, links) {
  const name = String(input.campaign || "").trim();
  const rawUrl = String(input.spreadsheetUrl || "").trim();
  const id = extractSpreadsheetId_(rawUrl);
  const aba = String(input.aba || "").trim();
  if (rawUrl && !id) throw new Error("Link da planilha Google inválido.");
  const catalog = Object.create(null);
  links.forEach(function (link) {
    const campaign = String(link.campaign || "").trim();
    if (!campaign || !link.spreadsheetId) return;
    if (!catalog[campaign]) catalog[campaign] = [];
    const tab = link.aba || "Cliques";
    if (!catalog[campaign].some(function (t) { return t.spreadsheetId === link.spreadsheetId && t.aba === tab; })) {
      catalog[campaign].push({ spreadsheetId: link.spreadsheetId, aba: tab });
    }
  });
  const names = Object.keys(catalog);
  const matches = names.filter(function (n) { return n.toLowerCase() === name.toLowerCase(); });
  let campaign = names.indexOf(name) >= 0 ? name : matches.length === 1 ? matches[0] : "";
  const sheetCampaigns = names.filter(function (n) {
    return catalog[n].some(function (t) { return t.spreadsheetId === id; });
  });
  if (!campaign && sheetCampaigns.length === 1) campaign = sheetCampaigns[0];
  if (!campaign && sheetCampaigns.length > 1) {
    throw new Error("Esta planilha pertence a mais de uma campanha. Selecione a campanha desejada.");
  }
  if (campaign) {
    const targets = catalog[campaign].filter(function (t) {
      return (!id || t.spreadsheetId === id) && (!aba || t.aba === aba);
    });
    if (targets.length === 0) throw new Error("A planilha informada não pertence à campanha selecionada.");
    if (targets.length > 1) throw new Error("Esta campanha possui mais de uma planilha ou aba. Escolha onde registrar os cliques.");
    return {
      campaign: campaign,
      spreadsheetId: targets[0].spreadsheetId,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/" + targets[0].spreadsheetId + "/edit",
      aba: targets[0].aba
    };
  }
  if (!name) throw new Error("A campanha é obrigatória.");
  if (!id) throw new Error("Cole a planilha da nova campanha ou selecione uma campanha existente.");
  return { campaign: name, spreadsheetId: id, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/" + id + "/edit", aba: "Cliques" };
}

function createLink_(input) {
  const name = String(input.name || "").trim();
  const association = resolveCampaign_(input, getAllLinks_(false));
  const campaign = association.campaign;
  const source = String(input.source || "").trim();
  if (!name) throw new Error("O nome do link é obrigatório.");
  if (!campaign) throw new Error("A campanha é obrigatória.");
  if (!source) throw new Error("A origem é obrigatória.");

  const spreadsheetId = association.spreadsheetId;
  if (!spreadsheetId) throw new Error("Link da planilha Google inválido.");
  const destinationType = String(input.destinationType || "");
  if (destinationType !== "url" && destinationType !== "whatsapp") {
    throw new Error("Escolha um destino válido.");
  }

  let destinationUrl = "";
  let whatsappNumber = "";
  let whatsappMessage = "";
  if (destinationType === "whatsapp") {
    whatsappNumber = String(input.whatsappNumber || "").replace(/\D/g, "");
    if (whatsappNumber.length < 10) throw new Error("Informe WhatsApp com código do país e DDD.");
    whatsappMessage = String(input.whatsappMessage || "");
    destinationUrl = "https://wa.me/" + whatsappNumber +
      (whatsappMessage ? "?text=" + encodeURIComponent(whatsappMessage) : "");
  } else {
    destinationUrl = validateDestination_(input.destinationUrl);
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  ensureClickSheet_(spreadsheet, association.aba);
  const registry = getRegistry_();
  let linksSheet = registry.getSheetByName("Links");
  if (!linksSheet) linksSheet = registry.insertSheet("Links");
  const headerMap = ensureRegistrySchema_(linksSheet);
  const id = generateUniqueId_(linksSheet, headerMap);
  const now = new Date().toISOString();
  const link = {
    id: id,
    name: name,
    spreadsheetId: spreadsheetId,
    spreadsheetUrl: association.spreadsheetUrl,
    aba: association.aba,
    spreadsheetTitle: spreadsheet.getName(),
    destinationType: destinationType,
    destinationUrl: destinationUrl,
    whatsappNumber: whatsappNumber,
    whatsappMessage: whatsappMessage,
    campaign: campaign,
    source: source,
    medium: String(input.medium || "Direto").trim(),
    content: String(input.content || "").trim(),
    shortPath: "?id=" + encodeURIComponent(id),
    status: "active",
    realClicksCount: 0,
    totalClicksCount: 0,
    uniqueVisitorsCount: 0,
    suspectBotsCount: 0,
    createdByEmail: assertAdmin_(),
    createdAt: now,
    updatedAt: now
  };
  const values = {
    id: id,
    nome: name,
    campanha: campaign,
    spreadsheetId: spreadsheetId,
    aba: association.aba,
    destinoUrl: destinationUrl,
    ativo: true,
    source: source,
    medium: link.medium,
    content: link.content,
    spreadsheetUrl: link.spreadsheetUrl,
    spreadsheetTitle: link.spreadsheetTitle,
    destinationType: destinationType,
    whatsappNumber: whatsappNumber,
    whatsappMessage: whatsappMessage,
    createdByEmail: link.createdByEmail,
    createdAt: now,
    updatedAt: now
  };
  linksSheet.appendRow(headersToRow_(headerMap, values));
  try {
    link.cloudflareSynced = syncCloudflareLinks_([{
      id: link.id,
      destinationUrl: link.destinationUrl,
      active: true
    }]);
  } catch (syncError) {
    link.cloudflareSynced = false;
    console.error("Cloudflare link sync failed:", syncError && syncError.message || syncError);
  }
  return link;
}

function syncAllLinksToCloudflare() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(CLOUDFLARE_SYNC_TOKEN_PROPERTY)) {
    throw new Error("Configure CLOUDFLARE_SYNC_TOKEN antes de sincronizar.");
  }
  const links = getAllLinks_(false);
  let synchronized = 0;
  for (let i = 0; i < links.length; i += 500) {
    const batch = links.slice(i, i + 500).map(function (link) {
      return {
        id: link.id,
        destinationUrl: link.destinationUrl,
        active: link.status === "active"
      };
    });
    if (batch.length) {
      syncCloudflareLinks_(batch);
      synchronized += batch.length;
    }
  }
  return { success: true, synchronized: synchronized };
}

function syncCloudflareLinks_(links) {
  if (!links || !links.length) return true;
  const props = PropertiesService.getScriptProperties();
  const token = String(props.getProperty(CLOUDFLARE_SYNC_TOKEN_PROPERTY) || "").trim();
  if (!token) return false;
  const url = String(props.getProperty(CLOUDFLARE_MANAGE_URL_PROPERTY) ||
    "https://linkshorter.pages.dev/api/manage-links").trim();
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ links: links }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  let result = {};
  try { result = JSON.parse(response.getContentText() || "{}"); } catch (ignored) {}
  if (status < 200 || status >= 300 || result.ok !== true) {
    throw new Error(result.error || "Cloudflare recusou a sincronização (HTTP " + status + ").");
  }
  return true;
}

function updateLinkStatus_(id, status) {
  if (status !== "active" && status !== "inactive") throw new Error("Status inválido.");
  const sheet = getRegistry_().getSheetByName("Links");
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  const idColumn = headers.id;
  const statusColumn = headers.ativo;
  const updatedColumn = headers.updatedAt;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idColumn]).trim() !== id) continue;
    sheet.getRange(i + 1, statusColumn + 1).setValue(status === "active");
    if (updatedColumn !== undefined) sheet.getRange(i + 1, updatedColumn + 1).setValue(new Date().toISOString());
    const link = getAllLinks_(false).find(function (item) { return item.id === id; });
    if (link) {
      try {
        link.cloudflareSynced = syncCloudflareLinks_([{
          id: link.id,
          destinationUrl: link.destinationUrl,
          active: link.status === "active"
        }]);
      } catch (syncError) {
        link.cloudflareSynced = false;
        console.error("Cloudflare status sync failed:", syncError && syncError.message || syncError);
      }
    }
    return link || null;
  }
  return null;
}

function deleteLink_(id) {
  const sheet = getRegistry_().getSheetByName("Links");
  if (!sheet || sheet.getLastRow() < 2) return false;
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  for (let i = values.length - 1; i > 0; i--) {
    if (String(values[i][headers.id]).trim() === id) {
      try {
        syncCloudflareLinks_([{ id: id, removed: true }]);
      } catch (syncError) {
        throw new Error("Não removi o link: falhou a sincronização com o Cloudflare. " +
          (syncError.message || String(syncError)));
      }
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

function getFailureQueue_() {
  const registry = getRegistry_();
  const sheet = registry.getSheetByName("Falhas");
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  const queue = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const linkId = String(value_(row, headers, "link_id") || "");
    if (!linkId) continue;
    const status = String(value_(row, headers, "status") || "failed");
    if (status === "resolved") continue;
    const config = findLinkConfig_(linkId);
    let payload = {};
    try { payload = JSON.parse(String(value_(row, headers, "payload_json") || "{}")); } catch (ignored) {}
    queue.push({
      queueId: String(i),
      clickId: String(payload.params && payload.params.click_id || ""),
      linkId: linkId,
      linkName: config ? config.name : "Link " + linkId,
      spreadsheetId: config ? config.spreadsheetId : "",
      clickRecord: {},
      error: String(value_(row, headers, "erro") || "Erro ao registrar clique."),
      attempts: Number(value_(row, headers, "tentativas") || 1),
      createdAt: isoValue_(value_(row, headers, "data_hora")),
      status: status === "pending" ? "pending" : "failed"
    });
  }
  return queue;
}

function retryFailures_() {
  const registry = getRegistry_();
  const sheet = registry.getSheetByName("Falhas");
  if (!sheet || sheet.getLastRow() < 2) return { success: true, processed: 0, queue: [] };
  const values = sheet.getDataRange().getValues();
  const headers = ensureFailureSheet_(registry);
  const payloadColumn = headers.payload_json;
  const statusColumn = headers.status;
  const attemptsColumn = headers.tentativas;
  let processed = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const status = statusColumn === undefined ? "" : String(row[statusColumn] || "");
    if (status === "resolved") continue;
    const payloadText = payloadColumn === undefined ? "" : String(row[payloadColumn] || "");
    if (!payloadText) continue;
    try {
      const payload = JSON.parse(payloadText);
      const config = payload.config;
      if (!config || !config.spreadsheetId) throw new Error("Dados do evento estão incompletos.");
      const params = payload.params || {};
      if (!params.click_id) params.click_id = Utilities.getUuid();
      payload.params = params;
      sheet.getRange(i + 1, payloadColumn + 1).setValue(JSON.stringify(payload));
      appendClickForConfig_(config, params);
      sheet.getRange(i + 1, statusColumn + 1).setValue("resolved");
      const attempts = attemptsColumn === undefined ? 0 : Number(row[attemptsColumn] || 0);
      sheet.getRange(i + 1, attemptsColumn + 1).setValue(attempts + 1);
      processed++;
    } catch (error) {
      const attempts = attemptsColumn === undefined ? 0 : Number(row[attemptsColumn] || 0);
      if (attemptsColumn !== undefined) sheet.getRange(i + 1, attemptsColumn + 1).setValue(attempts + 1);
      const errorColumn = headers.erro;
      if (errorColumn !== undefined) sheet.getRange(i + 1, errorColumn + 1).setValue(error.message || String(error));
    }
  }
  return { success: true, processed: processed, queue: getFailureQueue_() };
}

function findLinkConfig_(linkId) {
  const sheet = getRegistry_().getSheetByName("Links");
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  for (let i = 1; i < values.length; i++) {
    if (String(value_(values[i], headers, "id") || "").trim() !== linkId) continue;
    return {
      id: linkId,
      name: String(value_(values[i], headers, "nome") || ""),
      campaign: String(value_(values[i], headers, "campanha") || ""),
      spreadsheetId: normalizeSpreadsheetId_(value_(values[i], headers, "spreadsheetId")),
      aba: String(value_(values[i], headers, "aba") || "Cliques"),
      destinoUrl: String(value_(values[i], headers, "destinoUrl") || ""),
      source: String(value_(values[i], headers, "source") || ""),
      medium: String(value_(values[i], headers, "medium") || ""),
      content: String(value_(values[i], headers, "content") || "")
    };
  }
  return null;
}

function appendClickForConfig_(config, params) {
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = ensureClickSheet_(spreadsheet, config.aba || "Cliques");
  const headers = headerMap_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const userAgent = String(params.ua || "");
  const clickId = String(params.click_id || Utilities.getUuid());
  params.click_id = clickId;
  const values = {
    data_hora: new Date(),
    link_id: config.id,
    nome_link: safeCell_(config.name || config.nome || ""),
    campanha: safeCell_(config.campaign || config.campanha || ""),
    destino_url: safeCell_(config.destinoUrl || ""),
    origem: safeCell_(params.origem || config.source || "Direto"),
    utm_source: safeCell_(params.utm_source || config.source || ""),
    utm_medium: safeCell_(params.utm_medium || config.medium || ""),
    utm_campaign: safeCell_(params.utm_campaign || config.campaign || config.campanha || ""),
    utm_content: safeCell_(params.utm_content || config.content || ""),
    utm_term: safeCell_(params.utm_term || ""),
    referenciador: safeCell_(params.ref || ""),
    navegador: safeCell_(userAgent),
    idioma: safeCell_(params.lang || ""),
    fuso_horario: safeCell_(params.tz || ""),
    offset_fuso_minutos: safeCell_(params.tzoffset || ""),
    visitor_id: safeCell_(params.visitor_id || ""),
    suspeito_bot: isBot_(userAgent),
    click_id: safeCell_(clickId)
  };
  const row = [];
  Object.keys(headers).sort(function (a, b) { return headers[a] - headers[b]; }).forEach(function (name) {
    row.push(values[name] === undefined ? "" : values[name]);
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (clickIdExists_(sheet, headers, clickId)) return;
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function clickIdExists_(sheet, headers, clickId) {
  const id = String(clickId || "").trim();
  const column = headers.click_id;
  if (!id || column === undefined || sheet.getLastRow() < 2) return false;
  return !!sheet.getRange(2, column + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
}

function ensureClickSheet_(spreadsheet, name) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CLICK_HEADERS.length).setValues([CLICK_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (v) { return String(v).trim(); });
  const existingMap = headerMap_(existing);
  CLICK_HEADERS.slice(0, 16).forEach(function (header) {
    if (existingMap[header] === undefined) {
      throw new Error('A aba "' + name + '" tem cabeçalho diferente. Escolha uma aba vazia ou use Cliques.');
    }
  });
  CLICK_HEADERS.forEach(function (header) {
    if (existingMap[header] === undefined) {
      const next = sheet.getLastColumn() + 1;
      sheet.getRange(1, next).setValue(header);
      existingMap[header] = next - 1;
    }
  });
  return sheet;
}

function ensureRegistrySchema_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, REGISTRY_HEADERS.length).setValues([REGISTRY_HEADERS]);
    sheet.setFrozenRows(1);
    return headerMap_(REGISTRY_HEADERS);
  }
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (v) { return String(v).trim(); });
  let headers = headerMap_(existing);
  const required = ["id", "nome", "campanha", "spreadsheetId", "aba", "destinoUrl", "ativo"];
  ensureHeadersPresent_(headers, required);
  REGISTRY_HEADERS.forEach(function (header) {
    if (headers[header] === undefined) {
      const next = sheet.getLastColumn() + 1;
      sheet.getRange(1, next).setValue(header);
      headers[header] = next - 1;
    }
  });
  return headers;
}

function ensureFailureSheet_(registry) {
  let sheet = registry.getSheetByName("Falhas");
  if (!sheet) sheet = registry.insertSheet("Falhas");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, FAILURE_HEADERS.length).setValues([FAILURE_HEADERS]);
    sheet.setFrozenRows(1);
    return headerMap_(FAILURE_HEADERS);
  }
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (v) { return String(v).trim(); });
  let headers = headerMap_(existing);
  ensureHeadersPresent_(headers, ["data_hora", "link_id", "erro"]);
  FAILURE_HEADERS.forEach(function (header) {
    if (headers[header] === undefined) {
      const next = sheet.getLastColumn() + 1;
      sheet.getRange(1, next).setValue(header);
      headers[header] = next - 1;
    }
  });
  return headers;
}

function getRegistry_() {
  const id = PropertiesService.getScriptProperties().getProperty(REGISTRY_PROPERTY);
  if (!id) throw new Error("Configure a propriedade TRACKER_REGISTRY_ID com o ID da planilha central.");
  return SpreadsheetApp.openById(id);
}

function generateUniqueId_(sheet, headers) {
  const existingIds = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, headers.id + 1, sheet.getLastRow() - 1, 1).getValues().forEach(function (row) {
      existingIds[String(row[0] || "")] = true;
    });
  }
  let id = "";
  do {
    id = Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  } while (existingIds[id]);
  return id;
}

function normalizePath_(value) {
  let path = String(value || "");
  path = path.replace(/^https?:\/\/[^/]+/i, "");
  path = path.split("?")[0].replace(/\/$/, "");
  return path || "/";
}

function parseBody_(rawBody) {
  if (!rawBody) return {};
  if (typeof rawBody === "object") return rawBody;
  try {
    return JSON.parse(String(rawBody));
  } catch (error) {
    return {};
  }
}

function response_(status, body) {
  return { status: status, body: body };
}

function headerMap_(headers) {
  const map = {};
  headers.forEach(function (header, index) {
    const name = String(header || "").trim();
    if (name) map[name] = index;
  });
  return map;
}

function ensureHeadersPresent_(headers, required) {
  required.forEach(function (header) {
    if (headers[header] === undefined) throw new Error("Coluna ausente: " + header);
  });
}

function headersToRow_(headers, values) {
  const row = [];
  Object.keys(headers).sort(function (a, b) { return headers[a] - headers[b]; }).forEach(function (name) {
    row.push(values[name] === undefined ? "" : values[name]);
  });
  return row;
}

function value_(row, headers, name) {
  return headers[name] === undefined ? "" : row[headers[name]];
}

function extractSpreadsheetId_(value) {
  const text = String(value || "").trim();
  const match = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(text) ? text : "";
}

function normalizeSpreadsheetId_(value) {
  const text = String(value || "").trim();
  const match = text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : text;
}

function isActive_(value) {
  const text = String(value).trim().toLowerCase();
  return value === true || ["true", "1", "sim", "yes", "ativo"].indexOf(text) >= 0;
}

function validateDestination_(value) {
  const url = String(value || "").trim();
  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    throw new Error("O destino precisa começar com http:// ou https://.");
  }
  return url;
}

function safeCell_(value) {
  let text = String(value == null ? "" : value).slice(0, 1000);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function isBot_(userAgent) {
  return /bot|crawler|spider|preview|whatsapp|facebookexternalhit|telegrambot/i.test(String(userAgent || ""));
}

function isoValue_(value) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : String(value);
}

function escapeHtml_(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

