import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerNotification } from '@/bindings/ServerNotification';
import type { Thread } from '@/bindings/v2';
import { useCodexStore } from '@/components/codex/stores';
import { useAgentCenterStore } from '@/stores/useAgentCenterStore';
import { useServerNotificationHandler } from './useServerNotificationHandler';

vi.mock('@/services/apiAdapt', () => ({
  allowSleep: vi.fn(),
  preventSleep: vi.fn(),
}));

const refs = {
  isCodexThreadActiveRef: { current: true },
  taskCompleteBeepModeRef: { current: 'never' as const },
  preventSleepDuringTasksRef: { current: false },
};

const thread = (id: string) => ({ id, cwd: '/company', preview: id }) as unknown as Thread;

function notify(method: 'thread/deleted' | 'thread/archived', threadId: string) {
  const { result } = renderHook(() => useServerNotificationHandler(refs, async () => undefined));
  result.current({ method, params: { threadId } } as ServerNotification);
}

describe.each(['thread/deleted', 'thread/archived'] as const)('%s notification', (method) => {
  beforeEach(() => {
    useCodexStore.setState({
      threads: [thread('gone'), thread('kept')],
      currentThreadId: 'gone',
    });
    useAgentCenterStore.setState({
      cards: [
        { kind: 'codex', id: 'gone' },
        { kind: 'codex', id: 'kept' },
      ],
      currentAgentCardId: 'gone',
    });
  });

  it('removes the thread from the live list, its agent card and the current selection', () => {
    notify(method, 'gone');

    expect(useCodexStore.getState().threads.map((t) => t.id)).toEqual(['kept']);
    expect(useCodexStore.getState().currentThreadId).toBeNull();
    expect(useAgentCenterStore.getState().cards.map((c) => c.id)).toEqual(['kept']);
    expect(useAgentCenterStore.getState().currentAgentCardId).toBeNull();
  });

  it('leaves the current selection alone when another thread goes away', () => {
    useCodexStore.setState({ currentThreadId: 'kept' });
    useAgentCenterStore.setState({ currentAgentCardId: 'kept' });

    notify(method, 'gone');

    expect(useCodexStore.getState().currentThreadId).toBe('kept');
    expect(useAgentCenterStore.getState().currentAgentCardId).toBe('kept');
  });
});
