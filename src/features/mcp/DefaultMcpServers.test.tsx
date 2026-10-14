import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const addUnified = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services', () => ({
  unifiedAddMcpServer: (...args: unknown[]) => addUnified(...args),
}));

import { DefaultMcpServers } from './DefaultMcpServers';

beforeEach(() => vi.clearAllMocks());

describe('featured connectors for Codex', () => {
  it('keeps FXMacroData outside Featured and adds it from Finance & economics', async () => {
    const added = vi.fn();
    render(<DefaultMcpServers servers={{}} onServerAdded={added} />);
    expect(screen.queryByRole('button', { name: 'Add FXMacroData' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All connectors' }));
    expect(screen.getByRole('button', { name: 'Add FXMacroData' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Finance & economics' }));
    expect(screen.queryByRole('button', { name: 'Add GitHub' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add FXMacroData' }));

    await waitFor(() => expect(added).toHaveBeenCalledOnce());
    expect(addUnified).toHaveBeenCalledWith({
      clientName: 'codex',
      path: undefined,
      serverName: 'fxmacrodata',
      serverConfig: { type: 'http', url: 'https://mcp.fxmacrodata.com' },
    });
  });

  it('does not offer to add a connector that is already configured', () => {
    render(<DefaultMcpServers servers={{ linear: {} }} onServerAdded={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Add Linear' })).toBeNull();
  });
});
