#!/usr/bin/env node
// new-post.mjs — scaffold a blog article (design §6).
//
//   npm run new:post
//   npm run new:post -- --title "My first review"
//   npm run new:post -- --title "Review" --isbn 9781250301697

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, prompt, slugify, paths, log } from './lib.mjs';

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  const { opts } = parseArgs(process.argv.slice(2));

  const title = opts.title || (await prompt('Post title'));
  if (!title) {
    log.err('A title is required.');
    process.exit(1);
  }
  const description = opts.description || (await prompt('Short description (optional)'));
  const tagsRaw = opts.tags || (await prompt('Tags, comma-separated (optional)'));
  const bookstore = opts.bookstore || (await prompt('Linked bookstore id (optional)'));
  const isbnRaw = opts.isbn || (await prompt('Book ISBN-13 for a Bookshop.org buy button (optional)'));

  // Normalize + validate the ISBN the same way the content schema does. Accept
  // hyphens/spaces; must be 13 digits starting 978/979. If it's invalid we warn
  // and leave it out rather than scaffold a post that won't build.
  let isbn = '';
  if (isbnRaw) {
    const stripped = String(isbnRaw).replace(/[\s-]/g, '');
    if (/^(97[89])\d{10}$/.test(stripped)) {
      isbn = stripped;
    } else {
      log.warn(`"${isbnRaw}" isn't a valid ISBN-13 (need 13 digits starting 978/979) — leaving it out. Add it later if you have it.`);
    }
  }

  const slug = slugify(opts.slug || title);
  // Posts are created as .mdx so they can embed the <YouTube/> component. MDX is
  // the same as Markdown for everyday writing — just write normally.
  const file = join(paths.blogDir, `${slug}.mdx`);
  if (existsSync(file)) {
    log.err(`A post already exists at src/content/blog/${slug}.mdx`);
    process.exit(1);
  }

  const tags = tagsRaw
    ? String(tagsRaw).split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Templated front-matter with inline hints. draft:true keeps it out of build.
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description || 'A short summary used for previews and SEO.')}`,
    `pubDate: ${today()}`,
    '# heroImage: "/images/blog/your-image.jpg"   # optional — drop the file in public/images/blog/',
    `tags: ${JSON.stringify(tags)}`,
    bookstore
      ? `bookstore: ${JSON.stringify(bookstore)}   # links this post to a store id (optional)`
      : '# bookstore: "boulder-bookstore"   # optional — link this post to a store id',
    isbn
      ? `isbn: ${JSON.stringify(isbn)}   # adds a Bookshop.org buy button`
      : '# isbn: "9780000000000"   # optional — ISBN-13 of the book; adds a Bookshop.org buy button',
    'draft: true   # set to false when ready to publish',
    '---',
    '',
    'Write your article here. It uses **Markdown** — a few examples are shown',
    'below, commented out so they do not appear on the page. Delete them (and',
    'this intro) once you get going.',
    '',
    '{/*',
    'MARKDOWN QUICK REFERENCE (this whole block is a comment — it will NOT show',
    'on the published page). Full guide: https://www.markdownguide.org/basic-syntax/',
    '',
    '## A heading (## = section, ### = sub-section)',
    '',
    'A normal paragraph. Leave a blank line between paragraphs.',
    '',
    '**bold text**, *italic text*, and `inline code`.',
    '',
    '- a bullet list item',
    '- another item',
    '',
    '1. a numbered list item',
    '2. another item',
    '',
    '[A link to another store](/bookstores/boulder-bookstore)',
    '[A link to an outside site](https://www.denverpost.com/)',
    '',
    '> A blockquote, good for pulling out a quote.',
    '',
    'ADD A PHOTO INSIDE THE ARTICLE:',
    '  1. Put the image file in the public/images/blog/ folder',
    '     (e.g. public/images/blog/storefront.jpg).',
    '  2. Reference it where you want it to appear, by path, like this:',
    '',
    '![A short description of the photo](/images/blog/storefront.jpg)',
    '',
    '  - The path always starts with /images/blog/ and then your file name.',
    '  - The text in the [square brackets] is "alt text" — a short description',
    '    shown if the image fails to load and read aloud by screen readers.',
    '  - This is separate from the optional `heroImage` in the top section,',
    '    which is the single banner image for the whole post. Use inline images',
    '    (like above) for photos within the body; use heroImage for the banner.',
    '',
    'EMBED A YOUTUBE VIDEO:',
    '  Paste the video or Short URL into a <YouTube/> tag, anywhere in the body.',
    '  No import or setup needed. It figures out Shorts (tall) vs. regular',
    '  (widescreen) automatically. Examples (remove the surrounding comment to',
    '  use one):',
    '',
    '    <YouTube url="https://www.youtube.com/watch?v=1Zq5fAD2n0Y" />',
    '    <YouTube url="https://www.youtube.com/shorts/qyL8XcY8ZG4" />',
    '',
    '  You can add a title for screen readers:',
    '    <YouTube url="https://youtu.be/1Zq5fAD2n0Y" title="A tour of the shop" />',
    '*/}',
    '',
    '{/* Example embed — delete or replace with your own video, or remove it. */}',
    '{/* <YouTube url="https://www.youtube.com/watch?v=1Zq5fAD2n0Y" /> */}',
    '',
  ].join('\n');

  await mkdir(paths.blogDir, { recursive: true });
  await writeFile(file, frontmatter, 'utf8');

  log.rule();
  log.ok(`Created src/content/blog/${slug}.mdx`);
  log.info('Fill in the body below the front-matter.');
  log.info('Set `draft: false` when ready to publish.');
  log.info('Optional hero image: drop it in public/images/blog/ and set `heroImage`.');
  if (isbn) log.info(`ISBN ${isbn} set — the post will show a Bookshop.org buy button.`);
  log.info('Preview with `npm run dev`, then publish with `npm run publish`.');
}

main();
