import 'server-only';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: true });

/** Разметка страниц и вики: пишет админ, поэтому тегов больше. */
const CONTENT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'strong', 'em', 'del', 'hr', 'br', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    th: ['align'],
    td: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
  },
};

/** Текст завоза: пишет игрок, поэтому только базовое форматирование. */
const POST_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'del', 'br', 'blockquote', 'code'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { href: attribs.href, rel: 'noopener noreferrer nofollow ugc', target: '_blank' },
    }),
  },
};

export function renderContentMarkdown(source: string): string {
  return sanitizeHtml(marked.parse(source, { async: false }) as string, CONTENT_OPTIONS);
}

export function renderPostMarkdown(source: string): string {
  return sanitizeHtml(marked.parse(source, { async: false }) as string, POST_OPTIONS);
}

/** Короткая выжимка без разметки, для превью и описаний в OG. */
export function plainExcerpt(source: string, length = 180): string {
  const text = sanitizeHtml(marked.parse(source, { async: false }) as string, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

/** Заголовки h2 для оглавления страниц вроде Zero Season. */
export function extractHeadings(html: string): { id: string; title: string }[] {
  const result: { id: string; title: string }[] = [];
  const regex = /<h2[^>]*>(.*?)<\/h2>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = regex.exec(html)) !== null) {
    const title = match[1].replace(/<[^>]+>/g, '').trim();
    if (title) result.push({ id: `sec-${index}`, title });
    index += 1;
  }
  return result;
}

/** Проставляет id заголовкам, чтобы работали якоря оглавления. */
export function withHeadingIds(html: string): string {
  let index = 0;
  return html.replace(/<h2([^>]*)>/gi, (_match, attrs: string) => {
    const id = `sec-${index}`;
    index += 1;
    return `<h2 id="${id}"${attrs}>`;
  });
}
