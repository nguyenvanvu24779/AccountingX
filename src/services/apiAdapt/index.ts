import { readTextFile, writeFile } from './filesystem';
import { isDesktopTauri } from './shared';

export * from './approvals';
export * from './automation';
export * from './browser';

export * from './codex';
export * from './dictation';
export * from './filesystem';
export * from './git';
export * from './humanDecisions';
export * from './lifecycle';
export * from './openapp';
export * from './permissions';
export type {
  InstalledSkillItem,
  MarketplaceSkillItem,
  SkillAgent,
  SkillScope,
  TauriFileEntry,
  TerminalStartResponse,
  UnifiedMcpClientName,
  UnifiedMcpConfig,
} from './shared';
export * from './terminal';
export * from './threadOps';
export * from './zalo';

const SESSION_META_STORAGE_KEY = 'codexia.session_meta';
const SESSION_META_FILE_PATH = '~/.plux/session_meta.json';

export async function readSessionMetaFile(): Promise<string> {
  if (isDesktopTauri()) {
    return await readTextFile(SESSION_META_FILE_PATH, { suppressToast: true });
  }
  return window.localStorage.getItem(SESSION_META_STORAGE_KEY) ?? '{}';
}

export async function writeSessionMetaFile(content: string): Promise<void> {
  if (isDesktopTauri()) {
    return await writeFile(SESSION_META_FILE_PATH, content);
  }
  window.localStorage.setItem(SESSION_META_STORAGE_KEY, content);
}
export * from './publish';
export * from './systemCheck';
