export const SUPER_ADMIN_EMAIL = 'banjays@gmail.com';

export type AccessRole = 'SuperAdmin' | 'OfficeAdmin' | 'GeneralUser';

export interface AccessProfile {
  email: string;
  role: AccessRole;
}

export interface OfficeAdmin {
  email: string;
  addedAt: string;
  addedBy: string;
}

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}
