import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addUnified = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services', () => ({
  unifiedAddMcpServer: (...args: unknown[]) => addUnified(...args),
}));

import { McpAddPanel } from './McpAddPanel';

beforeEach(() => vi.clearAllMocks());

describe('Codex custom connectors', () => {
  it('adds a local command server to Codex', async () => {
    const added = vi.fn();
    render(<McpAddPanel onAdded={added} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Server name' }), {
      target: { value: 'local' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Command' }), {
      target: { value: 'node' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Server' }));

    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(addUnified).toHaveBeenCalledWith({
      clientName: 'codex',
      serverName: 'local',
      serverConfig: { type: 'stdio', command: 'node', args: [] },
    });
  });

  it('rejects a malformed environment map without writing configuration', async () => {
    render(<McpAddPanel onAdded={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Server name' }), {
      target: { value: 'local' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Command' }), {
      target: { value: 'node' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Environment variables (JSON)' }), {
      target: { value: '{"KEY":42}' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Server' }));

    await waitFor(() => expect(addUnified).not.toHaveBeenCalled());
  });
});
