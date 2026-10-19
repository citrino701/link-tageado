/**
 * Status of the private Apps Script administration panel.
 */
export interface AdminStatus {
  adminEmail: string;
  setupAt?: string | null;
  connectedAt?: string | null;
}

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const res = await fetch('/api/admin/status');
  if (!res.ok) {
    throw new Error('Falha ao obter status administrativo');
  }
  return res.json();
}

export async function readAdmin<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Não foi possível carregar os dados.');
  return data as T;
}

export async function fetchCatalog() {
  const res = await fetch('/api/admin/bootstrap');
  if (res.status === 404) {
    // Keep the existing deployment usable while its Code.gs is being updated.
    const [status, data] = await Promise.all([
      fetchAdminStatus(),
      readAdmin<{ links: import('./services/store.ts').LinkRecord[] }>('/api/admin/links'),
    ]);
    return { ...status, links: data.links, metricsIncluded: true };
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Não foi possível carregar as campanhas.');
  return { ...data, metricsIncluded: false } as AdminStatus & {
    links: import('./services/store.ts').LinkRecord[];
    metricsIncluded: boolean;
  };
}

