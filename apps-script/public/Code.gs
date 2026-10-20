const REGISTRY_PROPERTY = "TRACKER_REGISTRY_ID";

const LINKS_HEADERS = [
  "id", "nome", "campanha", "spreadsheetId", "aba", "destinoUrl", "ativo"
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
 * Run once from the Apps Script editor. Reuses the registry already created
 * by the earlier tracker script, or creates it if this is a fresh setup.
 */
function setupTracker() {
  const props = PropertiesService.getScriptProperties();
  let registryId = props.getProperty(REGISTRY_PROPERTY);
  let registry;

  if (registryId) {
    registry = SpreadsheetApp.openById(registryId);
  } else {
    registry = SpreadsheetApp.create("Hub de Links - Configurações");
    registryId = registry.getId();
    props.setProperty(REGISTRY_PROPERTY, registryId);
  }

  let links = registry.getSheetByName("Links");
  if (!links) links = registry.insertSheet("Links");
  migrateLinksSchema_(links);
  ensureFailureSheet_(registry);
  Logger.log("Planilha central: " + registry.getUrl());
  installRetryTrigger_();
  return registry.getUrl();
}

/**
 * Public click endpoint. Deploy this project as a web app that runs as the
 * owner and allows anyone to access it; visitors never authenticate.
 */
function doGet(e) {
  const params = Object.assign({}, (e && e.parameter) || {});
  if (!params.click_id) params.click_id = Utilities.getUuid();
  const linkId = String(params.id || "").trim();
  let destination = "";
  let result;

  try {
    if (!/^[A-Za-z0-9_-]{3,80}$/.test(linkId)) {
      throw new Error("Identificador de link inválido.");
    }

    const config = findLink_(linkId);
    if (!config) throw new Error("Link não encontrado ou inativo.");
    destination = validateDestination_(config.destinoUrl);

    try {
      appendClick_(config, params);
      result = { ok: true, destination: destination };
    } catch (writeError) {
      saveFailure_(linkId, writeError, config, params);
      result = {
        ok: false,
        destination: destination,
        error: "Não foi possível registrar o clique."
      };
    }
  } catch (error) {
    // Requests for unknown/inactive IDs cannot be retried; do not let arbitrary
    // public requests fill the persistent failure queue.
    result = {
      ok: false,
      destination: destination,
      error: error.message || "Erro ao processar o link."
    };
  }

  return makeResponse_(result, params.callback);
}

function migrateLinksSchema_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LINKS_HEADERS.length).setValues([LINKS_HEADERS]);
    sheet.setFrozenRows(1);
    return;
  }

  const values = sheet.getDataRange().getValues();
  const oldHeaders = values[0].map(function (value) { return String(value).trim(); });
  const hasCurrentSchema = LINKS_HEADERS.every(function (header) {
    return oldHeaders.indexOf(header) >= 0;
  });
  if (hasCurrentSchema) return;

  const oldSchema = [
    "id", "nome", "campanha", "spreadsheetId",
    "aba", "whatsapp", "mensagem", "ativo"
  ];
  const hasOldSchema = oldSchema.every(function (header) {
    return oldHeaders.indexOf(header) >= 0;
  });
  if (!hasOldSchema) {
    throw new Error('A aba "Links" tem colunas inesperadas. Confira o cabeçalho antes de continuar.');
  }

  const col = {};
  oldHeaders.forEach(function (header, index) { col[header] = index; });
  const migrated = values.slice(1).map(function (row) {
    const phone = String(row[col.whatsapp] || "").replace(/\D/g, "");
    const message = String(row[col.mensagem] || "Olá");
    const destination = phone
      ? "https://wa.me/" + phone + "?text=" + encodeURIComponent(message)
      : "";
    return [
      row[col.id], row[col.nome], row[col.campanha], row[col.spreadsheetId],
      row[col.aba], destination, row[col.ativo]
    ];
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, LINKS_HEADERS.length).setValues([LINKS_HEADERS]);
  if (migrated.length) {
    sheet.getRange(2, 1, migrated.length, LINKS_HEADERS.length).setValues(migrated);
  }
  sheet.setFrozenRows(1);
}

