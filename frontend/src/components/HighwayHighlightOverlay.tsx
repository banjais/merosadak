import React, { useEffect } from 'react';
import { useMap, GeoJSON, CircleMarker, Popup } from 'react-leaflet';
import { L } from '../lib/leaflet';
import { FeatureCollection } from 'geojson';
import { TravelIncident } from '../types';
import { ShieldBan, ArrowRightLeft, Info, Maximize, Navigation } from 'lucide-react';

interface HighwayHighlightOverlayProps {
  highwayCode: string | null;
  geoData: FeatureCollection | null;
  incidents: TravelIncident[];
  viewMode?: 'pavement' | 'simple';
  disableAutoZoom?: boolean;
  customColor?: string;
  alternativeMetadata?: any;
  lang?: string;
  hideIncidents?: boolean;
}

export const HighwayHighlightOverlay: React.FC<HighwayHighlightOverlayProps> = ({
  highwayCode,
  geoData,
  incidents,
  viewMode = 'pavement',
  disableAutoZoom = false,
  customColor,
  alternativeMetadata,
  lang = 'en',
  hideIncidents = false
}) => {
  const map = useMap();

  // Internal localization helper
  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      ne: {
        'Blacktopped': 'कालोपत्रे',
        'Gravel / WBM': 'ग्राभेल / WBM',
        'Earthen / Unpaved': 'कच्ची सडक',
        'Pavement Status': 'सडकको अवस्था',
        'Surface': 'सतह',
        'Length': 'लम्बाई',
        'Quality Score': 'गुणस्तर स्कोर',
        'Est. Time': 'अनुमानित समय',
        'Total Length': 'कुल लम्बाई',
        'Focus Route': 'रुटमा केन्द्रित हुनुहोस्',
        'Blocked': 'अवरुद्ध',
        'One-Lane': 'एकतर्फी',
        'Unknown': 'अज्ञात'
      }
    };
    return lang === 'ne' ? (translations.ne[key] || key) : key;
  };

  const getLocalizedSurfaceValue = (surface: string) => {
    if (lang !== 'ne') return surface;
    const s = surface.toLowerCase();
    if (s.includes('blacktop') || s.includes('asphalt')) return t('Blacktopped');
    if (s.includes('gravel') || s.includes('wbm')) return t('Gravel / WBM');
    if (s.includes('earth') || s.includes('unpaved')) return t('Earthen / Unpaved');
    return surface;
  };

  // Auto-zoom to highway extent when data is loaded
  useEffect(() => {
    if (geoData && geoData.features.length > 0 && !disableAutoZoom) {
      try {
        const bounds = L.geoJSON(geoData).getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [100, 100], animate: true });
        }
      } catch (e) {
        console.error("[Overlay] Error fitting bounds:", e);
      }
    }
  }, [geoData, map]);

  // Handler to focus on the route bounds
  const handleFlyToRoute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (geoData && geoData.features.length > 0) {
      const bounds = L.geoJSON(geoData).getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [80, 80], animate: true });
      }
    }
  };

  // Dynamic styling representing pavement quality "progress" along the route
  const getStyle = (feature: any) => {
    if (viewMode === 'simple') {
      return {
        color: customColor || '#6366f1',
        weight: 8,
        opacity: 0.9,
        lineJoin: 'round' as const,
        lineCap: 'round' as const,
        dashArray: ''
      };
    }

    const props = feature.properties || {};
    const paveType = String(props.pave_type || props.surface || '').toLowerCase();

    let color = '#6366f1'; // Indigo (Blacktopped)
    let weight = 8;
    let opacity = 0.9;
    let dashArray = '';

    if (paveType.includes('gravel') || paveType.includes('wbm')) {
      color = '#f59e0b'; // Amber (Gravel)
      weight = 6;
    } else if (paveType.includes('earth') || paveType.includes('unpaved')) {
      color = '#ef4444'; // Red (Earthen)
      weight = 5;
      dashArray = '1, 10'; // Dotted effect for unpaved segments
    }

    return {
      color,
      weight,
      opacity,
      dashArray,
      lineJoin: 'round' as const,
      lineCap: 'round' as const
    };
  };

  if (!geoData || !highwayCode) return null;

  // Filter incidents that are specifically on this highway
  const highwayIncidents = incidents.filter(i =>
    i.road_refno === highwayCode ||
    (i.title || i.name || '').toUpperCase().includes(highwayCode)
  );

  return (
    <>
      {/* Danger Zone Indicators (Pulsing segments for 20km/h zones) */}
      {!disableAutoZoom && viewMode === 'pavement' && (
        <GeoJSON
          key={`danger-${highwayCode}`}
          data={geoData}
          filter={(feature: any) => feature.properties?.danger_zone === true}
          style={{
            color: '#ef4444',
            weight: 16,
            opacity: 0.4,
            dashArray: '1, 15',
            lineCap: 'round',
            className: 'animate-pulse'
          }}
          interactive={false}
        />
      )}

      {/* Pavement Composition Legend */}
      {viewMode === 'pavement' && (
        <div className="absolute bottom-28 left-4 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-[2rem] border border-outline/10 shadow-xl animate-in slide-in-from-left-4 duration-300 pointer-events-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Info size={12} />
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant/80 font-label">
              {t('Pavement Status')}
            </h4>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-2 rounded-full bg-[#6366f1] shadow-sm shadow-indigo-500/20" />
              <span className="text-[10px] font-bold text-on-surface/70 group-hover:text-primary transition-colors">{t('Blacktopped')}</span>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-1.5 rounded-full bg-[#f59e0b] shadow-sm shadow-amber-500/20" />
              <span className="text-[10px] font-bold text-on-surface/70 group-hover:text-amber-600 transition-colors">{t('Gravel / WBM')}</span>
            </div>
            <div className="flex items-center gap-3 group">
              <div className="w-10 h-1.5 border-t-2 border-dashed border-[#ef4444]" />
              <span className="text-[10px] font-bold text-on-surface/70 group-hover:text-error transition-colors">{t('Earthen / Unpaved')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Background shadow for better contrast against map tiles */}
      <GeoJSON
        key={`bg-${highwayCode}`}
        data={geoData}
        style={{ color: '#000', weight: 12, opacity: 0.1 }}
        interactive={false}
      />

      {/* The Technical Highway Line (Pavement Quality Visualization) */}
      <GeoJSON
        key={`line-${highwayCode}`}
        data={geoData}
        style={getStyle}
      >
        <Popup>
          {(feature: any) => (
            <div className="p-2 min-w-[160px] marker-3d-content">
              <div className="flex items-center gap-2 mb-2 border-b border-outline/10 pb-2">
                <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">{highwayCode}</span>
                <span className="text-xs font-bold text-on-surface truncate">
                  {feature.properties?.dist_name || 'Highway Section'}
                </span>
              </div>
              <div className="space-y-1.5">
                {alternativeMetadata ? (
                  <>
                    <div className="flex justify-between text-[10px] items-center gap-4">
                      <span className="text-on-surface-variant">{t('Quality Score')}:</span>
                      <span className="font-black text-primary bg-primary/5 px-1.5 py-0.5 rounded">{alternativeMetadata.qualityScore}% ({alternativeMetadata.qualityGrade})</span>
                    </div>
                    <div className="flex justify-between text-[10px]"><span className="text-on-surface-variant">{t('Est. Time')}:</span><span className="font-bold">~ {alternativeMetadata.estimatedDuration?.toFixed(1) || 'N/A'} hrs</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-on-surface-variant">{t('Total Length')}:</span><span className="font-bold">{alternativeMetadata.lengthKm || '0'} km</span></div>

                    <button
                      onClick={handleFlyToRoute}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-sm"
                    >
                      <Maximize size={10} />
                      {t('Focus Route')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px]"><span className="text-on-surface-variant">{t('Surface')}:</span><span className="font-bold capitalize text-primary">{getLocalizedSurfaceValue(feature.properties?.pave_type || 'Unknown')}</span></div>
                    <div className="flex justify-between text-[10px]"><span className="text-on-surface-variant">{t('Length')}:</span><span className="font-bold">{feature.properties?.link_len || '0'} km</span></div>
                  </>
                )}
              </div>
            </div>
          )}
        </Popup>
      </GeoJSON>

      {/* Status Markers for Blockages or Restrictions */}
      {!hideIncidents && highwayIncidents.map((incident) => {
        const isBlocked = (incident.status || '').toLowerCase().includes('block');
        const color = isBlocked ? '#ef4444' : '#f59e0b';

        if (!incident.lat || !incident.lng) return null;

        return (
          <CircleMarker
            key={incident.id}
            center={[incident.lat, incident.lng]}
            radius={9}
            pathOptions={{
              fillColor: color,
              fillOpacity: 1,
              color: 'white',
              weight: 3
            }}
          >
            <Popup>
              <div className="p-2 marker-3d-content">
                <div className={`flex items-center gap-1.5 mb-2 ${isBlocked ? 'text-error' : 'text-amber-600'}`}>
                  {isBlocked ? <ShieldBan size={16} /> : <ArrowRightLeft size={16} />}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {isBlocked ? t('Blocked') : t('One-Lane')}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-on-surface mb-1">{incident.title || incident.name}</h4>
                <p className="text-[10px] text-on-surface-variant leading-relaxed font-medium">
                  {incident.incidentPlace || 'Highway location'}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};