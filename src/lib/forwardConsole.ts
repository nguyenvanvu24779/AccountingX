import { isTauri } from '@tauri-apps/api/core';
import { error as logError, info as logInfo, warn as logWarn } from '@tauri-apps/plugin-log';

const fmt = (args: unknown[]) =>
  args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 2000);

/**
 * Development aid: mirror webview console output and uncaught errors into the
 * terminal that runs `bun tauri dev`, so problems can be reported without
 * opening DevTools.
 */
export function forwardConsoleToTerminal() {
  if (!import.meta.env.DEV || !isTauri()) return;

  const wrap = (level: 'info' | 'warn' | 'error', send: (m: string) => Promise<void>) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      send(`[webview] ${fmt(args)}`).catch(() => undefined);
    };
  };
  wrap('info', logInfo);
  wrap('warn', logWarn);
  wrap('error', logError);

  window.addEventListener('error', (e) => {
    logError(`[webview] uncaught: ${e.message} at ${e.filename}:${e.lineno}`).catch(
      () => undefined
    );
  });
  window.addEventListener('unhandledrejection', (e) => {
    logError(`[webview] unhandled rejection: ${fmt([e.reason])}`).catch(() => undefined);
  });
}