function findLink_(linkId) {
  const registry = getRegistry_();
  const sheet = registry.getSheetByName("Links");
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  LINKS_HEADERS.forEach(function (header) {
    if (headers[header] === undefined) throw new Error("Coluna ausente na aba Links: " + header);
  });

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[headers.id] || "").trim() !== linkId || !isActive_(row[headers.ativo])) continue;
    return {
      id: linkId,
      nome: String(row[headers.nome] || ""),
      campanha: String(row[headers.campanha] || ""),
      spreadsheetId: normalizeSpreadsheetId_(row[headers.spreadsheetId]),
      aba: String(row[headers.aba] || "Cliques").trim(),
      destinoUrl: String(row[headers.destinoUrl] || "").trim(),
      source: headers.source === undefined ? "" : String(row[headers.source] || ""),
      medium: headers.medium === undefined ? "" : String(row[headers.medium] || ""),
      content: headers.content === undefined ? "" : String(row[headers.content] || "")
    };
  }
  return null;
}

function appendClick_(config, params) {
  if (!config.spreadsheetId) throw new Error("ID da planilha de registro inválido.");
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  const target = ensureClickSheet_(spreadsheet, config.aba || "Cliques");
  const sheet = target.sheet;
  const headers = target.headers;
  const userAgent = String(params.ua || "");
  const values = {
    data_hora: new Date(),
    link_id: config.id,
    nome_link: safeCell_(config.nome),
    campanha: safeCell_(config.campanha),
    destino_url: safeCell_(config.destinoUrl),
    origem: safeCell_(params.origem || config.source || "Direto"),
    utm_source: safeCell_(params.utm_source || config.source || ""),
    utm_medium: safeCell_(params.utm_medium || config.medium || ""),
    utm_campaign: safeCell_(params.utm_campaign || config.campanha || ""),
    utm_content: safeCell_(params.utm_content || config.content || ""),
    utm_term: safeCell_(params.utm_term || ""),
    referenciador: safeCell_(params.ref || ""),
    navegador: safeCell_(userAgent),
    idioma: safeCell_(params.lang || ""),
    fuso_horario: safeCell_(params.tz || ""),
    offset_fuso_minutos: safeCell_(params.tzoffset || ""),
    visitor_id: safeCell_(params.visitor_id || ""),
    suspeito_bot: isBot_(userAgent, params.bot_hint),
    click_id: safeCell_(params.click_id || "")
  };
  const row = headers.map(function (header) {
    return values[header] === undefined ? "" : values[header];
  });

  if (params.__retry) {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (clickIdExists_(sheet, headers, params.click_id)) return;
      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }
    return;
  }

  sheet.appendRow(row);
}

function ensureClickSheet_(spreadsheet, tabName) {
  let sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) sheet = spreadsheet.insertSheet(tabName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CLICK_HEADERS.length).setValues([CLICK_HEADERS]);
    sheet.setFrozenRows(1);
    return { sheet: sheet, headers: CLICK_HEADERS.slice() };
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (value) { return String(value).trim(); });
  const existing = headerMap_(headers);
  const legacyRequired = CLICK_HEADERS.slice(0, 16);
  legacyRequired.forEach(function (header) {
    if (existing[header] === undefined) {
      throw new Error('A aba "' + tabName + '" tem cabeçalho diferente. Escolha uma aba vazia ou use Cliques.');
    }
  });

  CLICK_HEADERS.forEach(function (header) {
    if (existing[header] === undefined) {
      const nextColumn = headers.length + 1;
      sheet.getRange(1, nextColumn).setValue(header);
      existing[header] = nextColumn - 1;
      headers.push(header);
    }
  });
  return { sheet: sheet, headers: headers };
}

function clickIdExists_(sheet, headers, clickId) {
  const id = String(clickId || "").trim();
  const column = headers.click_id;
  if (!id || column === undefined || sheet.getLastRow() < 2) return false;
  return !!sheet.getRange(2, column + 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(id).matchEntireCell(true).findNext();
}

function installRetryTrigger_() {
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === "retryFailedClicks";
  });
  if (!exists) {
    ScriptApp.newTrigger("retryFailedClicks").timeBased().everyMinutes(15).create();
  }
}

