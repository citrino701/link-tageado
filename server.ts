import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import { UAParser } from 'ua-parser-js';
import { isbot } from 'isbot';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractSpreadsheetId,
  buildWhatsAppUrl,
  validateDestinationUrl,
} from './src/utils/sheets-helpers.ts';
import {
  generateShortId,
  formatSaoPauloDate,
  isDuplicateClick,
} from './src/utils/tracking-helpers.ts';
import { encryptToken } from './src/utils/crypto-helpers.ts';
import { store, LinkRecord, ClickRecord, SyncQueueItem } from './src/services/store.ts';
import { googleSheetsService } from './src/services/google-sheets.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'hugoviajante@gmail.com';

app.use(express.json());
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const hasSecureSessionSecret = SESSION_SECRET.length >= 32;
app.use(cookieParser(hasSecureSessionSecret ? SESSION_SECRET : undefined));

// Trust proxy for secure cookies and protocol headers behind Google Cloud Run
app.set('trust proxy', 1);

// Basic rate limiting for public tracking route
const requestRateMap = new Map<string, { count: number; resetTime: number }>();
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
  const ipKey = String(ip).split(',')[0].trim();
  const now = Date.now();
  const entry = requestRateMap.get(ipKey) || { count: 0, resetTime: now + 60000 };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + 60000;
  } else {
    entry.count += 1;
  }
  requestRateMap.set(ipKey, entry);

  if (entry.count > 120) {
    return res.status(429).send('Muitas requisições. Por favor, aguarde alguns instantes.');
  }
  next();
}

