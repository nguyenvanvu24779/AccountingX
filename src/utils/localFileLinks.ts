/**
 * Local file links in chat messages.
 *
 * The agent links evidence it saved with absolute Windows paths
 * (`C:\...`, `C:/...` or `file:///C:/...`). The markdown renderer drops those
 * schemes, so the link turns into plain text. Before rendering, such targets
 * are rewritten to an in-app route the link component recognizes.
 */

const LOCAL_FILE_ROUTE = '/local-file/';

// `](` + optional `<` + a Windows drive path or file URL + optional `>` + `)`
const LOCAL_LINK_TARGET = /\]\(\s*<?((?:file:\/\/\/?)?[A-Za-z]:[\\/][^)>\n]*?)>?\s*\)/g;

function toWindowsPath(target: string): string {
  const isFileUrl = /^file:\/\//i.test(target);
  const raw = target.replace(/^file:\/\/\/?/i, '');
  const decoded = isFileUrl ? safeDecode(raw) : raw;
  return decoded.replace(/\//g, '\\');
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function rewriteLocalFileLinks(markdown: string): string {
  return markdown.replace(
    LOCAL_LINK_TARGET,
    (_match, target: string) =>
      `](${LOCAL_FILE_ROUTE}${encodeURIComponent(toWindowsPath(target.trim()))})`
  );
}

/** The absolute path a rewritten link points to, or null for any other link. */
export function parseLocalFileHref(href: string | undefined): string | null {
  if (!href?.startsWith(LOCAL_FILE_ROUTE)) return null;
  const path = safeDecode(href.slice(LOCAL_FILE_ROUTE.length));
  return /^[A-Za-z]:\\/.test(path) ? path : null;
}
