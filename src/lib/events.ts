/**
 * Aggregator bridge (design §3).
 *
 * `book-events-aggregator` emits output/events.json whose events carry a
 * free-text `location` and a `source` label. `npm run sync:events` copies that
 * file to src/data/events.json. Here we map each event to a bookstore `id` using
 * the store's `sourceAliases` (plus a name/location substring fallback), so a
 * store's detail page can list its upcoming events.
 *
 * The file is OPTIONAL: if it's absent (never synced), this returns no events
 * and the site degrades gracefully.
 *
 * FEATURE FLAG: set `disabled: true` to sever the events→bookstore link
 * site-wide (store "Upcoming events" sections and the global /events page both
 * go empty) without removing any wiring.
 */
const eventsFeature = {
  disabled: false,
};

export interface AggregatorEvent {
  title: string;
  description?: string;
  start: string;
  end?: string | null;
  location?: string;
  url?: string;
  source?: string;
}

interface EventsFile {
  events?: AggregatorEvent[];
}

let cache: AggregatorEvent[] | null = null;

async function loadEvents(): Promise<AggregatorEvent[]> {
  if (cache) return cache;
  try {
    // Vite resolves this at build time; the ?? guards a missing file.
    const mod = (await import('../data/events.json')) as { default?: EventsFile };
    const data = (mod.default ?? mod) as EventsFile;
    cache = Array.isArray(data.events) ? data.events : [];
  } catch {
    cache = [];
  }
  return cache;
}

function matchesStore(
  event: AggregatorEvent,
  aliases: string[],
  storeName: string
): boolean {
  const haystack = `${event.source ?? ''} ${event.location ?? ''}`.toLowerCase();
  const needles = [...aliases, storeName].map((s) => s.toLowerCase().trim()).filter(Boolean);
  return needles.some((n) => haystack.includes(n));
}

/**
 * Upcoming events for one store, soonest first. `now` is injectable for tests.
 */
export async function upcomingEventsForStore(
  store: { name: string; sourceAliases?: string[] },
  now: Date = new Date()
): Promise<AggregatorEvent[]> {
  // Link severed: return nothing while the events feature is disabled.
  if (eventsFeature.disabled) return [];

  const events = await loadEvents();
  const aliases = store.sourceAliases ?? [];
  return events
    .filter((e) => matchesStore(e, aliases, store.name))
    .filter((e) => {
      const start = new Date(e.start);
      return !Number.isNaN(start.getTime()) && start >= now;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * All upcoming events (every source), soonest first — for the global /events
 * page. Respects the same feature flag. `now` is injectable for tests.
 */
export async function allUpcomingEvents(
  now: Date = new Date()
): Promise<AggregatorEvent[]> {
  if (eventsFeature.disabled) return [];

  const events = await loadEvents();
  return events
    .filter((e) => {
      const start = new Date(e.start);
      return !Number.isNaN(start.getTime()) && start >= now;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export interface StoreRef {
  id: string;
  name: string;
  sourceAliases?: string[];
}

/**
 * Resolve an event to an indexed bookstore `id`, or null if none matches. Uses
 * the same source/location matching as the per-store listing, so the Events
 * page can link a location to the store's detail page when we already index it.
 * If several stores match, the one with the longest matching alias/name wins
 * (most specific), so "Second Star to the Right Books" beats a generic token.
 */
export function matchStoreForEvent(
  event: AggregatorEvent,
  stores: StoreRef[]
): string | null {
  const haystack = `${event.source ?? ''} ${event.location ?? ''}`.toLowerCase();
  let bestId: string | null = null;
  let bestLen = 0;
  for (const store of stores) {
    const aliases = store.sourceAliases ?? [];
    if (!matchesStore(event, aliases, store.name)) continue;
    const matchLen = Math.max(
      0,
      ...[...aliases, store.name]
        .map((s) => s.toLowerCase().trim())
        .filter((n) => n && haystack.includes(n))
        .map((n) => n.length)
    );
    if (matchLen > bestLen) {
      bestLen = matchLen;
      bestId = store.id;
    }
  }
  return bestId;
}
