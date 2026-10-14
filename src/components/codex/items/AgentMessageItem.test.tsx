import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '@/stores/useEditorStore';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { AgentMessageItem } from './AgentMessageItem';

const reveal = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn(), revealItemInDir: reveal }));

const BS = String.fromCharCode(92);
const csvPath = ['C:', 'Users', 'NCPC', 'evidence', 'ton-kho.csv'].join(BS);

describe('AgentMessageItem file links', () => {
  beforeEach(() => {
    useEditorStore.setState({ openFiles: [], activeFile: null });
    useLayoutStore.setState({ isRightPanelOpen: false });
    reveal.mockClear();
  });

  it('opens a linked evidence file in the Files panel', async () => {
    render(<AgentMessageItem text={`Chi tiết: [Bảng CSV](${csvPath})`} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Bảng CSV' }));

    expect(useEditorStore.getState().activeFile).toBe(csvPath);
    expect(useLayoutStore.getState().isRightPanelOpen).toBe(true);
    expect(useLayoutStore.getState().activeRightPanelTab).toBe('files');
  });

  it('can show the file in its folder', async () => {
    render(<AgentMessageItem text={`[Bảng CSV](${csvPath})`} />);

    fireEvent.click(await screen.findByRole('button', { name: /thư mục|folder/i }));

    expect(reveal).toHaveBeenCalledWith(csvPath);
  });
});
