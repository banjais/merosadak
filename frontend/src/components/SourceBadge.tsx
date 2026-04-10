// src/components/SourceBadge.tsx
// Displays the data source label for incidents/traffic with color coding

import React from 'react';

interface SourceBadgeProps {
  source?: string;
  size?: 'sm' | 'md';
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  'Department of Roads': {
    label: 'DOR',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: '🏛️',
  },
  DOR: {
    label: 'DOR',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: '🏛️',
  },
  sheets: {
    label: 'DOR',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: '🏛️',
  },
  highway: {
    label: 'DOR',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: '🏛️',
  },
  tomtom: {
    label: 'TomTom',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    icon: '🚦',
  },
  waze: {
    label: 'Waze',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    icon: '🗣️',
  },
  overpass: {
    label: 'OSM',
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    icon: '🗺️',
  },
  community: {
    label: 'Community',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: '👥',
  },
  user: {
    label: 'User Report',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: '📝',
  },
  Verified: {
    label: 'Verified',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: '✓',
  },
};

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, size = 'sm' }) => {
  const rawSource = source || 'Verified';
  const config = SOURCE_CONFIG[rawSource] || {
    label: rawSource,
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    icon: '📍',
  };

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[9px]'
    : 'px-2 py-1 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full ${config.bg} ${config.color} ${sizeClasses}`}
      title={`Data source: ${rawSource}`}
    >
      <span className="text-[10px]">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
};
