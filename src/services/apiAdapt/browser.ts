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
  ready: boolean;
};

export async function browserHealth() {
  return await postJson<BrowserHealth>('/api/browser/health', {});
}
