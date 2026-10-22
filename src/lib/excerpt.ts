/**
 * Build a short plain-text preview from a post's raw Markdown/MDX body.
 *
 * Used as the fallback on the blog listing when a post has no `description`.
 * The goal is clean prose, so this strips the things that should never show up
 * in a one-line teaser: JSX/MDX comments ({/* ... *\/}), JSX component tags
 * (<YouTube/>), bare URLs, markdown image/link syntax, headings, blockquote
 * markers, and inline emphasis/code markers.
 *
 * It then returns the opening prose, trimmed to roughly `maxLength` characters
 * on a word boundary, with an ellipsis if it was cut short.
 */
export function excerptFromBody(body: string | undefined, maxLength = 200): string {
  if (!body) return '';

  let text = body;

  // Drop JSX/MDX comments: {/* ... */} (may span multiple lines).
  text = text.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  // Drop HTML comments just in case: <!-- ... -->
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Drop fenced code blocks entirely.
  text = text.replace(/```[\s\S]*?```/g, '');
  // Drop JSX/HTML tags, e.g. <YouTube url="..." /> or <div>.
  text = text.replace(/<[^>]+>/g, '');
  // Markdown images: ![alt](src) -> drop entirely.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // Markdown links: [text](href) -> keep the text.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Bare URLs on their own.
  text = text.replace(/https?:\/\/\S+/g, '');

  // Now reduce to prose lines: skip headings, blockquotes, and list markers at
  // the start of a line, and strip inline emphasis/code markers.
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, '') // heading markers
        .replace(/^>\s?/, '') // blockquote marker
        .replace(/^[-*+]\s+/, '') // bullet marker
        .replace(/^\d+\.\s+/, ''), // ordered-list marker
    )
    .map((line) => line.replace(/[*_`]/g, '')); // inline emphasis/code

  const prose = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (prose.length <= maxLength) return prose;

  // Trim to the last word boundary within maxLength.
  const clipped = prose.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const base = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;
  return base.replace(/[.,;:!?-]+$/, '') + '…';
}
