import { google, sheets_v4 } from 'googleapis';
import {
  SHEET_TABS,
  LINKS_COLUMNS,
  CLIQUES_COLUMNS,
  RESUMO_COLUMNS,
} from '../utils/sheets-helpers.ts';
import { decryptToken } from '../utils/crypto-helpers.ts';
import { store, LinkRecord, ClickRecord, SyncQueueItem } from './store.ts';

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';

export class GoogleSheetsService {
  private oauth2Client: any = null;
  private currentAccessToken: string | null = null;

  constructor() {
    this.initOAuthClient();
  }

  public getOAuthCredentials() {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    return { clientId, clientSecret, isConfigured: !!(clientId && clientSecret) };
  }

  private initOAuthClient(redirectUriOverride?: string) {
    const { clientId, clientSecret } = this.getOAuthCredentials();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const redirectUri = redirectUriOverride || `${appUrl}/api/auth/google/callback`;

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    return this.oauth2Client;
  }

  public getAuthorizationUrl(redirectUriOverride?: string): string {
    const { clientId, clientSecret } = this.getOAuthCredentials();
    if (!clientId || !clientSecret) {
      throw new Error(
        'Credenciais OAuth não configuradas. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET nas variáveis de ambiente.'
      );
    }

    const client = this.initOAuthClient(redirectUriOverride);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
  }

  public async exchangeCode(
    code: string,
    redirectUriOverride?: string
  ): Promise<{
    email: string;
    name?: string;
    picture?: string;
    tokens: any;
  }> {
    const client = this.initOAuthClient(redirectUriOverride);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Fetch user profile to verify admin email
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userinfo = await oauth2.userinfo.get();
    const email = userinfo.data.email || '';
    const name = userinfo.data.name || '';
    const picture = userinfo.data.picture || '';

    if (!email) {
      throw new Error('Não foi possível obter o e-mail da conta Google autenticada.');
    }

    return { email, name, picture, tokens };
  }

  public setAccessToken(token: string) {
    this.currentAccessToken = token;
    if (this.oauth2Client) {
      this.oauth2Client.setCredentials({ access_token: token });
    }
  }

