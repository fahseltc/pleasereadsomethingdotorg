/**
 * Bookshop.org affiliate links.
 *
 * Bookshop.org is an online bookstore that supports independent shops; their
 * affiliate program credits our ID on purchases made through our links. The
 * affiliate ID is a PUBLIC tracking id that appears in the URL visitors click —
 * it is not a secret, so committing it is fine (and no API key is involved;
 * these are plain build-time URLs).
 *
 * Per-book links use the ISBN-13 and the affiliate path form:
 *   https://bookshop.org/a/<affiliateId>/<isbn13>
 */
export const BOOKSHOP_AFFILIATE_ID = '130147';

/** Normalize an ISBN: strip hyphens/spaces so "978-0-..." and "9780..." both work. */
export function normalizeIsbn(isbn: string): string {
  return String(isbn).replace(/[\s-]/g, '');
}

/** Build the affiliate buy link for a given ISBN-13. */
export function bookshopBookUrl(isbn: string): string {
  return `https://bookshop.org/a/${BOOKSHOP_AFFILIATE_ID}/${normalizeIsbn(isbn)}`;
}

/** A general "shop & support indies" affiliate link (no specific book). */
export function bookshopShopUrl(): string {
  return `https://bookshop.org/?aid=${BOOKSHOP_AFFILIATE_ID}`;
}
