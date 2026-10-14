import { postJson } from './shared';

export type NativeHostStatus =
  | 'notRegistered'
  | 'manifestMissing'
  | 'wrongExtension'
  | 'hostMissing'
  | 'ok';

export type BrowserHealth = {
  chromeInstalled: boolean;
  /** Chrome profiles (display names) that have the ChatGPT extension. */
  profilesWithExtension: string[];
  nativeHost: NativeHostStatus;
  browserRuntime: boolean;
  /** The ChatGPT / Codex desktop app is open and can confuse browser control. */
  desktopAppRunning: boolean;
  ready: boolean;
};

export async function browserHealth() {
  return await postJson<BrowserHealth>('/api/browser/health', {});
}
