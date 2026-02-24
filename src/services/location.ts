import * as Location from 'expo-location';

interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface LocationSharingData {
  userId: string;
  userName: string;
  coordinates: LocationCoordinates;
  sharedWith: string[]; // Array of contact IDs/emails
  sharedAt: number;
  expiresAt?: number; // Optional expiration time
}

// ─── Google Maps API key (for fast reverse geocoding) ─────────────
// Replace with your own key from https://console.cloud.google.com
// Enable "Geocoding API" in the Google Cloud Console
const GOOGLE_MAPS_API_KEY = 'AIzaSyAg6z7fFTWTRvw6nbA99fvTJLZWiFxsRbo';

// (MOCK_LOCATION removed — callers now receive null when GPS is unavailable)

// ─── Address cache to avoid repeated geocoding ───────────────────
let _addressCache: {
  lat: number;
  lng: number;
  address: string;
  timestamp: number;
} | null = null;
const ADDRESS_CACHE_RADIUS = 0.0005; // ~55 m — reuse cached address if nearby
const ADDRESS_CACHE_TTL = 120_000;    // 2 minutes

const createPromiseWithTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(timeoutMessage)),
        timeoutMs
      )
    ),
  ]);
};

// ─── Helpers ──────────────────────────────────────────────────────
const toCoords = (loc: Location.LocationObject): LocationCoordinates => ({
  latitude: loc.coords.latitude,
  longitude: loc.coords.longitude,
  accuracy: loc.coords.accuracy || undefined,
  altitude: loc.coords.altitude || undefined,
  heading: loc.coords.heading || undefined,
  speed: loc.coords.speed || undefined,
  timestamp: loc.timestamp,
});

export const locationService = {
  // Request location permission
  requestLocationPermission: async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  },

  // Check if location permission is already granted
  checkLocationPermission: async (): Promise<boolean> => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  /**
   * Fast location fetch — prefers last-known (instant) then falls back
   * to a single balanced-accuracy GPS fix. No multi-step fallback chain.
   */
  getCurrentLocation: async (): Promise<LocationCoordinates | null> => {
    try {
      const hasPermission = await locationService.checkLocationPermission();
      if (!hasPermission) return null;

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) return null;

      // 1) Try cached / last-known position (instant)
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const age = Date.now() - last.timestamp;
          // Use it if < 60 seconds old
          if (age < 60_000) return toCoords(last);
        }
      } catch { /* ignore */ }

      // 2) Single balanced-accuracy fetch with 10 s timeout
      try {
        const loc = await createPromiseWithTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          10_000,
          'Location fetch timeout'
        );
        return toCoords(loc);
      } catch {
        // 3) Final fallback — return null so callers know location is unavailable
        //    (previously returned MOCK_LOCATION silently which is dangerous for a safety app)
        return null;
      }
    } catch {
      return null;
    }
  },

  // Watch location (for continuous tracking)
  watchLocation: async (
    callback: (location: LocationCoordinates) => void,
    errorCallback?: (error: Error) => void
  ): Promise<any> => {
    try {
      const hasPermission = await locationService.checkLocationPermission();
      if (!hasPermission) {
        errorCallback?.(new Error('Location permission not granted'));
        return null;
      }

      return await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,    // every 5 s
          distanceInterval: 15,  // or 15 m moved
        },
        (location: Location.LocationObject) => callback(toCoords(location)),
      );
    } catch (error) {
      errorCallback?.(error as Error);
      return null;
    }
  },

  // Stop watching location
  stopWatchingLocation: (subscription: any) => {
    if (subscription) subscription.remove();
  },

  /**
   * Fast reverse geocoding:
   * 1) Returns cached address if position hasn't moved much
   * 2) Tries Google Maps Geocoding API (fast, reliable) when key is set
   * 3) Falls back to free OpenStreetMap Nominatim API
   * 4) Last resort: expo-location native geocoder
   */
  getAddressFromCoordinates: async (
    latitude: number,
    longitude: number
  ): Promise<string | null> => {
    // — Cache hit? —
    if (
      _addressCache &&
      Math.abs(_addressCache.lat - latitude) < ADDRESS_CACHE_RADIUS &&
      Math.abs(_addressCache.lng - longitude) < ADDRESS_CACHE_RADIUS &&
      Date.now() - _addressCache.timestamp < ADDRESS_CACHE_TTL
    ) {
      return _addressCache.address;
    }

    const saveCache = (addr: string) => {
      _addressCache = { lat: latitude, lng: longitude, address: addr, timestamp: Date.now() };
      return addr;
    };

    // — 1) Google Maps Geocoding API (fastest, needs API key) —
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;
        const res = await createPromiseWithTimeout(fetch(url), 4000, 'Google geocode timeout');
        const data = await res.json();
        if (data.status === 'OK' && data.results?.length) {
          return saveCache(data.results[0].formatted_address);
        }
      } catch { /* fall through */ }
    }

    // — 2) OpenStreetMap Nominatim (free, no API key) —
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;
      const res = await createPromiseWithTimeout(
        fetch(url, { headers: { 'User-Agent': 'SafeConnect/1.0' } }),
        5000,
        'Nominatim timeout'
      );
      const data = await res.json();
      if (data.display_name) {
        // Trim overly long OSM addresses to something readable
        const parts = data.display_name.split(', ').slice(0, 4);
        return saveCache(parts.join(', '));
      }
    } catch { /* fall through */ }

    // — 3) Expo native geocoder (slowest fallback) —
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const a = results[0];
        const addr = [a.street, a.city, a.region, a.country]
          .filter((x): x is string => typeof x === 'string' && x.length > 0)
          .join(', ');
        if (addr) return saveCache(addr);
      }
    } catch { /* ignore */ }

    return null;
  },

  // Calculate distance between two coordinates (in km)
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  // Format location for display
  formatLocationForDisplay: (location: LocationCoordinates): string => {
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  },
};

export type { LocationCoordinates };

