// Source: Google Maps Platform Code Assist
import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary,
  ControlPosition,
  MapControl,
} from '@vis.gl/react-google-maps';
import {
  Navigation,
  MapPin,
  LocateFixed,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Radio,
  Clock,
  Milestone,
  Compass,
  Phone,
  Layers,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  User,
  ArrowLeft,
} from 'lucide-react';
import { COLLEGE_DESTINATION } from '../types/index.ts';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  'AIzaSyCtXeSO-M21CyGRIDiz0kA1g23Ae2C5XQQ';

const GOOGLE_MAPS_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
  'bf51a910020fa25a';

export interface MapMarkerPoint {
  id: string;
  lat: number;
  lng: number;
  type:
    | 'BUS'
    | 'EMERGENCY_BUS'
    | 'USER'
    | 'BOARDING_POINT'
    | 'STUDENT_WAITING'
    | 'STUDENT_ABSENT'
    | 'STUDENT_BOARDED'
    | 'DESTINATION';
  title: string;
  subtitle?: string;
  sequence?: number;
  accuracy?: number | null;
  timestamp?: string | null;
  studentName?: string;
  statusText?: string;
  phone?: string | null;
  phoneLabel?: string;
}

interface MapViewerProps {
  markers: MapMarkerPoint[];
  centerLat?: number | null;
  centerLng?: number | null;
  zoom?: number;
  heightClass?: string;
  emptyStateMessage?: string;
  routePath?: Array<{ lat: number; lng: number } | [number, number]>;
  plannedRoutePath?: Array<{ lat: number; lng: number } | [number, number]>;
  orderedIntermediateStops?: Array<{ lat: number; lng: number }>;
  destinationName?: string;
  destinationAddress?: string;
  activeBusNumber?: string;
  isTripActive?: boolean;
  viewMode?: 'DRIVER' | 'STUDENT' | 'ADMIN';
  isFullScreen?: boolean;
  onBackToDashboard?: () => void;
}

// Reusable DirectionsRenderer React component
export interface DirectionsRendererProps {
  options: google.maps.DirectionsRendererOptions;
}

export const DirectionsRenderer: React.FC<DirectionsRendererProps> = ({ options }) => {
  const map = useMap();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps || !google.maps.DirectionsRenderer) return;

    const renderer = new google.maps.DirectionsRenderer({
      map,
      ...options,
    });
    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!directionsRenderer || !options) return;
    directionsRenderer.setOptions({
      map,
      ...options,
    });
  }, [directionsRenderer, options, map]);

  return null;
};

// Internal Navigation Route & Camera Controller Component
interface MapRouteManagerProps {
  busPoint: { lat: number; lng: number } | null;
  userPoint: { lat: number; lng: number } | null;
  destinationPoint: { lat: number; lng: number };
  intermediateStops: Array<{ lat: number; lng: number }>;
  followTarget: boolean;
  viewMode: 'DRIVER' | 'STUDENT' | 'ADMIN';
  onMetricsUpdate: (distanceKm: number, etaMinutes: number) => void;
  centerOverride?: { lat: number; lng: number } | null;
}

let gDirectionsQuotaExceeded = false;

