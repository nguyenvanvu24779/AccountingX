/**
 * AccountingX edition flags.
 *
 * The app is forked from a general-purpose coding-agent client. Features that
 * are not part of the accounting product are hidden here instead of deleted,
 * so upstream merges stay possible and a feature can be re-enabled by flipping
 * one boolean.
 */
export const EDITION = {
  /** Claude Code / Claude Agent engine (the product runs on Codex only). */
  claudeAgent: false,
  /** Extra ACP agents. */
  acpAgents: false,
  /** Chat-bot integrations (Zalo gets its own module later). */
  bots: false,
  /** Remote access / phone pairing server. */
  remoteAccess: false,
  /** Usage telemetry and consent dialog. */
  telemetry: false,
  /** Local voice dictation (needs the `voice-dictation` Rust feature). */
  dictation: false,
  /** Marketing promos for third-party apps. */
  promo: false,
  /** Developer tools in the right panel. */
  devPanels: { diff: false, terminal: false, webpreview: false },
  /** Link to the upstream project's issue tracker. */
  upstreamLinks: false,
} as const;

export type EngineId = 'codex' | 'cc';

export function enabledEngines(): EngineId[] {
  return EDITION.claudeAgent ? ['codex', 'cc'] : ['codex'];
}
