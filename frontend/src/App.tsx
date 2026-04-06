// backend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const NEPAL_CENTER: [number, number] = [28.3949, 84.1240];
const NEPAL_MAX_BOUNDS: [[number, number], [number, number]] = [[26.0, 79.5], [30.5, 88.5]];

const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: `<div style="background:#4285F4;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(66,133,244,0.6);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Component: Dynamic boundary using preloaded GeoJSONs
const DynamicBoundary: React.FC<{ province: any; district: any; local: any; isDarkMode: boolean }> = ({ province, district, local, isDarkMode }) => {
  const [currentLevel, setCurrentLevel] = useState<'province' | 'district' | 'local'>('province');
  const map = useMapEvents({
    zoomend: () => {
      const zoom = map.getZoom();
      if (zoom < 8) setCurrentLevel('province');
      else if (zoom >= 8 && zoom < 12) setCurrentLevel('district');
      else setCurrentLevel('local');
    }
  });

  const style = {
    color: isDarkMode ? '#FFD700' : '#2b7a78',
    weight: 2,
    fillOpacity: 0.1,
  };

  let data = province;
  if (currentLevel === 'district') data = district;
  if (currentLevel === 'local') data = local;

  return <GeoJSON data={data} style={style} />;
};

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [geo, setGeo] = useState({ lat: 28.3949, lng: 84.1240, loading: false });

  const [provinceData, setProvinceData] = useState<any>(null);
  const [districtData, setDistrictData] = useState<any>(null);
  const [localData, setLocalData] = useState<any>(null);

  // Load all boundaries at startup
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [prov, dist, local] = await Promise.all([
          fetch('/data/province.geojson').then(res => res.json()),
          fetch('/data/district.geojson').then(res => res.json()),
          fetch('/data/local.geojson').then(res => res.json()),
        ]);
        setProvinceData(prov);
        setDistrictData(dist);
        setLocalData(local);
      } catch (e) {
        console.error('Failed to load boundary data', e);
      }
    };
    fetchAll();
  }, []);

  // Get browser geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      setGeo(prev => ({ ...prev, loading: true }));
      navigator.geolocation.getCurrentPosition(
        (position) => setGeo({ lat: position.coords.latitude, lng: position.coords.longitude, loading: false }),
        () => setGeo(prev => ({ ...prev, loading: false }))
      );
    }
  }, []);

  if (!provinceData || !districtData || !localData) {
    return <div className="flex items-center justify-center h-screen text-xl">Loading map data...</div>;
  }

  return (
    <div className={`h-screen w-screen flex flex-col ${isDarkMode ? 'dark' : ''}`}>
      <header className="flex justify-between items-center p-2 bg-gray-100 dark:bg-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sadak-Sathi Map</h1>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </header>

      <main className="flex-1 relative">
        <MapContainer
          center={[geo.lat, geo.lng]}
          zoom={7}
          minZoom={6}
          maxZoom={19}
          maxBounds={NEPAL_MAX_BOUNDS}
          maxBoundsViscosity={0.95}
          zoomControl={true}
          className="h-full w-full"
        >
          {/* Base Tile Layer */}
          <TileLayer
            url={isDarkMode
              ? 'https://tiles.stadiamaps.com/tiles/alidade_dark/{z}/{x}/{y}{r}.png'
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          />

          {/* Dynamic boundary overlay */}
          <DynamicBoundary
            province={provinceData}
            district={districtData}
            local={localData}
            isDarkMode={isDarkMode}
          />

          {/* User Location Marker */}
          {!geo.loading && geo.lat !== 0 && geo.lng !== 0 && (
            <Marker position={[geo.lat, geo.lng]} icon={userLocationIcon} />
          )}
        </MapContainer>
      </main>
    </div>
  );
};

export default App;