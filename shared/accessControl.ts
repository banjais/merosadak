export const SUPER_ADMIN_EMAIL = 'banjays@gmail.com';

export type AccessRole = 'SuperAdmin' | 'OfficeAdmin' | 'GeneralUser';

export interface AccessProfile {
  email: string;
  role: AccessRole;
  sheetEntryEnabled?: boolean;
}

export interface OfficeAdmin {
  email: string;
  addedAt: string;
  addedBy: string;
}

export interface AccessAnalyticsDay {
  date: string;
  total: number;
  generalUsers: number;
  officeAdmins: number;
  superAdmins: number;
}

export interface AccessAnalytics {
  periodDays: number;
  uniqueAccounts: number;
  generalUsers: number;
  officeAdmins: number;
  superAdmins: number;
  daily: AccessAnalyticsDay[];
  note: string;
}

export interface SheetRoadEntry {
  highwayCode: string;
  highwayName: string;
  district: string;
  location: string;
  status: string;
  notes: string;
}

export interface SheetSubmissionReceipt {
  submittedAt: string;
  sheetName: string;
}

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}
