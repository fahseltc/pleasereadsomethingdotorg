/**
 * Schema.org JSON-LD builders (structured data for search engines).
 *
 * Everything here is derived from data the site already has (bookstores.json,
 * libraries.json, blog frontmatter, the events feed), so new stores, posts and
 * events get markup automatically on the next build. Pages pass the result to
 * BaseLayout's `jsonLd` prop.
 */
import { withBase } from './url';
import type { AggregatorEvent } from './events';

type Json = Record<string, unknown>;

const SITE = (import.meta.env.SITE as string | undefined) ?? 'https://pleasereadsomething.org';
const SITE_NAME = 'Please Read Something';
const SITE_DESCRIPTION =
  "Honest reviews of books, libraries, and independent bookstores along Colorado's Front Range, plus a one-stop list of book events.";
const LOGO_PATH = '/images/logos/round-logo-yellow.png';
const SAME_AS = [
  'https://www.youtube.com/@justpleasereadsomething',
  'https://bsky.app/profile/craftedbibliophile.bsky.social',
];

/** Absolute URL for a site path (base-aware). */
export function abs(path: string): string {
  return new URL(withBase(path), SITE).href;
}

const STATES: Record<string, string> = { colorado: 'CO', texas: 'TX', wyoming: 'WY', 'new mexico': 'NM' };

// Front Range cities, used to split "232 Walnut Street Fort Collins" (no comma
// between street and city) into street + city. Unknown cities degrade to the
// whole string as streetAddress, which is still valid.
const CITIES = [
  'Fort Collins', 'Loveland', 'Longmont', 'Boulder', 'Lafayette', 'Louisville', 'Broomfield',
  'Westminster', 'Arvada', 'Wheat Ridge', 'Edgewater', 'Lakewood', 'Golden', 'Denver',
  'Englewood', 'Littleton', 'Centennial', 'Aurora', 'Parker', 'Castle Rock', 'Highlands Ranch',
  'Greeley', 'Colorado Springs', 'Pueblo', 'Castle Pines', 'Thornton', 'Northglenn', 'Commerce City',
  'Cheyenne', 'Santa Fe',
];

/** Best-effort split of a one-line US address into a schema.org PostalAddress. */
export function parseAddress(address: string): Json {
  const out: Json = { '@type': 'PostalAddress', addressCountry: 'US' };
  const m = address
    .trim()
    .match(/^(.*?)[,\s]+([A-Za-z]{2}|Colorado|Texas|Wyoming|New Mexico)\.?(?:\s+(\d{5}))?$/i);
  if (!m) return { ...out, streetAddress: address.trim() };

  let rest = m[1].trim().replace(/,$/, '');
  const state = STATES[m[2].toLowerCase()] ?? m[2].toUpperCase();
  out.addressRegion = state;
  if (m[3]) out.postalCode = m[3];

  const comma = rest.lastIndexOf(',');
  if (comma > -1) {
    out.addressLocality = rest.slice(comma + 1).trim();
    rest = rest.slice(0, comma).trim();
  } else {
    const city = CITIES.find((c) => rest.toLowerCase().endsWith(' ' + c.toLowerCase()));
    if (city) {
      out.addressLocality = city;
      rest = rest.slice(0, -city.length).trim();
    }
  }
  out.streetAddress = rest;
  return out;
}

interface PlaceLike {
  id: string;
  name: string;
  image: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  website?: string;
}

/** BookStore / Library page markup. */
export function placeJsonLd(type: 'BookStore' | 'Library', d: PlaceLike, path: string): Json {
  const ld: Json = {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': abs(path),
    name: d.name,
    url: abs(path),
    address: parseAddress(d.address),
  };
  if (d.image && !d.image.endsWith('.svg')) ld.image = abs(d.image);
  if (typeof d.lat === 'number' && typeof d.lng === 'number') {
    ld.geo = { '@type': 'GeoCoordinates', latitude: d.lat, longitude: d.lng };
  }
  if (d.website) ld.sameAs = [d.website];
  return ld;
}

/** BreadcrumbList. `items` are in order, excluding Home (added automatically). */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  const all = [{ name: 'Home', path: '/' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

const publisher: Json = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: abs('/'),
  logo: { '@type': 'ImageObject', url: abs(LOGO_PATH) },
};

/** Site-wide WebSite + Organization (home page). */
export function siteJsonLd(): Json[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: abs('/'),
      description: SITE_DESCRIPTION,
    },
    { '@context': 'https://schema.org', ...publisher, sameAs: SAME_AS },
  ];
}

/** Blog post -> Article. `about` is the linked store/library, if any. */
export function articleJsonLd(
  post: { title: string; description?: string; pubDate: Date; heroImage?: string; author?: string },
  path: string,
  about?: { type: 'BookStore' | 'Library'; name: string; path: string } | null,
): Json {
  const ld: Json = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.pubDate.toISOString(),
    mainEntityOfPage: abs(path),
    image: abs(post.heroImage ?? LOGO_PATH),
    author: post.author
      ? { '@type': 'Person', name: post.author }
      : { '@type': 'Organization', name: SITE_NAME, url: abs('/') },
    publisher,
  };
  if (post.description) ld.description = post.description;
  if (about) ld.about = { '@type': about.type, name: about.name, url: abs(about.path) };
  return ld;
}

/**
 * Event markup. `venue` is the matched indexed store (gives a real address);
 * otherwise the feed's free-text location (or its source name) is used.
 */
export function eventJsonLd(
  e: AggregatorEvent,
  venue?: { type: 'BookStore' | 'Library'; name: string; address: string; path: string } | null,
): Json {
  const place: Json = venue
    ? { '@type': 'Place', name: venue.name, url: abs(venue.path), address: parseAddress(venue.address) }
    : {
        '@type': 'Place',
        name: e.location || e.source || 'Colorado Front Range',
        address: e.location || undefined,
      };
  const ld: Json = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    startDate: e.start,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: place,
  };
  if (e.end) ld.endDate = e.end;
  if (e.description) ld.description = e.description;
  if (e.url) ld.url = e.url;
  return ld;
}

/** Serialize for a <script type="application/ld+json"> body (safe against "</script>"). */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