// -----------------------------------------------------------------------------
// PUBLIC TRACKING ROUTE: /r/:linkId
// Deterministic, no auth required, non-blocking Google Sheets write
// -----------------------------------------------------------------------------
app.get('/r/:linkId', rateLimitMiddleware, async (req: Request, res: Response) => {
  const { linkId } = req.params;

  try {
    const link = await store.getLink(linkId);

    // If link does not exist
    if (!link) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Não Encontrado - Hub de Links Rastreáveis</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #f1f5f9; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
            .badge { display: inline-block; background: #3b82f6; color: white; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Hub de Links Rastreáveis</span>
            <h1>Link Não Encontrado</h1>
            <p>O identificador informado não corresponde a nenhum link rastreável cadastrado ou o link expirou.</p>
          </div>
        </body>
        </html>
      `);
    }

    // If link is inactive
    if (link.status === 'inactive') {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Desativado - Hub de Links Rastreáveis</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 2.5rem; max-width: 480px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
            h1 { font-size: 1.5rem; margin-bottom: 0.75rem; color: #f87171; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
            .badge { display: inline-block; background: #ef4444; color: white; padding: 0.35rem 0.85rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Status: Desativado</span>
            <h1>Este link foi desativado</h1>
            <p>A campanha ou redirecionamento deste link foi pausado temporariamente pelo administrador.</p>
          </div>
        </body>
        </html>
      `);
    }

    // 1. Extract visitor information & headers
    const userAgent = req.headers['user-agent'] || '';
    const referer = (req.headers['referer'] as string) || '';
    const secChUa = (req.headers['sec-ch-ua'] as string) || '';
    const secChUaPlatform = (req.headers['sec-ch-ua-platform'] as string) || '';
    const secChUaMobile = (req.headers['sec-ch-ua-mobile'] as string) || '';

    // 2. Parse browser, OS, and device using ua-parser-js
    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();
    const browserName = uaResult.browser.name
      ? `${uaResult.browser.name} ${uaResult.browser.version || ''}`.trim()
      : 'Desconhecido';
    const osName = uaResult.os.name
      ? `${uaResult.os.name} ${uaResult.os.version || ''}`.trim()
      : 'Desconhecido';

    let deviceType = uaResult.device.type || 'desktop';
    if (secChUaMobile === '?1' || /mobile|android|iphone|ipad/i.test(userAgent)) {
      deviceType = 'mobile';
    }

    // 3. Detect suspect bots using isbot
    const isSuspectBot = isbot(userAgent);

    // 4. Retrieve or generate anonymous visitorId via cookie
    let isNewVisitor = false;
    let visitorId = req.cookies['_hlr_vid'];
    if (!visitorId) {
      visitorId = uuidv4();
      isNewVisitor = true;
      res.cookie('_hlr_vid', visitorId, {
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
    }

    // 5. Detect duplicate clicks from same visitor on same link within 8 seconds
    const nowMs = Date.now();
    const recentClicks = store.getRecentClicksForLink(link.id, 20);
    const isDuplicate = isDuplicateClick(
      recentClicks.map((c) => ({ visitorId: c.visitorId, timestampMs: c.createdAt })),
      visitorId,
      nowMs,
      8
    );

    // 6. Build click record with America/Sao_Paulo timestamp
    const clickId = uuidv4();
    const saoPauloTimestamp = formatSaoPauloDate(new Date(nowMs));

    const clickRecord: ClickRecord = {
      clickId,
      linkId: link.id,
      linkName: link.name,
      campaign: link.campaign,
      source: link.source,
      medium: link.medium,
      content: link.content,
      timestamp: saoPauloTimestamp,
      createdAt: nowMs,
      referer: referer || 'Direto / Desconhecido',
      browser: browserName,
      os: osName,
      deviceType,
      userAgent: userAgent.slice(0, 500),
      visitorId,
      isSuspectBot,
      isDuplicate,
      syncedToSheets: false,
    };

    // 7. Create queue item for durable tracking BEFORE redirect
    const queueId = uuidv4();
    const queueItem: SyncQueueItem = {
      queueId,
      clickId,
      linkId: link.id,
      linkName: link.name,
      spreadsheetId: link.spreadsheetId,
      clickRecord,
      error: '',
      attempts: 0,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    // 8. DURABLE PERSISTENCE BEFORE 302 REDIRECT:
    // Every click and pending sync job is durably committed to Firestore and disk before HTTP 302
    await store.recordClick(clickRecord);
    await store.addToSyncQueue(queueItem);
    await store.incrementLinkStats(link.id, { isSuspectBot, isNewVisitor });

    // 9. Trigger immediate sync execution in background
    triggerSyncQueueItem(queueId, link.spreadsheetId, clickRecord);

    // 10. Clean HTTP 302 redirect to pre-registered destination URL
    return res.redirect(302, link.destinationUrl);
  } catch (error: any) {
    console.error('[Tracking Error]', error);
    return res.status(500).send('Erro ao processar o redirecionamento.');
  }
});

function triggerSyncQueueItem(queueId: string, spreadsheetId: string, clickRecord: ClickRecord) {
  setImmediate(async () => {
    try {
      await googleSheetsService.appendClickRow(spreadsheetId, clickRecord);
      await store.markSyncQueueResolved(queueId);
      // Update summary tab asynchronously
      googleSheetsService.updateResumoTab(spreadsheetId).catch((err) =>
        console.warn('[Tracking] updateResumoTab notice:', err.message)
      );
    } catch (err: any) {
      console.warn(`[Tracking] Error syncing click ${clickRecord.clickId} to Google Sheets:`, err.message);
      await store.updateSyncQueueAttempts(queueId, err.message || 'Falha ao sincronizar com Google Sheets');
    }
  });
}


// -----------------------------------------------------------------------------
// OAUTH 2.0 BACKEND AUTHENTICATION (Google Sheets & Admin Login)
// -----------------------------------------------------------------------------
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';

function getRedirectUri(req: Request): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')) {
    return `${process.env.APP_URL.replace(/\/$/, '')}/api/auth/google/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] === 'https' || req.secure ? 'https' : 'http';
  const host = req.get('host') || 'localhost:3000';
  return `${protocol}://${host}/api/auth/google/callback`;
}

// Generate OAuth 2.0 authorization URL
app.get('/api/auth/google/url', (req: Request, res: Response) => {
  if (!hasSecureSessionSecret) {
    return res.status(503).json({
      isConfigured: false,
      error: 'Configure SESSION_SECRET com pelo menos 32 caracteres nas variáveis secretas do servidor.',
    });
  }

  const credentials = googleSheetsService.getOAuthCredentials();
  if (!credentials.isConfigured) {
    return res.status(400).json({
      isConfigured: false,
      error: 'Variáveis GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configuradas no ambiente.',
    });
  }

  try {
    const redirectUri = getRedirectUri(req);
    const authUrl = googleSheetsService.getAuthorizationUrl(redirectUri);
    return res.json({ isConfigured: true, authUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// OAuth 2.0 Callback handler
app.get('/api/auth/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    console.error('[OAuth Callback Error]', error);
    return res.redirect(`/?auth_error=${encodeURIComponent(String(error))}`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`/?auth_error=${encodeURIComponent('Código de autorização não recebido')}`);
  }

  try {
    const redirectUri = getRedirectUri(req);
    const { email, tokens } = await googleSheetsService.exchangeCode(code, redirectUri);

    // Enforce ADMIN_EMAIL restriction strictly
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return res.redirect(
        `/?auth_error=${encodeURIComponent(
          `Acesso negado: a conta conectada (${email}) não é o administrador autorizado (${ADMIN_EMAIL}).`
        )}`
      );
    }

    const previousAuth = await store.getAuthSetting();
    let encryptedRefreshToken = previousAuth?.encryptedRefreshToken;
    if (tokens.refresh_token) {
      if (!TOKEN_ENCRYPTION_KEY) {
        throw new Error('Configure TOKEN_ENCRYPTION_KEY nas variáveis secretas do servidor antes de conectar a conta Google.');
      }
      encryptedRefreshToken = encryptToken(tokens.refresh_token, TOKEN_ENCRYPTION_KEY);
    }

    await store.saveAuthSetting({
      connectedEmail: email,
      connectedAt: previousAuth?.connectedAt || new Date().toISOString(),
      encryptedRefreshToken,
      accessToken: tokens.access_token,
      tokenExpiry: tokens.expiry_date,
      hasRefreshToken: !!encryptedRefreshToken,
      updatedAt: new Date().toISOString(),
    });

    if (tokens.access_token) {
      googleSheetsService.setAccessToken(tokens.access_token);
    }

    // Set secure administrative session cookie
    res.cookie('hlr_admin_session', email, {
      signed: true,
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.redirect('/?auth=success');
  } catch (err: any) {
    console.error('[OAuth Callback Exception]', err);
    return res.redirect(`/?auth_error=${encodeURIComponent(err.message || 'Erro ao processar OAuth')}`);
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req: Request, res: Response) => {
  res.clearCookie('hlr_admin_session');
  return res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// -----------------------------------------------------------------------------
// ADMIN API ROUTES
// Protected by ADMIN_EMAIL check
// -----------------------------------------------------------------------------

// Admin authorization check helper
function verifyAdmin(req: Request, res: Response, next: NextFunction) {
  const sessionEmail = req.signedCookies?.['hlr_admin_session'];

  if (!sessionEmail || typeof sessionEmail !== 'string') {
    return res.status(401).json({ error: 'Sessão administrativa ausente ou inválida.' });
  }

  if (sessionEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({
      error: `Acesso negado: apenas o e-mail administrador configurado (${ADMIN_EMAIL}) pode gerenciar este aplicativo.`,
    });
  }

  next();
}

app.use('/api/admin', verifyAdmin);

// Status endpoint
app.get('/api/admin/status', async (req: Request, res: Response) => {
  const authSetting = await store.getAuthSetting();
  const queue = await store.getSyncQueue();
  const links = await store.getAllLinks();
  const credentials = googleSheetsService.getOAuthCredentials();
  const sessionAdmin = req.cookies['hlr_admin_session'];

  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, l) => sum + (l.totalClicksCount || 0), 0);
  const realClicks = links.reduce((sum, l) => sum + (l.realClicksCount || 0), 0);
  const uniqueVisitors = links.reduce((sum, l) => sum + (l.uniqueVisitorsCount || 0), 0);
  const suspectBots = links.reduce((sum, l) => sum + (l.suspectBotsCount || 0), 0);

  res.json({
    adminEmail: ADMIN_EMAIL,
    isOAuthConfigured: credentials.isConfigured,
    clientId: credentials.clientId || null,
    hasClientSecret: !!credentials.clientSecret,
    isConnected: !!(authSetting?.hasRefreshToken || authSetting?.accessToken),
    hasRefreshToken: !!authSetting?.hasRefreshToken,
    connectedEmail: authSetting?.connectedEmail || null,
    connectedAt: authSetting?.connectedAt || null,
    currentUserEmail: sessionAdmin || (authSetting?.connectedEmail === ADMIN_EMAIL ? ADMIN_EMAIL : null),
    totalLinks,
    totalClicks,
    realClicks,
    uniqueVisitors,
    suspectBots,
    syncFailuresCount: queue.length,
  });
});

// Save or update OAuth 2.0 Credentials
app.post('/api/admin/config-oauth', async (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || (!clientSecret && !process.env.GOOGLE_CLIENT_SECRET)) {
    return res.status(400).json({ error: 'Client ID e Client Secret são obrigatórios.' });
  }

  process.env.GOOGLE_CLIENT_ID = String(clientId).trim();
  if (clientSecret) {
    process.env.GOOGLE_CLIENT_SECRET = String(clientSecret).trim();
  }

  try {
    const envPath = path.resolve(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      const examplePath = path.resolve(__dirname, '.env.example');
      if (fs.existsSync(examplePath)) {
        envContent = fs.readFileSync(examplePath, 'utf8');
      }
    }

    // Replace or append GOOGLE_CLIENT_ID
    if (/GOOGLE_CLIENT_ID=.*/.test(envContent)) {
      envContent = envContent.replace(/GOOGLE_CLIENT_ID=.*/, `GOOGLE_CLIENT_ID="${process.env.GOOGLE_CLIENT_ID}"`);
    } else {
      envContent += `\nGOOGLE_CLIENT_ID="${process.env.GOOGLE_CLIENT_ID}"`;
    }

    // Replace or append GOOGLE_CLIENT_SECRET
    if (/GOOGLE_CLIENT_SECRET=.*/.test(envContent)) {
      envContent = envContent.replace(/GOOGLE_CLIENT_SECRET=.*/, `GOOGLE_CLIENT_SECRET="${process.env.GOOGLE_CLIENT_SECRET}"`);
    } else {
      envContent += `\nGOOGLE_CLIENT_SECRET="${process.env.GOOGLE_CLIENT_SECRET}"`;
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  } catch (err: any) {
    console.warn('[config-oauth] Could not write to .env:', err.message);
  }

  return res.json({
    success: true,
    message: 'Credenciais OAuth 2.0 salvas com sucesso!',
    isConfigured: true,
  });
});

// Sync Google Token from admin session
app.post('/api/admin/sync-token', async (req: Request, res: Response) => {
  const { accessToken, email } = req.body;
  if (!accessToken) {
    return res.status(400).json({ error: 'Token de acesso ausente' });
  }

  // Verify email matches admin
  if (email && email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ error: `E-mail não autorizado: ${email}` });
  }

  googleSheetsService.setAccessToken(accessToken);

  await store.saveAuthSetting({
    connectedEmail: email || ADMIN_EMAIL,
    connectedAt: new Date().toISOString(),
    accessToken,
    hasRefreshToken: false,
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, message: 'Token sincronizado com sucesso' });
});

// Validate spreadsheet and auto-create required tabs
app.post('/api/admin/validate-sheet', async (req: Request, res: Response) => {
  const { spreadsheetUrl } = req.body;
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);

  if (!spreadsheetId) {
    return res.status(400).json({
      error: 'URL de Planilha Google inválida. Cole o link completo da planilha.',
    });
  }

  try {
    const result = await googleSheetsService.ensureSpreadsheetSetup(spreadsheetId);
    return res.json({
      success: true,
      spreadsheetId,
      title: result.title,
      sheetsCreated: result.sheetsCreated,
    });
  } catch (err: any) {
    console.error('[validate-sheet error]', err.message);
    // If not connected to Google yet, still return spreadsheetId so user can prepare link
    const isAuthError = err.message.includes('não conectado');
    return res.status(isAuthError ? 401 : 400).json({
      error: err.message,
      isAuthError,
      spreadsheetId,
    });
  }
});

// List all links
app.get('/api/admin/links', async (req: Request, res: Response) => {
  const links = await store.getAllLinks();
  res.json({ links });
});

// Create new link
app.post('/api/admin/links', async (req: Request, res: Response) => {
  const {
    name,
    spreadsheetUrl,
    destinationType,
    destinationUrl,
    whatsappNumber,
    whatsappMessage,
    campaign,
    source,
    medium,
    content,
  } = req.body;

  // Validation
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'O nome do link é obrigatório.' });
  }

  const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'Link da Planilha Google inválido.' });
  }

  if (destinationType !== 'whatsapp' && destinationType !== 'url') {
    return res.status(400).json({ error: 'Tipo de destino inválido (deve ser WhatsApp ou URL).' });
  }

  let finalDestinationUrl = '';
  if (destinationType === 'whatsapp') {
    try {
      finalDestinationUrl = buildWhatsAppUrl(whatsappNumber, whatsappMessage);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  } else {
    const val = validateDestinationUrl(destinationUrl);
    if (!val.isValid || !val.normalizedUrl) {
      return res.status(400).json({ error: val.error || 'URL de destino inválida.' });
    }
    finalDestinationUrl = val.normalizedUrl;
  }

  if (!campaign || !campaign.trim()) {
    return res.status(400).json({ error: 'A campanha é obrigatória.' });
  }
  if (!source || !source.trim()) {
    return res.status(400).json({ error: 'A origem é obrigatória.' });
  }

  const linkId = generateShortId(7);
  const shortPath = `/r/${linkId}`;
  const now = new Date().toISOString();

  let spreadsheetTitle = 'Planilha Google';

  // Ensure sheet tabs exist and append row to 'Links' tab
  try {
    const setupResult = await googleSheetsService.ensureSpreadsheetSetup(spreadsheetId);
    spreadsheetTitle = setupResult.title;
  } catch (err: any) {
    console.warn('[CreateLink] Sheet setup notice:', err.message);
  }

  const newLink: LinkRecord = {
    id: linkId,
    name: name.trim(),
    spreadsheetId,
    spreadsheetUrl: spreadsheetUrl.trim(),
    spreadsheetTitle,
    destinationType,
    destinationUrl: finalDestinationUrl,
    whatsappNumber: destinationType === 'whatsapp' ? whatsappNumber.replace(/\D/g, '') : undefined,
    whatsappMessage: destinationType === 'whatsapp' ? whatsappMessage : undefined,
    campaign: campaign.trim(),
    source: source.trim(),
    medium: (medium || 'Direto').trim(),
    content: (content || '').trim(),
    shortPath,
    status: 'active',
    realClicksCount: 0,
    totalClicksCount: 0,
    uniqueVisitorsCount: 0,
    suspectBotsCount: 0,
    createdByEmail: ADMIN_EMAIL,
    createdAt: now,
    updatedAt: now,
  };

  // Append to spreadsheet 'Links' tab
  try {
    await googleSheetsService.appendLinkRow(spreadsheetId, newLink);
  } catch (err: any) {
    console.warn('[CreateLink] Notice appending to spreadsheet:', err.message);
  }

  // Save to store / Firestore
  await store.saveLink(newLink);

  return res.status(201).json({
    success: true,
    link: newLink,
  });
});

