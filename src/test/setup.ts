import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { i18n } from '@/lib/i18n';

// vitest runs with `globals: false`, so RTL cannot register its own auto-cleanup and
// mounted trees would leak into the next test's queries.
afterEach(cleanup);

// Tests assert on specific accessible names, so pin the language regardless
// of the app's default locale (Vietnamese) or any persisted locale-storage state.
void i18n.changeLanguage('en');

// jsdom ships neither of these, and Radix primitives call both.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
