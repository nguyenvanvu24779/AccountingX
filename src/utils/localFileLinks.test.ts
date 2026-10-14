import { describe, expect, it } from 'vitest';
import { parseLocalFileHref, rewriteLocalFileLinks } from './localFileLinks';

const BS = String.fromCharCode(92);
const winPath = ['C:', 'Users', 'NCPC', 'evidence', 'ton kho.csv'].join(BS);

function roundTrip(target: string) {
  const out = rewriteLocalFileLinks(`[file](${target})`);
  const href = out.slice(out.indexOf('](') + 2, -1);
  return parseLocalFileHref(href);
}

describe('local file links', () => {
  it.each([
    ['backslash path', winPath],
    ['forward slash path', 'C:/Users/NCPC/evidence/ton kho.csv'],
    ['file url', 'file:///C:/Users/NCPC/evidence/ton%20kho.csv'],
    ['angle bracket path with spaces', `<${winPath}>`],
  ])('resolves a %s to the Windows path', (_name, target) => {
    expect(roundTrip(target)).toBe(winPath);
  });

  it('leaves web links and relative links alone', () => {
    const md = '[a](https://example.com/x) and [b](docs/readme.md)';
    expect(rewriteLocalFileLinks(md)).toBe(md);
  });

  it('only accepts hrefs produced by the rewrite', () => {
    expect(parseLocalFileHref('/local-file/not-a-path')).toBeNull();
    expect(parseLocalFileHref('https://example.com')).toBeNull();
    expect(parseLocalFileHref(undefined)).toBeNull();
  });

  it('rewrites every link in a message', () => {
    const md = `[csv](${winPath}) · [md](C:/a/b.md)`;
    const out = rewriteLocalFileLinks(md);
    expect(out.match(/\/local-file\//g)).toHaveLength(2);
  });
});