  public async getAuthenticatedClient() {
    const authSetting = await store.getAuthSetting();

    // 1. If we have an encrypted refresh token in store, decrypt and use it
    if (authSetting?.encryptedRefreshToken) {
      try {
        const refreshToken = decryptToken(authSetting.encryptedRefreshToken, TOKEN_ENCRYPTION_KEY);
        if (refreshToken) {
          this.oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: authSetting.accessToken,
          });
          return this.oauth2Client;
        }
      } catch (err: any) {
        console.warn('[GoogleSheets] Error decrypting stored refresh token:', err.message);
      }
    }

    // 2. If an active session accessToken was synced
    if (authSetting?.accessToken) {
      this.oauth2Client.setCredentials({
        access_token: authSetting.accessToken,
      });
      return this.oauth2Client;
    }

    // 3. In-memory access token fallback
    if (this.currentAccessToken) {
      this.oauth2Client.setCredentials({
        access_token: this.currentAccessToken,
      });
      return this.oauth2Client;
    }

    // No credentials yet
    return null;
  }

  /**
   * Verifies access to the spreadsheet and ensures the required tabs exist:
   * 'Links', 'Cliques', and 'Resumo'.
   * If any tab does not exist, it is created with standard column headers.
   */
  public async ensureSpreadsheetSetup(
    spreadsheetId: string
  ): Promise<{ title: string; sheetsCreated: string[] }> {
    const authClient = await this.getAuthenticatedClient();
    if (!authClient) {
      throw new Error(
        'Google Sheets não conectado. O administrador precisa conectar sua Conta Google primeiro.'
      );
    }

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. Get spreadsheet info to check title and existing sheets
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties(sheetId,title)',
    });

    const title = res.data.properties?.title || 'Planilha Sem Título';
    const existingSheets = res.data.sheets || [];
    const sheetTitles = new Set(existingSheets.map((s) => s.properties?.title).filter(Boolean));

    const requiredTabs = [SHEET_TABS.LINKS, SHEET_TABS.CLIQUES, SHEET_TABS.RESUMO];
    const missingTabs = requiredTabs.filter((tab) => !sheetTitles.has(tab));
    const sheetsCreated: string[] = [];

    // 2. Create missing sheets via batchUpdate
    if (missingTabs.length > 0) {
      const requests = missingTabs.map((tabName) => ({
        addSheet: {
          properties: {
            title: tabName,
          },
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });

      sheetsCreated.push(...missingTabs);
    }

    // 3. Initialize headers for each required tab
    const valueUpdates: Array<{ range: string; values: string[][] }> = [];

    // Links Tab
    valueUpdates.push({
      range: `${SHEET_TABS.LINKS}!A1:L1`,
      values: [[...LINKS_COLUMNS]],
    });

    // Cliques Tab
    valueUpdates.push({
      range: `${SHEET_TABS.CLIQUES}!A1:P1`,
      values: [[...CLIQUES_COLUMNS]],
    });

    // Resumo Tab
    valueUpdates.push({
      range: `${SHEET_TABS.RESUMO}!A1:G1`,
      values: [[...RESUMO_COLUMNS]],
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: valueUpdates,
      },
    });

    return { title, sheetsCreated };
  }

  /**
   * Appends a link row to the 'Links' tab.
   */
  public async appendLinkRow(spreadsheetId: string, link: LinkRecord): Promise<void> {
    const authClient = await this.getAuthenticatedClient();
    if (!authClient) {
      throw new Error('Google Sheets não conectado.');
    }

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const row = [
      link.id,
      link.name,
      link.campaign,
      link.source,
      link.medium,
      link.content,
      link.destinationType === 'whatsapp' ? 'WhatsApp' : 'URL comum',
      link.destinationUrl,
      link.whatsappMessage || '',
      link.shortPath,
      link.createdAt,
      link.status === 'active' ? 'Ativo' : 'Inativo',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_TABS.LINKS}!A:L`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });
  }

  /**
   * Appends a click row to the 'Cliques' tab.
   * IDEMPOTENT: Checks if click.clickId already exists in column B before appending.
   * If already present, skips appending to prevent duplicate rows during retries.
   */
  public async appendClickRow(
    spreadsheetId: string,
    click: ClickRecord
  ): Promise<{ appended: boolean; alreadyExisted: boolean }> {
    const authClient = await this.getAuthenticatedClient();
    if (!authClient) {
      throw new Error('Google Sheets não conectado.');
    }

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. Idempotency Check: Verify if clickId already exists in column B
    try {
      const existingIdsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_TABS.CLIQUES}!B2:B`,
      });
      const rows = existingIdsRes.data.values || [];
      const idExists = rows.some((r) => r[0] === click.clickId);
      if (idExists) {
        console.log(`[GoogleSheets] Idempotency: click ${click.clickId} already registered in sheet. Skipping append.`);
        return { appended: false, alreadyExisted: true };
      }
    } catch (checkErr: any) {
      // If the sheet tab does not exist yet, initialize it
      if (
        checkErr.message?.includes('Unable to parse range') ||
        checkErr.message?.includes('not found') ||
        checkErr.code === 400
      ) {
        await this.ensureSpreadsheetSetup(spreadsheetId);
      } else {

        console.warn('[GoogleSheets] Non-fatal idempotency check notice, proceeding to append:', checkErr.message);
      }
    }

    const row = [
      click.timestamp,
      click.clickId,
      click.linkId,
      click.linkName,
      click.campaign,
      click.source,
      click.medium,
      click.content,
      click.referer || 'Direto / Desconhecido',
      click.browser || 'Desconhecido',
      click.os || 'Desconhecido',
      click.deviceType || 'Desktop',
      click.userAgent || '',
      click.visitorId,
      click.isSuspectBot ? 'SIM' : 'NÃO',
      click.isDuplicate ? 'SIM' : 'NÃO',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_TABS.CLIQUES}!A:P`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [row],
      },
    });

    return { appended: true, alreadyExisted: false };
  }


  /**
   * Updates the 'Resumo' tab with real-time aggregate statistics for this sheet.
   * Calculates:
   * - Nome do link
   * - Origem
   * - Campanha
   * - Cliques totais
   * - Cliques reais (ignoring suspect bots)
   * - Navegadores únicos estimados
   * - Bots suspeitos
   */
  public async updateResumoTab(spreadsheetId: string): Promise<void> {
    const authClient = await this.getAuthenticatedClient();
    if (!authClient) return;

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    try {
      // Read all click rows
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_TABS.CLIQUES}!A2:P`,
      });

      const rows = res.data.values || [];
      const linkMap = new Map<
        string,
        {
          name: string;
          source: string;
          campaign: string;
          totalClicks: number;
          realClicks: number;
          bots: number;
          visitors: Set<string>;
        }
      >();

      for (const row of rows) {
        const linkId = row[2] || '';
        const linkName = row[3] || 'Desconhecido';
        const campaign = row[4] || '';
        const source = row[5] || '';
        const visitorId = row[13] || '';
        const isBot = (row[14] || '').toUpperCase() === 'SIM';

        if (!linkMap.has(linkId)) {
          linkMap.set(linkId, {
            name: linkName,
            source,
            campaign,
            totalClicks: 0,
            realClicks: 0,
            bots: 0,
            visitors: new Set(),
          });
        }

        const stats = linkMap.get(linkId)!;
        stats.totalClicks += 1;
        if (isBot) {
          stats.bots += 1;
        } else {
          stats.realClicks += 1;
          if (visitorId) {
            stats.visitors.add(visitorId);
          }
        }
      }

      // Format summary rows
      const summaryRows = Array.from(linkMap.values()).map((s) => [
        s.name,
        s.source,
        s.campaign,
        s.totalClicks,
        s.realClicks,
        s.visitors.size,
        s.bots,
      ]);

      // Clear previous summary data below header (row 2 to row 1000)
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${SHEET_TABS.RESUMO}!A2:G1000`,
      });

      if (summaryRows.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${SHEET_TABS.RESUMO}!A2:G${summaryRows.length + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: summaryRows,
          },
        });
      }
    } catch (err: any) {
      console.warn('[GoogleSheets] updateResumoTab non-fatal error:', err.message);
    }
  }

  /**
   * Retries writing queued click items that previously encountered an error.
   */
  public async retrySyncQueue(filter: 'pending' | 'all' = 'pending'): Promise<{ resolved: number; failed: number }> {
    const items = await store.getSyncQueue(filter === 'all' ? 'unresolved' : 'pending');
    let resolved = 0;
    let failed = 0;
    const affectedSheets = new Set<string>();

    for (const item of items) {
      try {
        await this.appendClickRow(item.spreadsheetId, item.clickRecord);
        await store.markSyncQueueResolved(item.queueId);
        affectedSheets.add(item.spreadsheetId);
        resolved++;
      } catch (err: any) {
        await store.updateSyncQueueAttempts(item.queueId, err.message || 'Falha ao sincronizar com Google Sheets');
        failed++;
      }
    }

    // Update summary tab for each affected sheet
    for (const sheetId of affectedSheets) {
      this.updateResumoTab(sheetId).catch((err) =>
        console.warn(`[GoogleSheets] updateResumoTab notice for ${sheetId}:`, err.message)
      );
    }

    return { resolved, failed };
  }
}

export const googleSheetsService = new GoogleSheetsService();
