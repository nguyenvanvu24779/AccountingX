import { codexService } from '@/services/codexService';
import { useAgentCenterStore, useLayoutStore } from '@/stores';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export interface AgentNavParams {
  agent: string | null;
  cwd: string | null;
  threadId?: string | null;
}

// Shared navigation logic used by both web-mode URL params (useUrlParamThread)
// and OS-level deep links (useAppDeepLink). Dispatches the same store updates
// that a sidebar row click does, opening the given conversation.
export function navigateToAgentSession({ agent, cwd, threadId }: AgentNavParams): boolean {
  if (agent !== 'codex' || !cwd || !threadId) return false;

  const { addProject, setCwd } = useWorkspaceStore.getState();
  const { setView } = useLayoutStore.getState();
  const { addAgentCard, setCurrentAgentCardId } = useAgentCenterStore.getState();

  addProject(cwd);
  setCwd(cwd);
  addAgentCard({ kind: 'codex', id: threadId, cwd });
  setCurrentAgentCardId(threadId);
  setView('agent');
  void codexService.setCurrentThread(threadId);
  return true;
}
