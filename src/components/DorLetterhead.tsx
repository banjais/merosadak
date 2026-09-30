import React from 'react';
import { DOR_BRANDING, DOR_REPORT_NOTE, DOR_REPORT_TITLE, ReportIdentity, ReportTimestamp } from '../utils/reportBranding';
import { DOR_SOURCE_URL } from '../utils/proofLinks';

/**
 * Stylised national emblem of Nepal: the two pennons, the Himalayan range and
 * the lotus base. Drawn on a 64x64 grid so it stays crisp at any print size.
 */
export const NepalEmblem: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    role="img"
    aria-label="National Emblem of Nepal"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M32 6 L53 17.5 C53 30 45 41.5 32 47 C19 41.5 11 30 11 17.5 Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path
      d="M32 6 L32 47 C22 44.5 14.5 38 11.5 29 C9.8 23.6 10.2 19.4 11 17.5 Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M32 6 L32 47" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M16 21 L21 26 L24.5 22.5 L28 27 L31 23.5 L34 27 L37.5 22.5 L41 26 L46 21"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M24 35 C27 33.5 29 34 31 36 C33 38 35 38.5 38 37" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M26 39 L33 43" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M38 39 L31 43" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path
      d="M20 50 C22 47 24 47 26 50 C28 46.5 30 46.5 32 50 C34 46.5 36 46.5 38 50 C40 47 42 47 44 50"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M17 53.5 H47" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

interface DorLetterheadProps {
  /** Print/download date and time, shown on separate lines. */
  timestamp: ReportTimestamp;
  /** Signed-in user, when available. */
  identity?: ReportIdentity;
  /** Compact rendering for narrow viewports. */
  compact?: boolean;
  /** Show the provided national emblem for a distance-calculator report only. */
  useGovernmentEmblem?: boolean;
}

/**
 * Branded report header. The source agency is cited separately; this app is
 * independent and does not issue Department of Roads documents.
 */
export const DorLetterhead: React.FC<DorLetterheadProps> = ({ timestamp, identity, compact, useGovernmentEmblem = false }) => (
  <div className={`dor-letterhead flex items-center gap-3 border-b border-slate-700 pb-3 mb-1 ${useGovernmentEmblem ? 'government-report-letterhead' : ''}`}>
    <img
      src={useGovernmentEmblem ? '/logo.jpeg' : '/logo.svg'}
      alt={useGovernmentEmblem ? 'Government of Nepal emblem' : 'MEROSADAK logo'}
      className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} shrink-0 rounded-lg border border-slate-700 bg-slate-950 p-1 object-contain`}
    />
    <div className="min-w-0 flex-1">
      {useGovernmentEmblem ? (
        <>
          <p className="text-[10px] font-bold text-white leading-tight">{DOR_BRANDING.line1}</p>
          <p className="text-[10px] font-semibold text-slate-200 leading-tight">{DOR_BRANDING.line2}</p>
          <a
            href={DOR_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[10px] font-semibold text-slate-200 leading-tight hover:text-cyan-300 hover:underline"
          >
            {DOR_BRANDING.line3}
          </a>
          <p className="mt-1 text-[9px] font-semibold text-slate-300 leading-tight">{DOR_REPORT_TITLE}</p>
          <p className="max-w-2xl text-[9px] text-amber-400 leading-tight">{DOR_REPORT_NOTE}</p>
        </>
      ) : (
        <>
          <p className="text-sm font-black text-white leading-tight">MEROSADAK</p>
          <p className="text-[10px] text-slate-400 leading-tight">Nepal route and distance report</p>
          <p className="text-[9px] text-amber-400 leading-tight">Independent report; not issued by the Department of Roads.</p>
        </>
      )}
    </div>
    <div className="text-right shrink-0">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">Printed</p>
      <p className="text-[10px] font-semibold text-slate-300 whitespace-nowrap">{timestamp.date}</p>
      <p className="text-[10px] text-slate-400 whitespace-nowrap">{timestamp.time}</p>
      {identity?.name && (
        <p className="text-[10px] text-slate-400 whitespace-nowrap max-w-[150px] truncate">{identity.name}</p>
      )}
      {identity?.email && (
        <p className="text-[9px] text-slate-500 whitespace-nowrap max-w-[150px] truncate">{identity.email}</p>
      )}
    </div>
  </div>
);
