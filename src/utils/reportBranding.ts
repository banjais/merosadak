/**
 * Shared Department of Roads letterhead used by the on-screen report, the
 * print view and the generated PDF, so all three carry identical branding.
 */

export const DOR_BRANDING = {
  line1: 'Government of Nepal',
  line2: 'Ministry of Physical Infrastructure',
  line3: 'Department of Roads',
} as const;

/** Nepali (Devanagari) rendering of the same letterhead. */
export const DOR_BRANDING_NE = {
  line1: 'नेपाल सरकार',
  line2: 'भौतिक पूर्वाधार तथा यातायात मन्त्रालय',
  line3: 'सडक विभाग',
} as const;

export interface ReportIdentity {
  /** Signed-in user's display name, when available. */
  name?: string;
  /** Signed-in user's email, when available. */
  email?: string;
}

/** "29 Sept 2026, 12:34 (Asia/Kathmandu)" — matches the PDF letterhead. */
export function formatReportTimestamp(at: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kathmandu',
  }).format(at);
}
