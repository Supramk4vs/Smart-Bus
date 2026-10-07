/**
 * Geolocation & Distance Utilities
 *
 * Implements the standard Haversine formula to compute great-circle distances
 * between two latitude/longitude points on Earth. Used for GPS proximity checks
 * (<= 30 meters for QR verification) and arrival geofencing (<= 500 meters).
 */

// Earth's mean radius in meters
export const EARTH_RADIUS_METERS = 6371000;

// Security and Geofencing thresholds
export const QR_SCAN_PROXIMITY_MAX_METERS = 30; // Max allowed distance between student & bus for QR boarding
export const BUS_ARRIVAL_GEOFENCE_METERS = 500; // Geofence radius to trigger automated student arrival push

/**
 * Calculates the great-circle distance between two coordinates in meters using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in meters
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return Infinity;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distance in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2) / 1000;
}

/**
 * Formats distance into a human-friendly string (e.g. "24 m" or "1.4 km").
 */
export function formatDistance(meters: number): string {
  if (meters === Infinity || isNaN(meters)) return 'Unknown distance';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Estimates arrival time in minutes assuming suburban transit speed (~25 km/h)
 */
export function estimateArrivalMinutes(distanceMeters: number, speedKmH = 25): number {
  const distanceKm = distanceMeters / 1000;
  const hours = distanceKm / speedKmH;
  return Math.max(1, Math.round(hours * 60));
}