const MapRouteManager: React.FC<MapRouteManagerProps> = ({
  busPoint,
  userPoint,
  destinationPoint,
  intermediateStops,
  followTarget,
  viewMode,
  onMetricsUpdate,
  centerOverride,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const lastFetchedKeyRef = useRef<string>('');

  // Build the ordered sequence of stops
  const stops = useMemo(() => {
    const list: Array<{ lat: number; lng: number }> = [];
    const startPoint = busPoint || userPoint;
    if (startPoint) list.push(startPoint);
    if (viewMode === 'STUDENT' && busPoint && userPoint) {
      list.push(userPoint);
    } else if (viewMode === 'DRIVER' && intermediateStops.length > 0) {
      list.push(...intermediateStops.slice(0, 10));
    }
    list.push(destinationPoint);
    return list;
  }, [busPoint, userPoint, destinationPoint, intermediateStops, viewMode]);

  // Direct Haversine calculation for metric estimation
  const calcDistKm = (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
    const R = 6371;
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Compute navigation route using DirectionsService and DirectionsRenderer (with Routes API fallback)
  useEffect(() => {
    if (!map) return;

    // Clean up previous polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (stops.length < 2) {
      onMetricsUpdate(0, 0);
      setDirectionsResponse(null);
      return;
    }

    const stopsKey = stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join('|');
    if (lastFetchedKeyRef.current === stopsKey && directionsResponse) {
      return;
    }

    // If quota was already exhausted, draw the fallback route immediately without spamming network
    if (gDirectionsQuotaExceeded) {
      drawFallbackPolyline();
      return;
    }

    // Step 1: Initialize the Directions Service
    // In src/components/MapViewer.tsx, instantiate google.maps.DirectionsService once the Google Maps script loads:
    let directionsService: google.maps.DirectionsService | null = null;
    if (typeof google !== 'undefined' && google.maps && google.maps.DirectionsService) {
      try {
        directionsService = new google.maps.DirectionsService();
      } catch (err) {
        console.warn('Notice instantiating DirectionsService:', err);
      }
    }

    // Step 2: Format Origin, Destination, and Waypoints
    // Break your list of stops into an origin (first stop), a destination (last stop), and intermediate waypoints:
    const origin = { lat: stops[0].lat, lng: stops[0].lng };
    const destination = { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng };

    const waypoints = stops.slice(1, -1).map((stop) => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true,
    }));

    // Step 3: Fetch the Driving Route
    // Call directionsService.route() with DRIVING travel mode to calculate the street path:
    if (directionsService) {
      directionsService.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            lastFetchedKeyRef.current = stopsKey;
            // Store result in component state
            setDirectionsResponse(result);

            // Calculate metrics from route legs
            const legs = result.routes[0]?.legs;
            if (legs && legs.length > 0) {
              const totalDistMeters = legs.reduce((acc, curr) => acc + (curr.distance?.value || 0), 0);
              const totalDurationSecs = legs.reduce((acc, curr) => acc + (curr.duration?.value || 0), 0);
              onMetricsUpdate(
                Math.round(totalDistMeters / 100) / 10,
                Math.max(1, Math.round(totalDurationSecs / 60))
              );
            }
          } else {
            if (
              status === google.maps.DirectionsStatus.OVER_QUERY_LIMIT ||
              (status as string) === 'OVER_QUERY_LIMIT'
            ) {
              gDirectionsQuotaExceeded = true;
              window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
              console.warn(
                'Google Maps Directions Service daily request quota reached (OVER_QUERY_LIMIT). Using fallback route polyline.'
              );
            } else {
              console.warn('Directions request notice:', status);
            }
            // Fallback immediately to drawn polyline
            drawFallbackPolyline();
          }
        }
      );
    } else {
      drawFallbackPolyline();
    }

    function fallbackComputeRoutes() {
      if (routesLib && (routesLib as any).Route) {
        try {
          const request: any = {
            origin,
            destination,
            travelMode: 'DRIVING',
            fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
          };
          if (waypoints.length > 0) {
            request.intermediates = waypoints.map((w) => ({
              latLng: { latitude: w.location.lat, longitude: w.location.lng },
            }));
          }

          (routesLib as any).Route.computeRoutes(request)
            .then(({ routes }: { routes: any[] }) => {
              if (!routes || routes.length === 0) {
                drawFallbackPolyline();
                return;
              }

              const primaryRoute = routes[0];
              if (typeof primaryRoute.createPolylines === 'function') {
                const newPolylines = primaryRoute.createPolylines();
                newPolylines.forEach((poly: google.maps.Polyline) => {
                  poly.setOptions({
                    strokeColor: '#2563EB',
                    strokeWeight: 6,
                    strokeOpacity: 0.95,
                    zIndex: 10,
                  });
                  poly.setMap(map);
                });
                polylinesRef.current = newPolylines;
              } else {
                drawFallbackPolyline();
              }

              const distKm = Math.round((primaryRoute.distanceMeters || 0) / 100) / 10;
              const etaMins = Math.max(1, Math.round((primaryRoute.durationMillis || 0) / 60000));
              onMetricsUpdate(distKm, etaMins);
            })
            .catch((err: any) => {
              const errStr = String(err?.message || err || '');
              if (
                errStr.includes('RESOURCE_EXHAUSTED') ||
                errStr.includes('429') ||
                errStr.includes('OVER_QUERY_LIMIT')
              ) {
                gDirectionsQuotaExceeded = true;
                window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
              }
              drawFallbackPolyline();
            });
        } catch {
          drawFallbackPolyline();
        }
      } else {
        drawFallbackPolyline();
      }
    }

    function drawFallbackPolyline() {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];

      // Query OSRM to snap fallback polyline to physical streets
      fetchOSRMRoute(stops).then((roadCoords) => {
        if (roadCoords && roadCoords.length > 1) {
          const path = roadCoords.map(([lat, lng]) => ({ lat, lng }));
          polylinesRef.current.forEach((p) => p.setMap(null));

          const casing = new google.maps.Polyline({
            path,
            strokeColor: '#1E3A8A',
            strokeWeight: 8,
            strokeOpacity: 0.6,
            zIndex: 5,
            map,
          });
          const nav = new google.maps.Polyline({
            path,
            strokeColor: '#2563EB',
            strokeWeight: 5.5,
            strokeOpacity: 0.95,
            zIndex: 6,
            map,
          });
          polylinesRef.current = [casing, nav];
        }
      });

      const casingLine = new google.maps.Polyline({
        path: stops,
        strokeColor: '#1E3A8A',
        strokeWeight: 8,
        strokeOpacity: 0.6,
        zIndex: 5,
        map,
      });

      const navLine = new google.maps.Polyline({
        path: stops,
        strokeColor: '#2563EB',
        strokeWeight: 5.5,
        strokeOpacity: 0.95,
        zIndex: 6,
        map,
      });

      polylinesRef.current = [casingLine, navLine];

      let totalDist = 0;
      for (let i = 0; i < stops.length - 1; i++) {
        totalDist += calcDistKm(stops[i], stops[i + 1]);
      }
      const distKm = Math.round(totalDist * 10) / 10;
      const etaMins = Math.max(1, Math.round((distKm / 28) * 60));
      onMetricsUpdate(distKm, etaMins);
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, stops]);

  // Handle camera panning
  const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!map) return;

    if (centerOverride) {
      // Only pan if the requested center target coordinate genuinely changed
      if (
        !lastCenterRef.current ||
        Math.abs(lastCenterRef.current.lat - centerOverride.lat) > 0.0001 ||
        Math.abs(lastCenterRef.current.lng - centerOverride.lng) > 0.0001
      ) {
        lastCenterRef.current = centerOverride;
        map.panTo(centerOverride);
      }
      return;
    }

    if (followTarget && busPoint) {
      // Only pan if bus moved significantly to prevent stuttering/fighting zoom
      if (
        !lastCenterRef.current ||
        Math.abs(lastCenterRef.current.lat - busPoint.lat) > 0.0008 ||
        Math.abs(lastCenterRef.current.lng - busPoint.lng) > 0.0008
      ) {
        lastCenterRef.current = busPoint;
        map.panTo(busPoint);
      }
    }
  }, [map, busPoint?.lat, busPoint?.lng, followTarget, centerOverride?.lat, centerOverride?.lng]);

  return (
    <>
      {directionsResponse && (
        <DirectionsRenderer
          options={{
            directions: directionsResponse,
            suppressMarkers: false, // Set to true if you use custom bus stop markers
            polylineOptions: {
              strokeColor: '#2563eb', // Blue path
              strokeWeight: 5,
            },
          }}
        />
      )}
    </>
  );
};