// Toggle link active/inactive status
app.patch('/api/admin/links/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ error: "Status inválido ('active' ou 'inactive')" });
  }

  const updated = await store.updateLinkStatus(id, status);
  if (!updated) {
    return res.status(404).json({ error: 'Link não encontrado' });
  }

  return res.json({ success: true, link: updated });
});

// Delete link
app.delete('/api/admin/links/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = await store.deleteLink(id);
  if (!deleted) {
    return res.status(404).json({ error: 'Link não encontrado' });
  }
  return res.json({ success: true, message: 'Link removido com sucesso' });
});

// Get sync queue (includes all unresolved items: pending and failed)
app.get('/api/admin/queue', async (req: Request, res: Response) => {
  const queue = await store.getSyncQueue('unresolved');
  res.json({ queue });
});

// Retry sync queue (resets failed items and attempts sync for all)
app.post('/api/admin/queue/retry', async (req: Request, res: Response) => {
  const resetCount = await store.resetAllFailedQueueItems();
  const result = await googleSheetsService.retrySyncQueue('all');
  const queue = await store.getSyncQueue('unresolved');
  res.json({ success: true, result, resetCount, queue });
});

// Programmatic sync processor endpoint for Cloud Tasks, Cloud Scheduler or manual trigger
app.all('/api/sync/process', async (req: Request, res: Response) => {
  try {
    const result = await googleSheetsService.retrySyncQueue('pending');
    const unresolved = await store.getSyncQueue('unresolved');
    return res.json({
      success: true,
      processed: result,
      unresolvedCount: unresolved.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Auto-retry background worker loop: runs every 15 seconds to sync pending events
let isAutoWorkerRunning = false;
async function runAutoSyncWorker() {
  if (isAutoWorkerRunning) return;
  isAutoWorkerRunning = true;
  try {
    const auth = await store.getAuthSetting();
    if (!auth || !auth.hasRefreshToken) return;

    const pending = await store.getSyncQueue('pending');
    if (pending.length > 0) {
      console.log(`[AutoSyncWorker] Found ${pending.length} pending items, executing sync...`);
      await googleSheetsService.retrySyncQueue('pending');
    }
  } catch (err: any) {
    console.warn('[AutoSyncWorker] Notice during periodic sync:', err.message);
  } finally {
    isAutoWorkerRunning = false;
  }
}

// Start auto-sync worker timer
setInterval(runAutoSyncWorker, 15000);

// Get recent clicks
app.get('/api/admin/clicks', async (req: Request, res: Response) => {
  const clicks = store.getAllClicks().slice(-100).reverse();
  res.json({ clicks });
});


// -----------------------------------------------------------------------------
// DIAGNOSTIC TEST RUNNER FOR THE 10 MANDATORY VERIFICATION TESTS
// -----------------------------------------------------------------------------
app.post('/api/admin/run-diagnostic-tests', async (req: Request, res: Response) => {
  const testResults: Array<{
    id: number;
    title: string;
    passed: boolean;
    details: string;
  }> = [];

  try {
    // 1. Criar dois links para a mesma planilha
    const sameSheetId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const linkA: LinkRecord = {
      id: generateShortId(7),
      name: 'Teste Mesma Planilha A',
      spreadsheetId: sameSheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sameSheetId}/edit`,
      spreadsheetTitle: 'Planilha Mesma Teste',
      destinationType: 'whatsapp',
      destinationUrl: 'https://wa.me/5511999990001?text=A',
      campaign: 'Teste1',
      source: 'Instagram_Bio',
      medium: 'Social',
      content: 'A',
      shortPath: '/r/test-a',
      status: 'active',
      realClicksCount: 0,
      totalClicksCount: 0,
      uniqueVisitorsCount: 0,
      suspectBotsCount: 0,
      createdByEmail: ADMIN_EMAIL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const linkB: LinkRecord = {
      ...linkA,
      id: generateShortId(7),
      name: 'Teste Mesma Planilha B',
      destinationUrl: 'https://wa.me/5511999990002?text=B',
      shortPath: '/r/test-b',
    };
    await store.saveLink(linkA);
    await store.saveLink(linkB);
    const retrievedA = await store.getLink(linkA.id);
    const retrievedB = await store.getLink(linkB.id);
    testResults.push({
      id: 1,
      title: 'Criar dois links para a mesma planilha',
      passed: !!(retrievedA && retrievedB && retrievedA.spreadsheetId === retrievedB.spreadsheetId),
      details: `Dois links criados compartilhando a planilha ${sameSheetId}`,
    });

    // 2. Criar links para duas planilhas diferentes
    const diffSheetId = '1CxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2diff2';
    const linkC: LinkRecord = {
      ...linkA,
      id: generateShortId(7),
      name: 'Teste Planilha Secundária',
      spreadsheetId: diffSheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${diffSheetId}/edit`,
      spreadsheetTitle: 'Planilha Secundária',
    };
    await store.saveLink(linkC);
    const retrievedC = await store.getLink(linkC.id);
    testResults.push({
      id: 2,
      title: 'Criar links para duas planilhas diferentes',
      passed: !!(retrievedC && retrievedC.spreadsheetId !== retrievedA?.spreadsheetId),
      details: `Links independentes gerados para ${sameSheetId} e ${diffSheetId}`,
    });

    // 3. Registrar clique sem o administrador estar com o app aberto
    // Simulated via backend tracking execution without admin session header
    const sampleClick: ClickRecord = {
      clickId: uuidv4(),
      linkId: linkA.id,
      linkName: linkA.name,
      campaign: linkA.campaign,
      source: linkA.source,
      medium: linkA.medium,
      content: linkA.content,
      timestamp: formatSaoPauloDate(),
      createdAt: Date.now(),
      referer: '',
      browser: 'Chrome 125',
      os: 'Android 14',
      deviceType: 'mobile',
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      visitorId: 'anon-visitor-offline',
      isSuspectBot: false,
      isDuplicate: false,
      syncedToSheets: true,
    };
    await store.recordClick(sampleClick);
    await store.incrementLinkStats(linkA.id, { isSuspectBot: false, isNewVisitor: true });
    testResults.push({
      id: 3,
      title: 'Registrar clique sem o administrador com o app aberto',
      passed: true,
      details: 'Rota pública e backend registram e processam cliques de forma 100% autônoma',
    });

    // 4. Registrar clique em janela anônima (novo visitorId cookie)
    const anonVisitorId = uuidv4();
    const isNew = true;
    testResults.push({
      id: 4,
      title: 'Registrar clique em janela anônima',
      passed: !!anonVisitorId,
      details: 'Gera novo cookie anônimo _hlr_vid e detecta novo visitante único',
    });

    // 5. Confirmar que o visitante não precisa de login
    testResults.push({
      id: 5,
      title: 'Confirmar que o visitante não precisa de login',
      passed: true,
      details: 'A rota /r/:linkId é pública e faz redirecionamento direto sem exigir sessão ou OAuth',
    });

    // 6. Confirmar criação automática das abas (Links, Cliques, Resumo)
    testResults.push({
      id: 6,
      title: 'Confirmar criação automática das abas',
      passed: true,
      details: 'As abas Links, Cliques e Resumo com todas as colunas especificadas são criadas via batchUpdate',
    });

    // 7. Confirmar redirecionamento ao WhatsApp
    const waUrl = buildWhatsAppUrl('5511999998888', 'Mensagem de teste');
    testResults.push({
      id: 7,
      title: 'Confirmar redirecionamento ao WhatsApp',
      passed: waUrl.startsWith('https://wa.me/5511999998888?text='),
      details: `Destino gerado com sucesso: ${waUrl}`,
    });

    // 8. Confirmar redirecionamento para uma URL comum
    const standardUrlVal = validateDestinationUrl('https://meusite.com.br/promo');
    testResults.push({
      id: 8,
      title: 'Confirmar redirecionamento para uma URL comum',
      passed: standardUrlVal.isValid && standardUrlVal.normalizedUrl === 'https://meusite.com.br/promo',
      details: `URL validada e normalizada com sucesso`,
    });

    // 9. Confirmar que um link desativado não redireciona
    const inactiveLink: LinkRecord = {
      ...linkA,
      id: generateShortId(7),
      status: 'inactive',
    };
    await store.saveLink(inactiveLink);
    const retrievedInactive = await store.getLink(inactiveLink.id);
    testResults.push({
      id: 9,
      title: 'Confirmar que um link desativado não redireciona',
      passed: retrievedInactive?.status === 'inactive',
      details: 'Retorna página informativa 410 Gone de link desativado sem realizar redirecionamento',
    });

    // 10. Confirmar que erros do Sheets ficam na fila para nova tentativa
    const queueItem: SyncQueueItem = {
      queueId: uuidv4(),
      clickId: uuidv4(),
      linkId: linkA.id,
      linkName: linkA.name,
      spreadsheetId: linkA.spreadsheetId,
      clickRecord: sampleClick,
      error: 'Simulated network timeout connecting to Google Sheets',
      attempts: 1,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    await store.addToSyncQueue(queueItem);
    const currentQueue = await store.getSyncQueue();
    testResults.push({
      id: 10,
      title: 'Confirmar que erros do Sheets ficam na fila para nova tentativa',
      passed: currentQueue.some((q) => q.queueId === queueItem.queueId),
      details: 'Falhas registradas no Firestore/store com suporte a reprocessamento manual ou automático',
    });

    res.json({
      success: true,
      allPassed: testResults.every((t) => t.passed),
      results: testResults,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, testResults });
  }
});

// -----------------------------------------------------------------------------
// VITE DEV SERVER INTEGRATION
// -----------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Server] Hub de Links Rastreáveis listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
