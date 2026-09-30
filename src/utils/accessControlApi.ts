import type { User } from 'firebase/auth';
import type {
  AccessAnalytics,
  AccessProfile,
  OfficeAdmin,
  SheetRoadEntry,
  SheetSubmissionReceipt,
} from '../../shared/accessControl';
import { fetchJson } from './apiConfig';

function withAuthorization(user: User, init: RequestInit = {}): Promise<RequestInit> {
  return user.getIdToken().then((token) => ({
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      Authorization: `Bearer ${token}`,
    },
  }));
}

export async function fetchAccessProfile(user: User): Promise<AccessProfile> {
  return fetchJson<AccessProfile>('/api/access/profile', await withAuthorization(user));
}

export async function fetchOfficeAdmins(user: User): Promise<OfficeAdmin[]> {
  return fetchJson<{ officeAdmins: OfficeAdmin[] }>(
    '/api/access/office-admins',
    await withAuthorization(user)
  ).then(({ officeAdmins }) => officeAdmins);
}

export async function fetchAccessAnalytics(user: User): Promise<AccessAnalytics> {
  return fetchJson<AccessAnalytics>(
    '/api/access/analytics',
    await withAuthorization(user)
  );
}

export async function submitRoadEntry(user: User, entry: SheetRoadEntry): Promise<SheetSubmissionReceipt> {
  return fetchJson<SheetSubmissionReceipt>(
    '/api/access/sheet-entry',
    await withAuthorization(user, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  );
}

export async function updateOfficeAdmin(
  user: User,
  action: 'add' | 'remove',
  email: string
): Promise<OfficeAdmin[]> {
  return fetchJson<{ officeAdmins: OfficeAdmin[] }>(
    '/api/access/office-admins',
    await withAuthorization(user, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, email }),
    })
  ).then(({ officeAdmins }) => officeAdmins);
}
