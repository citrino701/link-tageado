/**
 * Client API for authentication and administration via pure backend OAuth 2.0
 */

export interface AdminStatus {
  adminEmail: string;
  isOAuthConfigured: boolean;
  clientId?: string | null;
  hasClientSecret?: boolean;
  isConnected: boolean;
  hasRefreshToken: boolean;
  connectedEmail: string | null;
  connectedAt: string | null;
  currentUserEmail: string | null;
  totalLinks: number;
  totalClicks: number;
  realClicks: number;
  uniqueVisitors: number;
  suspectBots: number;
  syncFailuresCount: number;
}

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const res = await fetch('/api/admin/status');
  if (!res.ok) {
    throw new Error('Falha ao obter status administrativo');
  }
  return res.json();
}

export async function getGoogleAuthUrl(): Promise<{ isConfigured: boolean; authUrl?: string; error?: string }> {
  const res = await fetch('/api/auth/google/url');
  const data = await res.json();
  if (!res.ok) {
    return { isConfigured: false, error: data.error || 'Credenciais OAuth não configuradas.' };
  }
  return { isConfigured: true, authUrl: data.authUrl };
}

export async function logoutAdmin(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}
