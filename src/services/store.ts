import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';

type FirestoreDocReference = {
  db: FirestoreRestClient;
  collectionName: string;
  id: string;
};

type FirestoreCollectionReference = {
  db: FirestoreRestClient;
  collectionName: string;
};

function encodeFirestoreValue(value: any): any {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeFirestoreValue) } };
  }
  if (typeof value === 'object' && value) {
    return { mapValue: { fields: encodeFirestoreFields(value) } };
  }
  return { nullValue: null };
}

function encodeFirestoreFields(value: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, fieldValue]) => fieldValue !== undefined)
      .map(([key, fieldValue]) => [key, encodeFirestoreValue(fieldValue)])
  );
}

function decodeFirestoreValue(value: any): any {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue.fields || {});
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  return null;
}

function decodeFirestoreFields(fields: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

class FirestoreRestClient {
  private readonly basePath: string;
  private readonly authClient: Promise<any>;

  constructor(projectId: string, databaseId: string) {
    this.basePath =
      `projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;
    this.authClient = google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/datastore'],
    });
  }

  private async request(method: string, path: string, data?: any, params?: Record<string, any>) {
    const auth = await this.authClient;
    return auth.request({
      url: `https://firestore.googleapis.com/v1/${path}`,
      method,
      data,
      params,
    });
  }

  async get(collectionName: string, id: string) {
    const path = `${this.basePath}/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;
    const response = await this.request('GET', path);
    return response.data;
  }

  async list(collectionName: string) {
    const documents: any[] = [];
    let pageToken: string | undefined;
    do {
      const response = await this.request(
        'GET',
        `${this.basePath}/${encodeURIComponent(collectionName)}`,
        undefined,
        {
        pageSize: 1000,
        ...(pageToken ? { pageToken } : {}),
        }
      );
      documents.push(...(response.data.documents || []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);
    return documents;
  }

  async set(collectionName: string, id: string, value: Record<string, any>) {
    const path = `${this.basePath}/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;
    const response = await this.request('PATCH', path, { fields: encodeFirestoreFields(value) });
    return response.data;
  }

  async update(collectionName: string, id: string, value: Record<string, any>) {
    const path = `${this.basePath}/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;
    const params = new URLSearchParams();
    Object.keys(value).forEach((fieldPath) => params.append('updateMask.fieldPaths', fieldPath));
    const response = await this.request(
      'PATCH',
      `${path}?${params.toString()}`,
      { fields: encodeFirestoreFields(value) }
    );
    return response.data;
  }

  async delete(collectionName: string, id: string) {
    const path = `${this.basePath}/${encodeURIComponent(collectionName)}/${encodeURIComponent(id)}`;
    return this.request('DELETE', path);
  }
}

function doc(db: FirestoreRestClient, collectionName: string, id: string): FirestoreDocReference {
  return { db, collectionName, id };
}

function collection(db: FirestoreRestClient, collectionName: string): FirestoreCollectionReference {
  return { db, collectionName };
}

async function getDoc(reference: FirestoreDocReference) {
  try {
    const data = await reference.db.get(reference.collectionName, reference.id);
    return {
      exists: () => Boolean(data?.name),
      data: () => decodeFirestoreFields(data?.fields || {}),
    };
  } catch (error: any) {
    if (error?.response?.status === 404 || error?.code === 404) {
      return { exists: () => false, data: () => undefined };
    }
    throw error;
  }
}

async function setDoc(reference: FirestoreDocReference, value: Record<string, any>) {
  return reference.db.set(reference.collectionName, reference.id, value);
}

async function updateDoc(reference: FirestoreDocReference, value: Record<string, any>) {
  return reference.db.update(reference.collectionName, reference.id, value);
}

async function deleteDoc(reference: FirestoreDocReference) {
  return reference.db.delete(reference.collectionName, reference.id);
}

async function getDocs(reference: FirestoreCollectionReference) {
  const documents = await reference.db.list(reference.collectionName);
  return {
    forEach(callback: (document: { data: () => Record<string, any> }) => void) {
      documents.forEach((document) => {
        callback({ data: () => decodeFirestoreFields(document.fields || {}) });
      });
    },
  };
}

export interface LinkRecord {
  aba?: string;
  id: string;
  name: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  destinationType: 'whatsapp' | 'url';
  destinationUrl: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
  campaign: string;
  source: string;
  medium: string;
  content: string;
  shortPath: string;
  status: 'active' | 'inactive';
  realClicksCount: number;
  totalClicksCount: number;
  uniqueVisitorsCount: number;
  suspectBotsCount: number;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClickRecord {
  clickId: string;
  linkId: string;
  linkName: string;
  campaign: string;
  source: string;
  medium: string;
  content: string;
  timestamp: string;
  createdAt: number;
  referer: string;
  browser: string;
  os: string;
  deviceType: string;
  userAgent: string;
  visitorId: string;
  isSuspectBot: boolean;
  isDuplicate: boolean;
  syncedToSheets: boolean;
  syncError?: string | null;
}

export interface SyncQueueItem {
  queueId: string;
  clickId: string;
  linkId: string;
  linkName: string;
  spreadsheetId: string;
  clickRecord: ClickRecord;
  error: string;
  attempts: number;
  createdAt: string;
  status: 'pending' | 'resolved' | 'failed';
}

export interface GoogleAuthSetting {
  connectedEmail: string;
  connectedAt: string;
  encryptedRefreshToken?: string;
  accessToken?: string;
  tokenExpiry?: number;
  hasRefreshToken: boolean;
  updatedAt: string;
}

// In-memory + disk file + Firestore store for high performance and durability
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'hub_store.json');

class AppStore {
  private links: Map<string, LinkRecord> = new Map();
  private clicks: ClickRecord[] = [];
  private syncQueue: Map<string, SyncQueueItem> = new Map();
  private authSetting: GoogleAuthSetting | null = null;
  private db: any = null;
  private isFirestoreReady = false;

  constructor() {
    this.ensureDataDir();
    this.loadFromDisk();
    this.initFirestore();
    this.initSeedData();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err: any) {
      console.warn('[Store] Could not create data directory:', err.message);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.links)) {
          parsed.links.forEach((l: LinkRecord) => this.links.set(l.id, l));
        }
        if (Array.isArray(parsed.clicks)) {
          this.clicks = parsed.clicks;
        }
        if (Array.isArray(parsed.syncQueue)) {
          parsed.syncQueue.forEach((q: SyncQueueItem) => this.syncQueue.set(q.queueId, q));
        }
        if (parsed.authSetting) {
          this.authSetting = parsed.authSetting;
        }
        console.log(`[Store] Loaded from disk: ${this.links.size} links, ${this.clicks.length} clicks, ${this.syncQueue.size} queue items`);
      }
    } catch (err: any) {
      console.warn('[Store] Notice loading from disk:', err.message);
    }
  }

  private saveToDisk() {
    try {
      this.ensureDataDir();
      const payload = {
        links: Array.from(this.links.values()),
        clicks: this.clicks.slice(-1000), // keep latest 1000 in local disk snapshot
        syncQueue: Array.from(this.syncQueue.values()),
        authSetting: this.authSetting,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[Store] Error saving store snapshot to disk:', err.message);
    }
  }

  private initFirestore() {
    try {
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.projectId || !config.firestoreDatabaseId) {
          throw new Error('Project ID ou database ID do Firestore ausente na configuração.');
        }
        this.db = new FirestoreRestClient(config.projectId, config.firestoreDatabaseId);
        this.isFirestoreReady = true;
        // Asynchronously load links, queue, and auth from Firestore
        this.syncFromFirestore().catch((err) => {
          console.warn('[Store] Firestore initial fetch notice:', err.message);
        });
      }
    } catch (err: any) {
      console.warn('[Store] Firestore not available, using in-memory and disk store:', err.message);
    }
  }

  private initSeedData() {
    // Seed initial links if none exist
    if (this.links.size > 0) return;

    const seed1: LinkRecord = {
      id: 'stories1',
      name: 'Stories - Promoção de Primavera',
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
      spreadsheetTitle: 'Planilha Geral de Vendas 2026',
      destinationType: 'whatsapp',
      destinationUrl: 'https://wa.me/5511999998888?text=Ol%C3%A1!%20Vim%20pelo%20Stories%20e%20quero%20o%20cupom',
      whatsappNumber: '5511999998888',
      whatsappMessage: 'Olá! Vim pelo Stories e quero o cupom',
      campaign: 'Primavera_2026',
      source: 'Instagram_Stories',
      medium: 'Social',
      content: 'Stories_Foto_Cupom10',
      shortPath: '/r/stories1',
      status: 'active',
      realClicksCount: 14,
      totalClicksCount: 16,
      uniqueVisitorsCount: 12,
      suspectBotsCount: 2,
      createdByEmail: 'hugoviajante@gmail.com',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    };

    const seed2: LinkRecord = {
      id: 'biolink2',
      name: 'Link da Bio - Página Inicial',
      spreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
      spreadsheetTitle: 'Planilha Geral de Vendas 2026',
      destinationType: 'url',
      destinationUrl: 'https://meunegocio.com.br/produtos',
      campaign: 'Institucional',
      source: 'Instagram_Bio',
      medium: 'Organic',
      content: 'Botao_Principal',
      shortPath: '/r/biolink2',
      status: 'active',
      realClicksCount: 28,
      totalClicksCount: 30,
      uniqueVisitorsCount: 25,
      suspectBotsCount: 2,
      createdByEmail: 'hugoviajante@gmail.com',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    };

    this.links.set(seed1.id, seed1);
    this.links.set(seed2.id, seed2);
  }

  private async syncFromFirestore() {
    if (!this.db) return;
    try {
      // 1. Load links
      const snap = await getDocs(collection(this.db, 'links'));
      snap.forEach((docSnap) => {
        const data = docSnap.data() as LinkRecord;
        if (data.id) {
          this.links.set(data.id, data);
        }
      });

      // 2. Load sync queue items
      const queueSnap = await getDocs(collection(this.db, 'sync_queue'));
      queueSnap.forEach((docSnap) => {
        const item = docSnap.data() as SyncQueueItem;
        if (item.queueId) {
          this.syncQueue.set(item.queueId, item);
        }
      });

      // 3. Load system settings
      const authSnap = await getDoc(doc(this.db, 'system_settings', 'google_auth'));
      if (authSnap.exists()) {
        this.authSetting = authSnap.data() as GoogleAuthSetting;
      }

      this.saveToDisk();
      console.log(`[Store] Firestore sync complete: ${this.links.size} links, ${this.syncQueue.size} queue items`);
    } catch (e: any) {
      console.warn('[Store] syncFromFirestore notice:', e.message);
    }
  }

  // Links operations
  public async getLink(id: string): Promise<LinkRecord | undefined> {
    const cached = this.links.get(id);
    if (cached) return cached;

    if (this.db) {
      try {
        const docSnap = await getDoc(doc(this.db, 'links', id));
        if (docSnap.exists()) {
          const item = docSnap.data() as LinkRecord;
          this.links.set(item.id, item);
          this.saveToDisk();
          return item;
        }
      } catch (err) {
        // ignore fallback to memory
      }
    }
    return undefined;
  }

  public async getAllLinks(): Promise<LinkRecord[]> {
    return Array.from(this.links.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async saveLink(link: LinkRecord): Promise<void> {
    this.links.set(link.id, link);
    this.saveToDisk();
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'links', link.id), link);
      } catch (err: any) {
        console.warn('[Store] Error saving link to Firestore:', err.message);
      }
    }
  }

  public async updateLinkStatus(id: string, status: 'active' | 'inactive'): Promise<LinkRecord | null> {
    const existing = await this.getLink(id);
    if (!existing) return null;

    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    this.links.set(id, existing);
    this.saveToDisk();

    if (this.db) {
      try {
        await updateDoc(doc(this.db, 'links', id), {
          status,
          updatedAt: existing.updatedAt,
        });
      } catch (err: any) {
        console.warn('[Store] Error updating link status in Firestore:', err.message);
      }
    }
    return existing;
  }

  public async deleteLink(id: string): Promise<boolean> {
    const deleted = this.links.delete(id);
    this.saveToDisk();
    if (this.db) {
      try {
        await deleteDoc(doc(this.db, 'links', id));
      } catch (err: any) {
        console.warn('[Store] Error deleting link from Firestore:', err.message);
      }
    }
    return deleted;
  }

  public async incrementLinkStats(
    id: string,
    stats: { isSuspectBot: boolean; isNewVisitor: boolean }
  ): Promise<void> {
    const link = await this.getLink(id);
    if (!link) return;

    const updatedLink = { ...link };
    updatedLink.totalClicksCount = (updatedLink.totalClicksCount || 0) + 1;
    if (stats.isSuspectBot) {
      updatedLink.suspectBotsCount = (updatedLink.suspectBotsCount || 0) + 1;
    } else {
      updatedLink.realClicksCount = (updatedLink.realClicksCount || 0) + 1;
      if (stats.isNewVisitor) {
        updatedLink.uniqueVisitorsCount = (updatedLink.uniqueVisitorsCount || 0) + 1;
      }
    }
    updatedLink.updatedAt = new Date().toISOString();

    if (this.db) {
      try {
        await updateDoc(doc(this.db, 'links', id), {
          totalClicksCount: updatedLink.totalClicksCount,
          suspectBotsCount: updatedLink.suspectBotsCount,
          realClicksCount: updatedLink.realClicksCount,
          uniqueVisitorsCount: updatedLink.uniqueVisitorsCount,
          updatedAt: updatedLink.updatedAt,
        });
      } catch (err) {
        console.error('[Store] Error updating link click counters in Firestore:', (err as any).message);
        throw err;
      }
    }

    this.links.set(id, updatedLink);
    this.saveToDisk();
  }

  // Clicks operations: DURABLE PERSISTENCE
  public async recordClick(click: ClickRecord): Promise<void> {
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'clicks', click.clickId), click);
      } catch (err: any) {
        console.error('[Store] Error saving click to Firestore:', err.message);
        throw err;
      }
    }

    this.clicks.push(click);
    this.saveToDisk(); // Synchronously persist to local snapshot after remote persistence
  }

  public getRecentClicksForLink(linkId: string, limitCount = 50): ClickRecord[] {
    return this.clicks
      .filter((c) => c.linkId === linkId)
      .slice(-limitCount);
  }

  public getAllClicks(): ClickRecord[] {
    return [...this.clicks];
  }

  public getClicksForLink(linkId: string): ClickRecord[] {
    return this.clicks.filter((c) => c.linkId === linkId);
  }

  // Sync Queue operations: DURABLE PERSISTENCE
  public async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'sync_queue', item.queueId), item);
      } catch (err: any) {
        console.error('[Store] Error saving sync queue to Firestore:', err.message);
        throw err;
      }
    }

    this.syncQueue.set(item.queueId, item);
    this.saveToDisk(); // Persist to local snapshot after remote persistence
  }

  public async getSyncQueue(filter: 'all' | 'pending' | 'failed' | 'unresolved' = 'unresolved'): Promise<SyncQueueItem[]> {
    if (this.db) {
      try {
        const snap = await getDocs(collection(this.db, 'sync_queue'));
        snap.forEach((docSnap) => {
          const item = docSnap.data() as SyncQueueItem;
          if (item.queueId) {
            this.syncQueue.set(item.queueId, item);
          }
        });
      } catch (err: any) {
        console.warn('[Store] Notice reading sync_queue from Firestore:', err.message);
      }
    }

    const allItems = Array.from(this.syncQueue.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filter === 'all') return allItems;
    if (filter === 'pending') return allItems.filter((q) => q.status === 'pending');
    if (filter === 'failed') return allItems.filter((q) => q.status === 'failed');
    // 'unresolved' includes both pending and failed
    return allItems.filter((q) => q.status === 'pending' || q.status === 'failed');
  }

  public async markSyncQueueResolved(queueId: string): Promise<void> {
    const item = this.syncQueue.get(queueId);
    if (item) {
      item.status = 'resolved';
      this.saveToDisk();

      // Also mark click as synced in clicks collection
      const click = this.clicks.find((c) => c.clickId === item.clickId);
      if (click) {
        click.syncedToSheets = true;
        click.syncError = null;
      }

      if (this.db) {
        try {
          await updateDoc(doc(this.db, 'sync_queue', queueId), { status: 'resolved' });
          if (item.clickId) {
            await updateDoc(doc(this.db, 'clicks', item.clickId), {
              syncedToSheets: true,
              syncError: null,
            });
          }
        } catch {
          // silent
        }
      }
    }
  }

  public async updateSyncQueueAttempts(queueId: string, error: string): Promise<void> {
    const item = this.syncQueue.get(queueId);
    if (item) {
      item.attempts = (item.attempts || 0) + 1;
      item.error = error;
      if (item.attempts >= 5) {
        item.status = 'failed';
      }
      this.saveToDisk();

      if (this.db) {
        try {
          await updateDoc(doc(this.db, 'sync_queue', queueId), {
            attempts: item.attempts,
            error: item.error,
            status: item.status,
          });
        } catch {
          // silent
        }
      }
    }
  }

  public async resetAllFailedQueueItems(): Promise<number> {
    let count = 0;
    for (const [queueId, item] of this.syncQueue.entries()) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
        count++;
        if (this.db) {
          try {
            await updateDoc(doc(this.db, 'sync_queue', queueId), {
              status: 'pending',
              attempts: 0,
            });
          } catch {
            // silent
          }
        }
      }
    }
    this.saveToDisk();
    return count;
  }

  // Google Auth Setting operations
  public async getAuthSetting(): Promise<GoogleAuthSetting | null> {
    if (this.authSetting) return this.authSetting;
    if (this.db) {
      try {
        const snap = await getDoc(doc(this.db, 'system_settings', 'google_auth'));
        if (snap.exists()) {
          this.authSetting = snap.data() as GoogleAuthSetting;
          this.saveToDisk();
          return this.authSetting;
        }
      } catch {
        // silent
      }
    }
    return null;
  }

  public async saveAuthSetting(setting: GoogleAuthSetting): Promise<void> {
    this.authSetting = setting;
    this.saveToDisk();
    if (this.db) {
      try {
        await setDoc(doc(this.db, 'system_settings', 'google_auth'), setting);
      } catch (err: any) {
        console.warn('[Store] Error saving google auth to Firestore:', err.message);
      }
    }
  }
}

export const store = new AppStore();