// Interactive Map Zoom & View Controls inside APIProvider
interface MapControlsProps {
  followBus: boolean;
  onToggleFollowBus: () => void;
  mapTypeId: 'roadmap' | 'satellite' | 'hybrid';
  onToggleMapType: () => void;
  onUserInteracted: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({
  followBus,
  onToggleFollowBus,
  mapTypeId,
  onToggleMapType,
  onUserInteracted,
}) => {
  const map = useMap();

  const handleZoomIn = () => {
    if (!map) return;
    onUserInteracted();
    const current = map.getZoom() || 14;
    map.setZoom(Math.min(21, current + 1));
  };

  const handleZoomOut = () => {
    if (!map) return;
    onUserInteracted();
    const current = map.getZoom() || 14;
    map.setZoom(Math.max(3, current - 1));
  };

  return (
    <div className="m-3 flex flex-col space-y-2 pointer-events-auto">
      {/* Zoom In Button */}
      <button
        type="button"
        onClick={handleZoomIn}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
        title="Zoom In (+)"
      >
        <ZoomIn className="h-5 w-5" />
      </button>

      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={handleZoomOut}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 text-slate-800 shadow-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition cursor-pointer"
        title="Zoom Out (-)"
      >
        <ZoomOut className="h-5 w-5" />
      </button>

      {/* Recenter / Follow Bus Button */}
      <button
        type="button"
        onClick={onToggleFollowBus}
        className={`flex h-10 w-10 items-center justify-center rounded-2xl shadow-xl transition-all border cursor-pointer active:scale-95 ${
          followBus
            ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-300 shadow-blue-500/40'
            : 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
        title={followBus ? 'Following Bus Location (Tap to unlock)' : 'Recenter on Bus'}
      >
        <LocateFixed className="h-5 w-5" />
      </button>

      {/* Map Layer Switcher (Roadmap / Satellite) */}
      <button
        type="button"
        onClick={onToggleMapType}
        className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/95 text-slate-700 shadow-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer active:scale-95"
        title="Toggle Map / Satellite"
      >
        <Layers className="h-4 w-4 text-purple-700" />
      </button>
    </div>
  );
};

// Cache OSRM route results by stops string to prevent redundant network calls
const osrmCache: Record<string, [number, number][]> = {};

/**
 * Fetch road path geometry from OSRM driving service.
 * Snaps route coordinates directly onto physical roads.
 */
export async function fetchOSRMRoute(
  stops: Array<{ lat: number; lng: number }>
): Promise<[number, number][] | null> {
  if (!stops || stops.length < 2) return null;

  // Format coordinates as "lng,lat;lng,lat;..."
  const coordinatesString = stops
    .map((stop) => `${stop.lng},${stop.lat}`)
    .join(';');

  if (osrmCache[coordinatesString]) {
    return osrmCache[coordinatesString];
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // Extract array of [lat, lng] points along physical roads
      const roadCoordinates: [number, number][] = data.routes[0].geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]] as [number, number] // Swap [lng, lat] to [lat, lng]
      );
      osrmCache[coordinatesString] = roadCoordinates;
      return roadCoordinates;
    }
  } catch (error) {
    console.error('OSRM Routing error:', error);
  }
  return null;
}

const LeafletFallbackViewer: React.FC<{
  markers: MapMarkerPoint[];
  center: { lat: number; lng: number };
  zoom: number;
  routePath?: Array<{ lat: number; lng: number } | [number, number]>;
  onRetryGoogleMaps?: () => void;
}> = ({ markers, center, zoom, routePath, onRetryGoogleMaps }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const [roadCoordinates, setRoadCoordinates] = useState<[number, number][] | null>(null);

  // Build ordered sequence of stops
  const routeStops = useMemo(() => {
    if (routePath && routePath.length >= 2) {
      return routePath.map((pt) =>
        Array.isArray(pt) ? { lat: pt[0], lng: pt[1] } : { lat: pt.lat, lng: pt.lng }
      );
    }
    const stopsList: Array<{ lat: number; lng: number }> = [];
    const bus = markers.find((m) => m.type === 'BUS' || m.type === 'EMERGENCY_BUS');
    const user = markers.find((m) => m.type === 'USER');
    const dest = markers.find((m) => m.type === 'DESTINATION');
    const boardingPoints = markers.filter((m) => m.type === 'BOARDING_POINT');

    const start = bus || user;
    if (start) stopsList.push({ lat: start.lat, lng: start.lng });
    boardingPoints.forEach((bp) => stopsList.push({ lat: bp.lat, lng: bp.lng }));
    if (dest) {
      stopsList.push({ lat: dest.lat, lng: dest.lng });
    } else {
      stopsList.push({ lat: COLLEGE_DESTINATION.latitude, lng: COLLEGE_DESTINATION.longitude });
    }
    return stopsList;
  }, [markers, routePath]);

  // Fetch road path geometry from OSRM so route snaps directly onto physical roads
  useEffect(() => {
    let active = true;
    if (routeStops.length >= 2) {
      fetchOSRMRoute(routeStops).then((coords) => {
        if (active && coords && coords.length > 0) {
          setRoadCoordinates(coords);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [routeStops]);

  // Initialize Map Instance Exactly Once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = L.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom || 13,
        zoomControl: true,
        zoomAnimation: false, // Prevents _leaflet_pos animation race conditions
        fadeAnimation: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layersRef.current = layerGroup;
      mapRef.current = map;
    } catch (e) {
      console.warn('Leaflet map init notice:', e);
    }

    return () => {
      if (mapRef.current) {
        try {
          mapRef.current.stop();
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
        layersRef.current = null;
      }
    };
  }, []);

  // Update Markers and Polyline without destroying or recreating map
  useEffect(() => {
    if (!mapRef.current || !layersRef.current) return;

    try {
      layersRef.current.clearLayers();

      markers.forEach((m) => {
        const isBus = m.type === 'BUS' || m.type === 'EMERGENCY_BUS';
        const isDest = m.type === 'DESTINATION';
        const isStop = m.type === 'BOARDING_POINT';

        const emoji = isBus ? '🚌' : isDest ? '🏛️' : isStop ? '📍' : '🧍';
        const bg = isBus ? '#7c3aed' : isDest ? '#ea580c' : isStop ? '#2563eb' : '#059669';

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background:${bg};color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);border:2px solid white;font-size:16px;">${emoji}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([m.lat, m.lng], { icon: customIcon });
        marker.bindPopup(
          `<b>${m.title}</b>${m.subtitle ? `<br/><span style="font-size:12px;color:#64748b;">${m.subtitle}</span>` : ''}`
        );
        layersRef.current?.addLayer(marker);
      });

      // Snapped road coordinates from OSRM, or fallback straight coordinates
      const coordsToRender: [number, number][] =
        roadCoordinates && roadCoordinates.length > 1
          ? roadCoordinates
          : routeStops.map((s) => [s.lat, s.lng] as [number, number]);

      if (coordsToRender.length > 1) {
        const poly = L.polyline(coordsToRender, {
          color: '#2563eb', // Clean blue path
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round',
        });
        layersRef.current?.addLayer(poly);
      }
    } catch (e) {
      console.warn('Leaflet layer update notice:', e);
    }
  }, [markers, routeStops, roadCoordinates]);

  // Update Center if changed significantly without animated zoom race
  const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    if (
      !lastCenterRef.current ||
      Math.abs(lastCenterRef.current.lat - center.lat) > 0.001 ||
      Math.abs(lastCenterRef.current.lng - center.lng) > 0.001
    ) {
      lastCenterRef.current = center;
      try {
        mapRef.current.panTo([center.lat, center.lng], { animate: false });
      } catch {}
    }
  }, [center.lat, center.lng]);

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-900">
      <div ref={containerRef} className="w-full h-full min-h-[380px]" />
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-700 text-xs text-white shadow-xl flex items-center space-x-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-slate-200">OpenStreetMap Live Tracking</span>
        {onRetryGoogleMaps && (
          <button
            type="button"
            onClick={onRetryGoogleMaps}
            className="ml-2 px-2.5 py-1 rounded-xl bg-purple-700 hover:bg-purple-800 text-[11px] font-bold text-white transition cursor-pointer"
          >
            Retry Google Maps
          </button>
        )}
      </div>
    </div>
  );
};

export const MapViewer: React.FC<MapViewerProps> = ({
  markers,
  centerLat,
  centerLng,
  zoom = 13,
  heightClass = 'h-[440px]',
  emptyStateMessage = 'Live GPS navigation will activate when the driver starts their mobile trip.',
  destinationName = COLLEGE_DESTINATION.name,
  destinationAddress = COLLEGE_DESTINATION.address,
  activeBusNumber,
  isTripActive = false,
  viewMode: propViewMode,
  isFullScreen = false,
  onBackToDashboard,
  orderedIntermediateStops,
  routePath,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerPoint | null>(null);
  const [followBus, setFollowBus] = useState<boolean>(true);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [navMetrics, setNavMetrics] = useState<{
    distanceKm: number | null;
    etaMinutes: number | null;
  }>({ distanceKm: null, etaMinutes: null });

  // Auto-detect viewMode if not explicitly passed
  const viewMode = useMemo<'DRIVER' | 'STUDENT' | 'ADMIN'>(() => {
    if (propViewMode) return propViewMode;
    const hasWaitingStudents = markers.some(
      (m) => m.type === 'STUDENT_WAITING' || m.type === 'STUDENT_ABSENT'
    );
    if (hasWaitingStudents) return 'DRIVER';
    const isStudentUser = markers.some((m) => m.type === 'USER');
    if (isStudentUser) return 'STUDENT';
    return 'ADMIN';
  }, [propViewMode, markers]);

  // Filter markers strictly based on requirement 5:
  // "IN student side the map should be like bus location and its route and student point theirs and destination .........remove other things from the map and map it simple like gmap"
  const visibleMarkers = useMemo(() => {
    const valid = markers.filter(
      (m) =>
        typeof m.lat === 'number' &&
        typeof m.lng === 'number' &&
        !isNaN(m.lat) &&
        !isNaN(m.lng) &&
        isFinite(m.lat) &&
        isFinite(m.lng)
    );

    // Deduplicate markers by ID to guarantee unique keys across rendering
    const seenIds = new Set<string>();
    const deduplicated: MapMarkerPoint[] = [];
    for (const m of valid) {
      const key = m.id || `${m.type}-${m.lat}-${m.lng}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        deduplicated.push(m);
      }
    }

    if (viewMode === 'STUDENT') {
      // Show Bus, Student's own point (USER, STUDENT_WAITING, STUDENT_ABSENT, STUDENT_BOARDED), Official Boarding Point, and Destination
      return deduplicated.filter(
        (m) =>
          m.type === 'BUS' ||
          m.type === 'EMERGENCY_BUS' ||
          m.type === 'USER' ||
          m.type === 'STUDENT_WAITING' ||
          m.type === 'STUDENT_ABSENT' ||
          m.type === 'STUDENT_BOARDED' ||
          m.type === 'BOARDING_POINT' ||
          m.type === 'DESTINATION'
      );
    }

    return deduplicated;
  }, [markers, viewMode]);

  const busMarker = visibleMarkers.find((m) => m.type === 'BUS' || m.type === 'EMERGENCY_BUS');
  const userMarker = visibleMarkers.find(
    (m) =>
      m.type === 'USER' ||
      m.type === 'STUDENT_WAITING' ||
      m.type === 'STUDENT_ABSENT' ||
      m.type === 'STUDENT_BOARDED' ||
      m.type === 'BOARDING_POINT'
  );

  // Destination point: Aalim Muhammed Salegh College of Engineering
  const destinationPoint = useMemo(() => {
    return {
      lat: COLLEGE_DESTINATION.latitude,
      lng: COLLEGE_DESTINATION.longitude,
    };
  }, []);

  // Intermediate ordered stops for driver route planning (PART 1 & PART 3: Bus-Specific Route in Sequence)
  const intermediateStops = useMemo(() => {
    if (viewMode !== 'DRIVER') return [];
    if (orderedIntermediateStops && orderedIntermediateStops.length > 0) {
      return orderedIntermediateStops;
    }
    const bpMarkers = visibleMarkers.filter((m) => m.type === 'BOARDING_POINT');
    if (bpMarkers.length > 0) {
      return bpMarkers.map((m) => ({ lat: m.lat, lng: m.lng }));
    }
    return visibleMarkers
      .filter((m) => m.type === 'STUDENT_WAITING')
      .map((m) => ({ lat: m.lat, lng: m.lng }));
  }, [visibleMarkers, viewMode, orderedIntermediateStops]);

  const waitingCount = useMemo(
    () => visibleMarkers.filter((m) => m.type === 'STUDENT_WAITING').length,
    [visibleMarkers]
  );
  const absentCount = useMemo(
    () => visibleMarkers.filter((m) => m.type === 'STUDENT_ABSENT').length,
    [visibleMarkers]
  );

  const defaultCenter = useMemo(() => {
    if (typeof centerLat === 'number' && typeof centerLng === 'number' && !isNaN(centerLat) && !isNaN(centerLng)) {
      return { lat: centerLat, lng: centerLng };
    }
    if (busMarker) {
      return { lat: busMarker.lat, lng: busMarker.lng };
    }
    if (userMarker) {
      return { lat: userMarker.lat, lng: userMarker.lng };
    }
    return { lat: 13.1147, lng: 80.1018 }; // Avadi central coordinates
  }, [centerLat, centerLng, busMarker?.lat, busMarker?.lng, userMarker?.lat, userMarker?.lng]);

  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const handleMetricsUpdate = (distKm: number, etaMins: number) => {
    setNavMetrics({ distanceKm: distKm, etaMinutes: etaMins });
  };

  if (quotaExceeded) {
    return (
      <div
        className={`relative w-full ${
          isFullScreen
            ? 'h-full min-h-[500px] rounded-none border-0 shadow-none'
            : `${heightClass} min-h-[380px] rounded-3xl border border-slate-200 shadow-xl`
        } overflow-hidden bg-slate-950 font-sans selection:bg-purple-200`}
      >
        <LeafletFallbackViewer
          markers={visibleMarkers}
          center={defaultCenter}
          zoom={zoom}
          routePath={routePath}
          onRetryGoogleMaps={() => {
            gDirectionsQuotaExceeded = false;
            setQuotaExceeded(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${
        isFullScreen
          ? 'h-full min-h-[500px] rounded-none border-0 shadow-none'
          : `${heightClass} min-h-[380px] rounded-3xl border border-slate-200 shadow-xl`
      } overflow-hidden bg-slate-950 font-sans selection:bg-purple-200`}
    >
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY}
        solutionChannel="GMP_visgl_reactgooglemaps_v1.0.0"
        libraries={['marker', 'routes', 'geometry', 'places']}
      >
        {/* The Google Map Container */}
        <Map
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={defaultCenter}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          scrollwheel={true}
          onDragstart={() => setFollowBus(false)}
          onZoomChanged={() => setFollowBus(false)}
          mapTypeId={mapTypeId}
          style={{ width: '100%', height: '100%', minHeight: '380px' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {/* Custom On-Map Zoom & Navigation Controls */}
          <MapControl position={ControlPosition.RIGHT_CENTER}>
            <MapControls
              followBus={followBus}
              onToggleFollowBus={() => setFollowBus((prev) => !prev)}
              mapTypeId={mapTypeId}
              onToggleMapType={() => setMapTypeId((prev) => (prev === 'roadmap' ? 'hybrid' : 'roadmap'))}
              onUserInteracted={() => setFollowBus(false)}
            />
          </MapControl>

          {/* Status Legend Bar (Bottom Floating via MapControl) */}
          <MapControl position={ControlPosition.LEFT_BOTTOM}>
            <div className="m-3 pointer-events-auto">
              <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-lg border border-slate-800 text-[10.5px] font-semibold text-slate-300">
                {/* Bus Indicator */}
                <div className="flex items-center space-x-1.5 text-purple-300">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-purple-300 animate-pulse"></span>
                  <span>Bus GPS</span>
                </div>

                {/* Destination Indicator */}
                <span className="text-slate-600">&bull;</span>
                <div className="flex items-center space-x-1 text-amber-300 font-bold">
                  <span>🏛️</span>
                  <span>Aalim M.S. Campus</span>
                </div>

                {/* Driver View shows Waiting & Absent; Student View shows My Stop */}
                {viewMode === 'DRIVER' ? (
                  <>
                    <span className="text-slate-600">&bull;</span>
                    <div className="flex items-center space-x-1 text-amber-400 font-bold">
                      <span>🟡</span>
                      <span>Waiting</span>
                    </div>
                    <span className="text-slate-600">&bull;</span>
                    <div className="flex items-center space-x-1 text-rose-400">
                      <span>🔴</span>
                      <span>Absent</span>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600">&bull;</span>
                    <div className="flex items-center space-x-1.5 text-blue-400 font-bold">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                      <span>My Stop</span>
                    </div>
                  </>
                )}

                <span className="text-slate-600">&bull;</span>
                <div className="flex items-center space-x-1.5 text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                  <span>Route Path</span>
                </div>
              </div>
            </div>
          </MapControl>

          {/* Active Navigation Polyline and Dynamic Viewport Manager */}
          <MapRouteManager
            busPoint={busMarker ? { lat: busMarker.lat, lng: busMarker.lng } : null}
            userPoint={userMarker ? { lat: userMarker.lat, lng: userMarker.lng } : null}
            destinationPoint={destinationPoint}
            intermediateStops={intermediateStops}
            followTarget={followBus}
            viewMode={viewMode}
            onMetricsUpdate={handleMetricsUpdate}
            centerOverride={
              centerLat && centerLng ? { lat: centerLat, lng: centerLng } : null
            }
          />

          {/* Destination Marker: Aalim Muhammed Salegh College of Engineering */}
          {destinationPoint && typeof destinationPoint.lat === 'number' && typeof destinationPoint.lng === 'number' && (
            <AdvancedMarker
              position={{ lat: destinationPoint.lat, lng: destinationPoint.lng }}
              onClick={() =>
                setSelectedMarker({
                  id: 'destination-marker',
                  lat: destinationPoint.lat,
                  lng: destinationPoint.lng,
                  type: 'DESTINATION',
                  title: COLLEGE_DESTINATION.name,
                  subtitle: COLLEGE_DESTINATION.address,
                })
              }
            >
              <div className="relative flex flex-col items-center cursor-pointer group hover:scale-105 transition-transform">
                <div className="px-2.5 py-1 bg-indigo-950 text-amber-300 text-[10px] font-black rounded-full shadow-2xl border-2 border-amber-400 whitespace-nowrap -mb-1 z-20 uppercase tracking-wide flex items-center space-x-1">
                  <span>🏛️</span>
                  <span>STOP #6: CAMPUS</span>
                </div>
                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-indigo-950 to-purple-900 text-amber-300 rounded-2xl shadow-2xl border-2 border-amber-300 ring-4 ring-indigo-500/40">
                  <span className="text-2xl">🏫</span>
                </div>
                <div className="w-4 h-1.5 bg-indigo-950/80 rounded-full blur-[1px] mt-0.5"></div>
              </div>
            </AdvancedMarker>
          )}

          {/* Render Filtered Visible Markers */}
          {visibleMarkers.map((m) => {
            if (m.type === 'DESTINATION') return null; // Rendered above
            if (typeof m.lat !== 'number' || typeof m.lng !== 'number' || isNaN(m.lat) || isNaN(m.lng)) return null;

            // 1. Bus Marker
            if (m.type === 'BUS' || m.type === 'EMERGENCY_BUS') {
              const isEmergency = m.type === 'EMERGENCY_BUS';
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => setSelectedMarker(m)}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
                    {/* Badge */}
                    <div
                      className={`absolute -top-7 px-2.5 py-0.5 text-[9.5px] font-black rounded-full shadow-xl whitespace-nowrap z-20 flex items-center space-x-1 ${
                        isEmergency
                          ? 'bg-red-700 text-white border border-white animate-pulse'
                          : 'bg-slate-900/95 text-white border border-purple-400'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                      <span>{m.title}</span>
                    </div>

                    {/* Puck icon */}
                    <div
                      className={`relative flex items-center justify-center w-12 h-12 text-white rounded-full shadow-2xl border-2 border-white ring-4 ${
                        isEmergency
                          ? 'bg-gradient-to-tr from-red-700 to-rose-600 ring-red-400 animate-ping'
                          : 'bg-gradient-to-tr from-purple-800 to-indigo-600 ring-purple-400/60'
                      }`}
                    >
                      <span className="text-xl">🚌</span>
                      <div className="absolute -inset-1.5 rounded-full border-2 border-purple-400 animate-ping opacity-50"></div>
                    </div>
                    <div className="w-3 h-1.5 bg-purple-950/80 rounded-full blur-[1px] mt-0.5"></div>
                  </div>
                </AdvancedMarker>
              );
            }

            // 2. Student Waiting Marker (🟡 Driver View)
            if (m.type === 'STUDENT_WAITING') {
              const name = m.studentName || m.title;
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => setSelectedMarker(m)}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
                    <div className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black rounded-full shadow-lg border border-amber-200 whitespace-nowrap -mb-1 z-20 uppercase tracking-tight flex items-center space-x-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping" />
                      <span>{name}</span>
                    </div>
                    <div className="flex items-center justify-center w-8 h-8 bg-amber-400 text-slate-950 rounded-full shadow-xl border-2 border-white ring-4 ring-amber-300/80 animate-bounce">
                      <span className="text-xs font-bold">🟡</span>
                    </div>
                    <div className="text-[8px] font-black px-1.5 py-0.2 bg-amber-950 text-amber-200 rounded-sm mt-0.5 shadow-xs">
                      WAITING
                    </div>
                  </div>
                </AdvancedMarker>
              );
            }

            // 3. Student Absent Marker (🔴 Driver View)
            if (m.type === 'STUDENT_ABSENT') {
              const name = m.studentName || m.title;
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => setSelectedMarker(m)}
                >
                  <div className="relative flex flex-col items-center cursor-pointer opacity-90 group hover:scale-105 transition-transform">
                    <div className="px-2 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded-full shadow-md border border-rose-300 whitespace-nowrap -mb-1 z-20 uppercase tracking-tight">
                      {name}
                    </div>
                    <div className="flex items-center justify-center w-7 h-7 bg-rose-600 text-white rounded-full shadow-lg border-2 border-white ring-2 ring-rose-300">
                      <span className="text-xs font-bold">🔴</span>
                    </div>
                    <div className="text-[8px] font-black px-1.5 py-0.2 bg-rose-950 text-rose-200 rounded-sm mt-0.5 shadow-xs">
                      ABSENT (SKIP)
                    </div>
                  </div>
                </AdvancedMarker>
              );
            }

            // 4. Student Boarded Marker (🟢 Driver View)
            if (m.type === 'STUDENT_BOARDED') {
              const name = m.studentName || m.title;
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => setSelectedMarker(m)}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group hover:scale-105 transition-transform">
                    <div className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full shadow-lg border border-emerald-300 whitespace-nowrap -mb-1 z-20 uppercase tracking-tight flex items-center space-x-1">
                      <span>✓</span>
                      <span>{name}</span>
                    </div>
                    <div className="flex items-center justify-center w-7 h-7 bg-emerald-600 text-white rounded-full shadow-lg border-2 border-white ring-3 ring-emerald-300">
                      <span className="text-xs font-bold">🟢</span>
                    </div>
                    <div className="text-[8px] font-black px-1.5 py-0.2 bg-emerald-950 text-emerald-200 rounded-sm mt-0.5 shadow-xs">
                      BOARDED
                    </div>
                  </div>
                </AdvancedMarker>
              );
            }

            // 5. User / Student Self Marker (🔵 Student View)
            if (m.type === 'USER') {
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => setSelectedMarker(m)}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
                    <div className="absolute -top-6 px-2 py-0.5 bg-blue-900 text-white text-[8.5px] font-black rounded-full shadow-lg border border-blue-400 whitespace-nowrap">
                      MY PICKUP LOCATION
                    </div>
                    <div className="relative flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full shadow-xl border-2 border-white ring-4 ring-blue-400/60">
                      <span className="h-3 w-3 rounded-full bg-white animate-pulse"></span>
                    </div>
                    <div className="w-2.5 h-1 bg-blue-950/70 rounded-full blur-[1px] mt-0.5"></div>
                  </div>
                </AdvancedMarker>
              );
            }

            // 6. Official Boarding Point Marker (📍 Boarding Stop)
            if (m.type === 'BOARDING_POINT') {
              return (
                <AdvancedMarker
                  key={m.id}
                  position={{ lat: m.lat, lng: m.lng }}
                  onClick={() => setSelectedMarker(m)}
                >
                  <div className="relative flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform">
                    <div className="px-2 py-0.5 bg-indigo-950 text-indigo-200 text-[8.5px] font-bold rounded-full shadow-lg border border-indigo-500/60 whitespace-nowrap -mb-1 z-20 flex items-center space-x-1">
                      {m.sequence ? (
                        <span className="bg-amber-400 text-slate-950 font-black px-1 rounded-sm text-[8px]">
                          #{m.sequence}
                        </span>
                      ) : null}
                      <span>{m.title}</span>
                    </div>
                    <div className="flex items-center justify-center w-7 h-7 bg-indigo-700 text-white rounded-full shadow-lg border-2 border-white ring-2 ring-indigo-400 font-black text-xs">
                      {m.sequence ? m.sequence : '📍'}
                    </div>
                    <div className="text-[7.5px] font-extrabold px-1 py-0.2 bg-slate-900 text-slate-300 rounded-sm mt-0.5 shadow-xs">
                      {m.sequence ? `STOP #${m.sequence}` : 'OFFICIAL STOP'}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            }

            return null;
          })}

          {/* InfoWindow for Selected Marker */}
          {selectedMarker && (
            <InfoWindow
              position={{ lat: selectedMarker.lat, lng: selectedMarker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1 min-w-[210px] max-w-[260px] text-xs font-sans text-slate-800">
                <div
                  className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-md inline-block mb-1.5 ${
                    selectedMarker.type === 'DESTINATION'
                      ? 'bg-indigo-950 text-amber-300'
                      : selectedMarker.type === 'BOARDING_POINT'
                      ? 'bg-purple-100 text-purple-950 border border-purple-200'
                      : selectedMarker.type === 'STUDENT_WAITING'
                      ? 'bg-amber-100 text-amber-900'
                      : selectedMarker.type === 'STUDENT_ABSENT'
                      ? 'bg-rose-100 text-rose-900'
                      : selectedMarker.type === 'STUDENT_BOARDED'
                      ? 'bg-emerald-100 text-emerald-900'
                      : selectedMarker.type === 'BUS'
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}
                >
                  {selectedMarker.type === 'DESTINATION'
                    ? '🏛️ STOP #6: CAMPUS'
                    : selectedMarker.type === 'BOARDING_POINT'
                    ? selectedMarker.sequence
                      ? `📍 STOP #${selectedMarker.sequence}: BOARDING POINT`
                      : '📍 OFFICIAL BOARDING STOP'
                    : selectedMarker.type === 'STUDENT_WAITING'
                    ? '🟡 WAITING AT STOP'
                    : selectedMarker.type === 'STUDENT_ABSENT'
                    ? '🔴 ABSENT (SKIP STOP)'
                    : selectedMarker.type === 'STUDENT_BOARDED'
                    ? '🟢 BOARDED'
                    : selectedMarker.type === 'BUS'
                    ? '🚌 LIVE COLLEGE BUS'
                    : '📍 MY LOCATION'}
                </div>
                <div className="font-extrabold text-sm text-slate-900">
                  {selectedMarker.studentName || selectedMarker.title}
                </div>
                {selectedMarker.subtitle && (
                  <div className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                    {selectedMarker.subtitle}
                  </div>
                )}
                <div className="text-[10px] font-mono text-slate-400 mt-2 pt-1 border-t border-slate-100">
                  📍 {selectedMarker.lat.toFixed(5)}, {selectedMarker.lng.toFixed(5)}
                </div>
                {selectedMarker.phone && (
                  <div className="mt-2 pt-1.5 border-t border-slate-100">
                    <a
                      href={`tel:${selectedMarker.phone}`}
                      className="inline-flex items-center justify-center space-x-1.5 w-full px-3 py-1.5 rounded-lg bg-purple-700 text-white font-bold text-xs hover:bg-purple-800 transition"
                    >
                      <Phone className="h-3 w-3" />
                      <span>Call: {selectedMarker.phone}</span>
                    </a>
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>

        {/* Empty State Standby Overlay */}
        {visibleMarkers.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center text-white backdrop-blur-xs">
            <div className="h-14 w-14 rounded-3xl bg-purple-700/40 text-purple-300 border border-purple-500/50 flex items-center justify-center mb-3 shadow-xl shadow-purple-500/20">
              <Navigation className="h-7 w-7 animate-pulse text-purple-300" />
            </div>
            <h4 className="font-black text-slate-100 text-base">Google Maps Navigation Standby</h4>
            <p className="max-w-sm text-xs text-slate-400 mt-1.5 leading-relaxed">
              {emptyStateMessage}
            </p>
          </div>
        )}
      </APIProvider>
    </div>
  );
};
