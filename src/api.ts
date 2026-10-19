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