function retryFailedClicks() {
  const registry = getRegistry_();
  const sheet = registry.getSheetByName("Falhas");
  if (!sheet || sheet.getLastRow() < 2) return { success: true, processed: 0 };

  ensureFailureSheet_(registry);
  const headers = headerMap_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const values = sheet.getDataRange().getValues();
  const payloadColumn = headers.payload_json;
  const statusColumn = headers.status;
  const attemptsColumn = headers.tentativas;
  const errorColumn = headers.erro;
  const startedAt = Date.now();
  let processed = 0;
  let attempted = 0;

  for (let i = 1; i < values.length; i++) {
    if (Date.now() - startedAt > 4 * 60 * 1000) break;
    const row = values[i];
    if (String(row[statusColumn] || "") === "resolved") continue;
    const payloadText = String(row[payloadColumn] || "");
    if (!payloadText) continue;

    try {
      const payload = JSON.parse(payloadText);
      const config = payload.config;
      if (!config || !config.spreadsheetId) continue;
      const params = payload.params || {};
      if (!params.click_id) params.click_id = Utilities.getUuid();
      params.__retry = true;
      payload.params = params;
      sheet.getRange(i + 1, payloadColumn + 1).setValue(JSON.stringify(payload));
      appendClick_(config, params);
      sheet.getRange(i + 1, statusColumn + 1).setValue("resolved");
      sheet.getRange(i + 1, attemptsColumn + 1).setValue(Number(row[attemptsColumn] || 0) + 1);
      processed++;
      attempted++;
    } catch (error) {
      sheet.getRange(i + 1, statusColumn + 1).setValue("pending");
      sheet.getRange(i + 1, attemptsColumn + 1).setValue(Number(row[attemptsColumn] || 0) + 1);
      sheet.getRange(i + 1, errorColumn + 1).setValue(error.message || String(error));
      attempted++;
    }
  }

  return { success: true, processed: processed, attempted: attempted };
}

function ensureFailureSheet_(registry) {
  let sheet = registry.getSheetByName("Falhas");
  if (!sheet) sheet = registry.insertSheet("Falhas");
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, FAILURE_HEADERS.length).setValues([FAILURE_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0]
    .map(function (value) { return String(value).trim(); });
  const existing = headerMap_(headers);
  ["data_hora", "link_id", "erro"].forEach(function (header) {
    if (existing[header] === undefined) throw new Error('A aba "Falhas" tem cabeçalho inesperado.');
  });
  FAILURE_HEADERS.forEach(function (header) {
    if (existing[header] === undefined) {
      const nextColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextColumn).setValue(header);
      existing[header] = nextColumn - 1;
    }
  });
  return sheet;
}

function saveFailure_(linkId, error, config, params) {
  try {
    const registry = getRegistry_();
    const sheet = ensureFailureSheet_(registry);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(function (value) { return String(value).trim(); });
    const payload = config ? JSON.stringify({
      config: config,
      params: params || {}
    }) : "";
    const row = {
      data_hora: new Date(),
      link_id: safeCell_(linkId),
      erro: safeCell_(error && error.message ? error.message : error),
      payload_json: payload,
      status: "pending",
      tentativas: 0
    };
    sheet.appendRow(headers.map(function (header) {
      return row[header] === undefined ? "" : row[header];
    }));
  } catch (ignored) {}
}

function getRegistry_() {
  const id = PropertiesService.getScriptProperties().getProperty(REGISTRY_PROPERTY);
  if (!id) throw new Error("Execute setupTracker() primeiro.");
  return SpreadsheetApp.openById(id);
}

function headerMap_(headers) {
  const map = {};
  headers.forEach(function (header, index) {
    const name = String(header || "").trim();
    if (name) map[name] = index;
  });
  return map;
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
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new Error("O destino precisa ser uma URL começando com http:// ou https://.");
  }
  return url;
}

function safeCell_(value) {
  let text = String(value == null ? "" : value).slice(0, 1000);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function isBot_(userAgent, botHint) {
  const ua = String(userAgent || "");
  const hint = String(botHint || "").toLowerCase();
  if (["known-crawler", "http-head", "prefetch", "non-navigation-fetch"].indexOf(hint) >= 0) return true;
  if (/bot|crawler|spider|preview|fetcher|scraper|facebookexternalhit|facebot|facebookbot|meta-externalagent|meta-externalfetcher|meta-webindexer|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|pinterestbot|bingpreview|googlebot|headlesschrome|phantomjs|puppeteer|playwright/i.test(ua)) return true;
  // "WhatsApp" also appears in real in-app browser UAs. Only treat it as a bot
  // when it lacks the normal browser/WebView signatures.
  const hasBrowser = /mozilla|applewebkit|chrome|safari|firefox|edg|opr/i.test(ua);
  return /whatsapp/i.test(ua) && !hasBrowser;
}

function makeResponse_(result, callback) {
  const json = JSON.stringify(result).replace(/</g, "\\u003c");
  if (callback && /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

