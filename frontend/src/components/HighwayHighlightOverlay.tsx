// src/components/HighwayHighlightOverlay.tsx
import React from 'react';
import { LayerGroup, Polyline } from 'react-leaflet';
import { useHighway } from '../hooks/useHighways';

interface HighwayHighlightOverlayProps {
  highwayCode: string | null;
  isVisible: boolean;
}

export const HighwayHighlightOverlay: React.FC<HighwayHighlightOverlayProps> = ({
  highwayCode,
  isVisible
}) => {
  const { data: highwayData, isLoading, error } = useHighway(highwayCode);

  if (!isVisible || !highwayCode || !highwayData?.features) {
    return null;
  }

  if (isLoading) {
    return null; // Could add a loading indicator here
  }

  if (error) {
    console.error(`[HighwayHighlightOverlay] Error loading highway ${highwayCode}:`, error);
    return null;
  }

  return (
    <LayerGroup>
      {highwayData.features.map((feature: any, index: number) => {
        if (!feature.geometry || !feature.geometry.coordinates) {
          return null;
        }

        // Validate coordinates
        const coords = feature.geometry.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) {
          return null;
        }

        // For LineString
        if (feature.geometry.type === 'LineString') {
          const isValidLineString = coords.every(
            (c: any) => Array.isArray(c) && c.length >= 2 &&
              typeof c[0] === 'number' && typeof c[1] === 'number' &&
              !isNaN(c[0]) && !isNaN(c[1])
          );

          if (!isValidLineString) {
            return null;
          }

          const latlngs: [number, number][] = coords.map(
            (coord: number[]) => [coord[1], coord[0]] as [number, number]
          );

          return (
            <Polyline
              key={`${highwayCode}-line-${index}`}
              positions={latlngs}
              pathOptions={{
                color: '#3B82F6',
                weight: 5,
                opacity: 0.8,
              }}
            />
          );
        }

        // For MultiLineString
        if (feature.geometry.type === 'MultiLineString') {
          return coords.map((line: number[][], lineIndex: number) => {
            const isValidLine = line.every(
              (c: any) => Array.isArray(c) && c.length >= 2 &&
                typeof c[0] === 'number' && typeof c[1] === 'number' &&
                !isNaN(c[0]) && !isNaN(c[1])
            );

            if (!isValidLine) {
              return null;
            }

            const latlngs: [number, number][] = line.map(
              (coord: number[]) => [coord[1], coord[0]] as [number, number]
            );

            return (
              <Polyline
                key={`${highwayCode}-multi-${index}-${lineIndex}`}
                positions={latlngs}
                pathOptions={{
                  color: '#3B82F6',
                  weight: 5,
                  opacity: 0.8,
                }}
              />
            );
          }).filter(Boolean);
        }

        return null;
      })}
    </LayerGroup>
  );
};

