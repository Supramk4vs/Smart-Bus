import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Search,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  CheckCircle2,
  Navigation,
  Compass,
  X,
  Crosshair,
} from 'lucide-react';
import { COLLEGE_DESTINATION } from '../types/index.ts';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCtXeSO-M21CyGRIDiz0kA1g23Ae2C5XQQ';

const GOOGLE_MAPS_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
  'bf51a910020fa25a';

interface BoardingPointPickerMapProps {
  initialPointName?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onSelectLocation: (loc: { name: string; lat: number; lng: number }) => void;
  onCancel?: () => void;
}

// Controller inside the map instance to handle programmatic pan/zoom
const MapController: React.FC<{
  targetCenter: { lat: number; lng: number } | null;
  zoomLevel?: number;
  onMapReady?: (map: google.maps.Map) => void;
}> = ({ targetCenter, zoomLevel, onMapReady }) => {
  const map = useMap();

  useEffect(() => {
    if (map && onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    if (!map || !targetCenter) return;
    map.panTo(targetCenter);
    if (typeof zoomLevel === 'number') {
      map.setZoom(zoomLevel);
    }
  }, [map, targetCenter?.lat, targetCenter?.lng, zoomLevel]);

  return null;
};

// Preset transit nodes for quick exploration around campus & transit corridors
const QUICK_PRESETS = [
  { name: 'Avadi Market', lat: 13.1147, lng: 80.1018 },
  { name: 'HVF Main Road', lat: 13.1252, lng: 80.1075 },
  { name: 'Ajeya Stadium', lat: 13.1195, lng: 80.0984 },
  { name: 'IAF Main Gate', lat: 13.1288, lng: 80.0945 },
  { name: 'CRP Cross Road', lat: 13.1085, lng: 80.1142 },
  { name: 'Ambattur OT', lat: 13.1143, lng: 80.1548 },
  { name: 'Poonamallee', lat: 13.0489, lng: 80.0934 },
  { name: 'College Campus', lat: COLLEGE_DESTINATION.latitude, lng: COLLEGE_DESTINATION.longitude },
];

export const BoardingPointPickerMap: React.FC<BoardingPointPickerMapProps> = ({
  initialPointName = '',
  initialLat,
  initialLng,
  onSelectLocation,
  onCancel,
}) => {
  const [pointName, setPointName] = useState<string>(initialPointName);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof initialLat === 'number' && typeof initialLng === 'number' && !isNaN(initialLat) && !isNaN(initialLng)) {
      return { lat: initialLat, lng: initialLng };
    }
    return null;
  });

  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(() => {
    if (typeof initialLat === 'number' && typeof initialLng === 'number' && !isNaN(initialLat) && !isNaN(initialLng)) {
      return { lat: initialLat, lng: initialLng };
    }
    return { lat: 13.1147, lng: 80.1018 }; // Default Avadi central coordinates
  });

  const [mapZoom, setMapZoom] = useState<number>(15);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  // When admin clicks on the map
  const handleMapClick = useCallback((e: any) => {
    if (e.detail && e.detail.latLng) {
      const lat = typeof e.detail.latLng.lat === 'function' ? e.detail.latLng.lat() : e.detail.latLng.lat;
      const lng = typeof e.detail.latLng.lng === 'function' ? e.detail.latLng.lng() : e.detail.latLng.lng;

      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        setSelectedCoords({ lat, lng });

        // If the name is blank, check if it's close to a preset or suggest coordinates
        if (!pointName.trim()) {
          const closest = QUICK_PRESETS.find((p) => {
            const d = Math.sqrt(Math.pow(p.lat - lat, 2) + Math.pow(p.lng - lng, 2));
            return d < 0.005; // ~500m
          });
          if (closest) {
            setPointName(closest.name);
          } else {
            setPointName(`Boarding Stop (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          }
        }
      }
    }
  }, [pointName]);

  // Search location handler
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);

    // 1. Check quick preset list first
    const matchedPreset = QUICK_PRESETS.find((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );
    if (matchedPreset) {
      setMapCenter({ lat: matchedPreset.lat, lng: matchedPreset.lng });
      setMapZoom(16);
      setIsSearching(false);
      return;
    }

    // 2. Perform Geocoding lookup via server proxy to prevent CORS blocks
    try {
      const fullQuery = query.toLowerCase().includes('chennai') || query.toLowerCase().includes('tamil nadu')
        ? query
        : `${query}, Avadi, Chennai, Tamil Nadu`;

      const response = await fetch(
        `/api/maps/geocode?address=${encodeURIComponent(fullQuery)}`
      );
      const data = await response.json();

      if (data?.status === 'OVER_QUERY_LIMIT' || data?.error?.status === 'RESOURCE_EXHAUSTED' || response.status === 429) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        setSearchError('Google Maps search quota reached. Please navigate or click on the map directly.');
        return;
      }

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        const newCoords = { lat: loc.lat, lng: loc.lng };
        setMapCenter(newCoords);
        setMapZoom(16);
      } else {
        setSearchError('Location not found. Try entering an area like "Avadi Market" or pan directly on the map.');
      }
    } catch (err: any) {
      setSearchError('Search request error. Please drag and click directly on the map.');
    } finally {
      setIsSearching(false);
    }
  };

  // Admin detects their current device GPS to center map
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMapCenter({ lat, lng });
        setSelectedCoords({ lat, lng });
        setMapZoom(17);
        if (!pointName) {
          setPointName('Current GPS Location');
        }
      },
      (err) => {
        setSearchError('Could not detect GPS location. Please click on the map.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (mapInstance) {
      const current = mapInstance.getZoom() || mapZoom;
      mapInstance.setZoom(Math.min(21, current + 1));
      setMapZoom(Math.min(21, current + 1));
    }
  };

  const handleZoomOut = () => {
    if (mapInstance) {
      const current = mapInstance.getZoom() || mapZoom;
      mapInstance.setZoom(Math.max(4, current - 1));
      setMapZoom(Math.max(4, current - 1));
    }
  };

  const handleConfirm = () => {
    if (!selectedCoords) {
      setSearchError('Please click on the Google Map to place the student boarding point marker.');
      return;
    }
    const finalName = pointName.trim() || `Stop (${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lng.toFixed(4)})`;
    onSelectLocation({
      name: finalName,
      lat: selectedCoords.lat,
      lng: selectedCoords.lng,
    });
  };

  return (
    <div className="flex flex-col h-full space-y-3 font-sans">
      {/* Top Banner / Guidance */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-start justify-between text-xs">
        <div className="flex items-start space-x-2">
          <div className="p-1.5 rounded-lg bg-purple-700 text-white shrink-0 mt-0.5 shadow-xs">
            <Crosshair className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="font-extrabold text-purple-950">
              Set Official Boarding Point on Google Maps
            </div>
            <p className="text-[11px] text-purple-800 mt-0.5">
              Click anywhere directly on the map to set the student&apos;s designated pickup stop.
              The student will not be able to alter this official boarding location.
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Bar & Quick Preset Chips */}
      <div className="space-y-2">
        <form onSubmit={handleSearch} className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, landmark, or stop (e.g. Avadi Market, IAF Gate)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isSearching ? 'Searching...' : 'Go to Area'}
          </button>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            title="Center on my current GPS location"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition cursor-pointer shrink-0"
          >
            <LocateFixed className="h-4 w-4 text-purple-700" />
          </button>
        </form>

        {searchError && (
          <p className="text-[11px] text-rose-600 font-semibold">{searchError}</p>
        )}

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Quick Areas:
          </span>
          {QUICK_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                setMapCenter({ lat: p.lat, lng: p.lng });
                setMapZoom(16);
              }}
              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 text-[10.5px] font-medium border border-slate-200 transition cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* The Google Map Container */}
      <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border-2 border-purple-200 shadow-inner bg-slate-900">
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          solutionChannel="GMP_visgl_reactgooglemaps_v1.0.0"
          libraries={['marker', 'routes', 'geometry', 'places']}
        >
          {/* Floating Instructions HUD */}
          <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-white text-[11px] font-medium shadow-md flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Tap anywhere to place or move boarding marker</span>
            </div>
          </div>

          {/* Floating Zoom & Recenter Controls */}
          <div className="absolute right-2.5 bottom-2.5 z-20 flex flex-col space-y-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={handleZoomIn}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-800 shadow-lg border border-slate-200 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4 font-bold" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-800 shadow-lg border border-slate-200 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4 font-bold" />
            </button>
            {selectedCoords && (
              <button
                type="button"
                onClick={() => setMapCenter(selectedCoords)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-700 text-white shadow-lg border border-purple-800 hover:bg-purple-800 active:scale-95 transition cursor-pointer"
                title="Recenter on Selected Pin"
              >
                <MapPin className="h-4 w-4" />
              </button>
            )}
          </div>

          <Map
            mapId={GOOGLE_MAPS_MAP_ID}
            defaultCenter={mapCenter}
            defaultZoom={mapZoom}
            gestureHandling="greedy"
            disableDefaultUI={false}
            scrollwheel={true}
            onClick={handleMapClick}
            style={{ width: '100%', height: '100%' }}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          >
            <MapController targetCenter={mapCenter} zoomLevel={mapZoom} onMapReady={setMapInstance} />

            {/* College Destination Marker (Reference) */}
            <AdvancedMarker
              position={{
                lat: COLLEGE_DESTINATION.latitude,
                lng: COLLEGE_DESTINATION.longitude,
              }}
            >
              <div className="relative flex flex-col items-center">
                <div className="px-2 py-0.5 bg-indigo-950 text-amber-300 text-[9px] font-black rounded-full shadow-md border border-amber-300 whitespace-nowrap -mb-1 z-10">
                  🏛️ CAMPUS
                </div>
                <div className="flex items-center justify-center w-8 h-8 bg-indigo-900 text-amber-300 rounded-xl shadow-lg border-2 border-white ring-2 ring-indigo-400">
                  <span className="text-sm">🏫</span>
                </div>
              </div>
            </AdvancedMarker>

            {/* Selected Official Boarding Location Marker */}
            {selectedCoords && typeof selectedCoords.lat === 'number' && typeof selectedCoords.lng === 'number' && !isNaN(selectedCoords.lat) && !isNaN(selectedCoords.lng) && (
              <AdvancedMarker position={{ lat: selectedCoords.lat, lng: selectedCoords.lng }}>
                <div className="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
                  <div className="px-2.5 py-0.5 bg-purple-900 text-white text-[9.5px] font-black rounded-full shadow-xl border border-purple-300 whitespace-nowrap -mb-1 z-20 uppercase tracking-tight flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                    <span>OFFICIAL BOARDING STOP</span>
                  </div>
                  <div className="relative flex items-center justify-center w-11 h-11 bg-gradient-to-tr from-purple-700 to-indigo-600 text-white rounded-full shadow-2xl border-2 border-white ring-4 ring-purple-400/80 animate-bounce">
                    <MapPin className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                  <div className="w-3.5 h-1.5 bg-purple-950/80 rounded-full blur-[1px] mt-0.5"></div>
                </div>
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Boarding Point Name & Coordinates Confirmation Card */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-800 mb-1">
            Official Boarding Point Name *
          </label>
          <input
            type="text"
            required
            value={pointName}
            onChange={(e) => setPointName(e.target.value)}
            placeholder="e.g. Avadi Market Bus Shelter, IAF Gate Junction..."
            className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
          />
        </div>

        {/* Selected Coordinates Status Pill */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center space-x-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                selectedCoords ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-semibold text-slate-700">
              {selectedCoords
                ? `GPS Coordinates: ${selectedCoords.lat.toFixed(6)}, ${selectedCoords.lng.toFixed(6)}`
                : 'No point selected yet. Click the map above.'}
            </span>
          </div>

          {selectedCoords && (
            <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md self-start sm:self-auto">
              ✓ Location Locked
            </span>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedCoords}
            className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Save Official Boarding Point</span>
          </button>
        </div>
      </div>
    </div>
  );
};
