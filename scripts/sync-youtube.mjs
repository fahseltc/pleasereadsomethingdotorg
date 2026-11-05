#!/usr/bin/env node
// sync-youtube.mjs — keep src/data/youtube-shorts.json in step with the
// channel's Shorts. Runs before every build (`npm run build`), and can run on
// its own with `npm run sync:youtube`.
//
// Uses the YouTube Data API v3 with an API key from YOUTUBE_API_KEY (a local
// .env file, or a GitHub Actions secret in CI). Each run makes about 7 quota
// calls. The default daily quota is 10,000 units:
//   1. channels.list (forHandle)   → the channel's uploads playlist
//   2. playlistItems.list (pages)  → every upload's video ID and publish time
//   3. videos.list (batches of 50) → privacy status and duration
//
// A Short is a public upload 1 to 180 seconds long. YouTube counts vertical and
// square videos up to 3 minutes as Shorts. The API does not report the aspect
// ratio, so this filter uses length only. That is correct for this channel,
// which posts Shorts only. A landscape video under 3 minutes would be included
// too, so check the list when long-form videos are added.
//
// Failure policy: the site must still build when YouTube is down, the key is
// missing, or the quota runs out. Any failure keeps the last good JSON and
// prints a warning. The file is rewritten only after the full list was read.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { paths, ROOT, log } from './lib.mjs';

// Read .env for local runs. Variables already set in the environment win, so CI
// secrets are never overridden. Missing .env is fine.
const dotenv = resolve(ROOT, '.env');
if (existsSync(dotenv)) {
  try {
    process.loadEnvFile(dotenv);
  } catch (err) {
    log.warn(`Could not read .env: ${err.message}`);
  }
}

const CHANNEL_HANDLE = '@JustPleaseReadSomething';
const API = 'https://www.googleapis.com/youtube/v3';
const MAX_SHORT_SECONDS = 180;
const PAGE_SIZE = 50; // the API maximum for playlistItems and for videos.list ids
const MAX_PAGES = 100; // safety stop: 5,000 uploads
const TIMEOUT_MS = 20_000;
const ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET one YouTube Data API method. Retries on network errors, 429, and 5xx.
 * Errors never include the request URL, because the URL carries the key.
 */
async function apiGet(method, params, key) {
  const url = new URL(`${API}/${method}`);
  for (const [name, value] of Object.entries({ ...params, key })) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }

  let lastErr;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return body;
      const reason = body?.error?.errors?.[0]?.reason;
      lastErr = new Error(
        `YouTube API ${method} failed: HTTP ${res.status}${reason ? ` (${reason})` : ''}`,
      );
      if (res.status !== 429 && res.status < 500) break; // a client error won't fix itself
    } catch (err) {
      lastErr = new Error(`YouTube API ${method} unreachable: ${err.message}`);
    }
    if (attempt < ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
  }
  throw lastErr;
}

/** The channel's uploads playlist ID, looked up by handle. */
async function uploadsPlaylist(key) {
  const body = await apiGet('channels', { part: 'contentDetails', forHandle: CHANNEL_HANDLE }, key);
  const channel = body.items?.[0];
  const uploads = channel?.contentDetails?.relatedPlaylists?.uploads;
  if (!channel || !uploads) throw new Error(`no channel found for ${CHANNEL_HANDLE}`);
  return { channelId: channel.id, uploads };
}

/** Every upload as [{ id, publishedAt }], newest first (the playlist's own order). */
async function uploadItems(playlistId, key) {
  const items = [];
  let pageToken;
  for (let page = 1; ; page++) {
    if (page > MAX_PAGES) throw new Error(`more than ${MAX_PAGES} pages of uploads; stopping`);
    const body = await apiGet(
      'playlistItems',
      { part: 'contentDetails', playlistId, maxResults: PAGE_SIZE, pageToken },
      key,
    );
    for (const item of body.items ?? []) {
      const id = item.contentDetails?.videoId;
      const publishedAt = item.contentDetails?.videoPublishedAt;
      if (id && publishedAt) items.push({ id, publishedAt });
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return items;
}

/** Full video records for the given IDs (batches of 50). Deleted videos are simply absent. */
async function videoRecords(ids, key) {
  const records = [];
  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const batch = ids.slice(i, i + PAGE_SIZE);
    const body = await apiGet('videos', { part: 'contentDetails,status', id: batch.join(',') }, key);
    records.push(...(body.items ?? []));
  }
  return records;
}

/** ISO 8601 duration (e.g. "PT47S", "PT1M30S", "P0D") as a number of seconds, or null. */
function durationSeconds(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso ?? '');
  if (!m) return null;
  const [, days = 0, hours = 0, minutes = 0, seconds = 0] = m;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/** Public Shorts on the channel, newest first, as the rows written to the JSON. */
async function fetchShorts(key) {
  const { channelId, uploads } = await uploadsPlaylist(key);
  const uploaded = await uploadItems(uploads, key);
  const records = await videoRecords(
    uploaded.map((u) => u.id),
    key,
  );
  log.info(`Checked ${uploaded.length} uploads on ${CHANNEL_HANDLE}.`);

  const publishedById = new Map(uploaded.map((u) => [u.id, u.publishedAt]));
  const shorts = records
    .filter((v) => {
      const secs = durationSeconds(v.contentDetails?.duration);
      return v.status?.privacyStatus === 'public' && secs !== null && secs > 0 && secs <= MAX_SHORT_SECONDS;
    })
    .map((v) => ({
      id: v.id,
      title: v.snippet?.title || v.id,
      publishedAt: publishedById.get(v.id),
      url: `https://www.youtube.com/shorts/${v.id}`,
    }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return { channelId, shorts };
}

/** Number of videos in the current JSON file (for the keep-existing message). */
async function existingCount() {
  if (!existsSync(paths.youtubeShorts)) return 0;
  try {
    const parsed = JSON.parse(await readFile(paths.youtubeShorts, 'utf8'));
    return Array.isArray(parsed.videos) ? parsed.videos.length : 0;
  } catch {
    return 0;
  }
}

async function main() {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) {
    log.warn('YOUTUBE_API_KEY is not set, so the YouTube Shorts list was not refreshed.');
    log.info('Add it to .env for local runs, or as a GitHub secret for the deploy (see README).');
    return;
  }

  let result;
  try {
    result = await fetchShorts(key);
  } catch (err) {
    log.warn(`Could not refresh the YouTube Shorts list: ${err.message}`);
    log.info(`Keeping the existing ${await existingCount()} Short(s) in src/data/youtube-shorts.json.`);
    return;
  }

  const { channelId, shorts } = result;
  if (shorts.length === 0) {
    log.warn('The channel returned no public Shorts, so the existing file was kept.');
    return;
  }

  const json =
    JSON.stringify({ channel: CHANNEL_HANDLE, channelId, kind: 'shorts', videos: shorts }, null, 2) + '\n';
  const current = existsSync(paths.youtubeShorts) ? await readFile(paths.youtubeShorts, 'utf8') : null;
  if (json === current) {
    log.ok(`YouTube Shorts list is up to date (${shorts.length} videos).`);
    return;
  }

  await mkdir(paths.dataDir, { recursive: true });
  await writeFile(paths.youtubeShorts, json, 'utf8');
  log.ok(`Wrote ${shorts.length} Shorts to src/data/youtube-shorts.json.`);
}

main().catch((err) => {
  // Unexpected errors must not break the site build either. The last good file stays.
  log.warn(`YouTube sync skipped: ${err.message}`);
});
