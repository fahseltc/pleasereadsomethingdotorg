/**
 * "More nearby" helper for bookstore and library detail pages.
 *
 * Ranks other enabled stores by straight-line distance (haversine) from lat/lng
 * rather than by city name, because address city names are inconsistent
 * (Edgewater vs Denver) and distance is what a reader actually cares about.
 * New stores appear automatically on the next build.
 */
import { parseAddress } from './jsonld';

export interface NearbyInput {
  id: string;
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
}

export interface NearbyStore {
  id: string;
  name: string;
  city: string | null;
  miles: number;
}

const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** City parsed from a one-line address, or null if it can't be determined. */
export function cityOf(address: string): string | null {
  const city = parseAddress(address).addressLocality;
  return typeof city === 'string' && city ? city : null;
}

/**
 * Nearest other stores to `current`, closest first. Stores farther than
 * `maxMiles` are dropped so a lone store doesn't list something 200 miles away.
 * Callers pass only the stores that should be listed (e.g. enabled ones).
 */
export function nearbyStores(
  current: NearbyInput,
  all: NearbyInput[],
  { limit = 4, maxMiles = 30 }: { limit?: number; maxMiles?: number } = {},
): { city: string | null; stores: NearbyStore[]; allSameCity: boolean } {
  const city = cityOf(current.address);
  if (typeof current.lat !== 'number' || typeof current.lng !== 'number') {
    return { city, stores: [], allSameCity: false };
  }
  const { lat, lng } = current;
  const stores = all
    .filter((s) => s.id !== current.id && typeof s.lat === 'number' && typeof s.lng === 'number')
    .map((s) => ({
      id: s.id,
      name: s.name,
      city: cityOf(s.address),
      miles: haversineMiles(lat, lng, s.lat as number, s.lng as number),
    }))
    .filter((s) => s.miles <= maxMiles)
    .sort((a, b) => a.miles - b.miles)
    .slice(0, limit);
  const allSameCity = !!city && stores.length > 0 && stores.every((s) => s.city === city);
  return { city, stores, allSameCity };
}
