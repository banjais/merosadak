/**
 * Shared Department of Roads letterhead used by the on-screen report, the
 * print view and the generated PDF, so all three carry identical branding.
 */

export const DOR_BRANDING = {
  line1: 'Government of Nepal',
  line2: 'Ministry of Physical Infrastructure and Transport',
  line3: 'Department of Roads',
} as const;

export const DOR_REPORT_TITLE = 'Nepal Route and Distance Report';

export const DOR_REPORT_NOTE =
  'Distance figures use available DoR publications, archived road data, or mapped coordinates. The source and calculation method for each result are listed below.';

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

const reportDateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Asia/Kathmandu',
});

const reportTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeStyle: 'short',
  timeZone: 'Asia/Kathmandu',
});

export interface ReportTimestamp {
  date: string;
  time: string;
}

/** Date and time in Nepal's timezone, suitable for separate print lines. */
export function formatReportTimestampParts(at: Date): ReportTimestamp {
  return {
    date: reportDateFormatter.format(at),
    time: reportTimeFormatter.format(at),
  };
}

/** "29 Sept 2026, 12:34" — compact timestamp for PDF metadata and body text. */
export function formatReportTimestamp(at: Date): string {
  const { date, time } = formatReportTimestampParts(at);
  return `${date}, ${time}`;
}
