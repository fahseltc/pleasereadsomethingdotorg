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
 * FEATURE FLAG: the events→bookstore link is currently DISABLED. All the wiring
 * (this module, sync-events.mjs, src/data/events.json, and the "Upcoming events"
 * section on the detail page) stays in place but produces nothing. Flip
 * `disabled` to false below to turn it back on — no other change needed.
 */
const eventsFeature = {
  disabled: true,
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
